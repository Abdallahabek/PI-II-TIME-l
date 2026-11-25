// Autor: Abdallah Ali Borges El Khatib
// Rota GET /dashboard com indicadores calculados a partir do banco Oracle

import { Router, Request, Response } from 'express';
import {
    ehErroConexaoOracle,
    executarQuery,
    MENSAGEM_BANCO_INDISPONIVEL
} from '../config/database';
import { autenticarToken } from '../middlewares/auth';
import {
    Demanda,
    DemandaProximaPrazo,
    PrioridadeDemanda,
    ResumoDashboard,
    StatusDemanda,
    TipoDemanda
} from '../types';

interface DemandaDashboardRow extends Demanda {
    vencida: number;
    proximaPrazo: number;
}

const router = Router();

const STATUS_EM_ABERTO: StatusDemanda[] = ['Aberta', 'Em andamento', 'Em revisão'];
const DIAS_JANELA_PRAZO = 7;

// Ordena demandas priorizando prazos mais urgentes (vencidos primeiro) e desempate por ID
function compararPorPrazoAsc(a: Demanda, b: Demanda): number {
    if (a.prazoFinalizacao && b.prazoFinalizacao) {
        const cmp = a.prazoFinalizacao.localeCompare(b.prazoFinalizacao);
        return cmp !== 0 ? cmp : a.id - b.id;
    }
    if (a.prazoFinalizacao) return -1;
    if (b.prazoFinalizacao) return 1;
    return a.id - b.id;
}

// Retorna totais por status/prioridade/tipo, criticas em aberto e proximas do prazo (com flag vencida)
router.get('/', autenticarToken, async (req: Request, res: Response) => {
    try {
        const usuario = req.usuario!;

        const filtroPerfil =
            usuario.perfil === 'Administrador'
                ? ''
                : 'INNER JOIN usuario_projeto up ON up.projeto_id = d.projeto_id AND up.usuario_id = :usuarioId';

        // Calcula vencimento e janela de 7 dias diretamente no Oracle com TRUNC(SYSDATE)
        const sql = `
            SELECT d.id AS "id",
                   d.titulo AS "titulo",
                   d.descricao AS "descricao",
                   d.tipo AS "tipo",
                   d.prioridade AS "prioridade",
                   d.status AS "status",
                   d.projeto_id AS "projetoId",
                   p.nome AS "projetoNome",
                   d.responsavel_id AS "responsavelId",
                   u.nome AS "responsavelNome",
                   TO_CHAR(d.data_criacao, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "dataCriacao",
                   TO_CHAR(d.data_atualizacao, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "dataAtualizacao",
                   TO_CHAR(d.prazo_finalizacao, 'YYYY-MM-DD') AS "prazoFinalizacao",
                   CASE
                       WHEN d.prazo_finalizacao IS NOT NULL
                        AND d.prazo_finalizacao < TRUNC(SYSDATE)
                       THEN 1
                       ELSE 0
                   END AS "vencida",
                   CASE
                       WHEN d.prazo_finalizacao IS NOT NULL
                        AND d.prazo_finalizacao <= TRUNC(SYSDATE) + :diasJanelaPrazo
                       THEN 1
                       ELSE 0
                   END AS "proximaPrazo"
              FROM demandas d
             INNER JOIN projetos p ON p.id = d.projeto_id
              LEFT JOIN usuarios u ON u.id = d.responsavel_id
              ${filtroPerfil}
             ORDER BY d.prazo_finalizacao ASC NULLS LAST, d.id ASC
        `;

        const binds =
            usuario.perfil === 'Administrador'
                ? { diasJanelaPrazo: DIAS_JANELA_PRAZO }
                : { usuarioId: usuario.id, diasJanelaPrazo: DIAS_JANELA_PRAZO };

        const resultado = await executarQuery<DemandaDashboardRow>(sql, binds);

        const registros = (resultado.rows ?? []).map(row => {
            const demanda: Demanda = {
                id: Number(row.id),
                titulo: row.titulo,
                descricao: row.descricao,
                tipo: row.tipo,
                prioridade: row.prioridade,
                status: row.status,
                projetoId: Number(row.projetoId),
                projetoNome: row.projetoNome,
                responsavelId: row.responsavelId !== null ? Number(row.responsavelId) : null,
                responsavelNome: row.responsavelNome,
                dataCriacao: row.dataCriacao,
                dataAtualizacao: row.dataAtualizacao,
                prazoFinalizacao: row.prazoFinalizacao
            };

            return {
                demanda,
                vencida: Number(row.vencida) === 1,
                proximaPrazo: Number(row.proximaPrazo) === 1
            };
        });

        const porStatus: Record<StatusDemanda, number> = {
            Aberta: 0,
            'Em andamento': 0,
            'Em revisão': 0,
            Concluída: 0,
            Cancelada: 0
        };

        const porPrioridade: Record<PrioridadeDemanda, number> = {
            Crítica: 0,
            Alta: 0,
            Média: 0,
            Baixa: 0
        };

        const porTipo: Record<TipoDemanda, number> = {
            Tarefa: 0,
            Defeito: 0,
            Melhoria: 0,
            Documentação: 0
        };

        for (const { demanda } of registros) {
            if (porStatus[demanda.status] !== undefined) porStatus[demanda.status]++;
            if (porPrioridade[demanda.prioridade] !== undefined) porPrioridade[demanda.prioridade]++;
            if (porTipo[demanda.tipo] !== undefined) porTipo[demanda.tipo]++;
        }

        const demandasCriticasEmAberto: Demanda[] = registros
            .filter(
                ({ demanda }) =>
                    demanda.prioridade === 'Crítica' && STATUS_EM_ABERTO.includes(demanda.status)
            )
            .map(({ demanda }) => demanda)
            .sort(compararPorPrazoAsc);

        const demandasProximasPrazo: DemandaProximaPrazo[] = registros
            .filter(
                ({ demanda, proximaPrazo }) =>
                    STATUS_EM_ABERTO.includes(demanda.status) &&
                    demanda.prazoFinalizacao !== null &&
                    proximaPrazo
            )
            .map(({ demanda, vencida }) => ({
                ...demanda,
                vencida
            }))
            .sort(compararPorPrazoAsc);

        const resumo: ResumoDashboard = {
            totalDemandas: registros.length,
            porStatus,
            porPrioridade,
            porTipo,
            demandasCriticasEmAberto,
            demandasProximasPrazo,
            criterios: {
                emAberto:
                    "Demandas ativas no fluxo: 'Aberta', 'Em andamento' ou 'Em revisão' (exclui 'Concluída' e 'Cancelada').",
                proximasDoPrazo: `Demandas em aberto com prazo de finalização já vencido ou nos próximos ${DIAS_JANELA_PRAZO} dias (referência TRUNC(SYSDATE) no Oracle), ordenadas do prazo mais urgente ao mais distante.`
            }
        };

        res.status(200).json(resumo);
    } catch (erro) {
        if (ehErroConexaoOracle(erro)) {
            console.error('Erro de conexao Oracle ao carregar dashboard:', erro);
            res.status(503).json({ erro: true, mensagem: MENSAGEM_BANCO_INDISPONIVEL });
            return;
        }
        console.error('Erro ao carregar dashboard:', erro);
        res.status(500).json({ erro: true, mensagem: 'Erro interno ao gerar dashboard.' });
    }
});

export default router;
