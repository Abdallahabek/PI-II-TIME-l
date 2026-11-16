// Autor: Abdallah Ali Borges El Khatib
// Rota GET /dashboard com indicadores calculados a partir do banco Oracle

import { Router, Request, Response } from 'express';
import { ErroBancoIndisponivel, executarQuery } from '../config/database';
import { autenticarToken } from '../middlewares/auth';
import {
    Demanda,
    PrioridadeDemanda,
    ResumoDashboard,
    StatusDemanda,
    TipoDemanda
} from '../types';

const router = Router();

const STATUS_EM_ABERTO: StatusDemanda[] = ['Aberta', 'Em andamento', 'Em revisão'];
const DIAS_JANELA_PRAZO = 7;

function formatarDataLocalIso(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// Retorna totais por status/prioridade/tipo, criticas em aberto e proximas do prazo
router.get('/', autenticarToken, async (req: Request, res: Response) => {
    try {
        const usuario = req.usuario!;

        const filtroPerfil =
            usuario.perfil === 'Administrador'
                ? ''
                : 'INNER JOIN usuario_projeto up ON up.projeto_id = d.projeto_id AND up.usuario_id = :usuarioId';

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
                   TO_CHAR(d.prazo_finalizacao, 'YYYY-MM-DD') AS "prazoFinalizacao"
              FROM demandas d
             INNER JOIN projetos p ON p.id = d.projeto_id
              LEFT JOIN usuarios u ON u.id = d.responsavel_id
              ${filtroPerfil}
             ORDER BY d.id DESC
        `;

        const binds = usuario.perfil === 'Administrador' ? {} : { usuarioId: usuario.id };
        const resultado = await executarQuery<Demanda>(sql, binds);

        const demandas = (resultado.rows ?? []).map(d => ({
            ...d,
            id: Number(d.id),
            projetoId: Number(d.projetoId),
            responsavelId: d.responsavelId !== null ? Number(d.responsavelId) : null
        }));

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

        for (const d of demandas) {
            if (porStatus[d.status] !== undefined) porStatus[d.status]++;
            if (porPrioridade[d.prioridade] !== undefined) porPrioridade[d.prioridade]++;
            if (porTipo[d.tipo] !== undefined) porTipo[d.tipo]++;
        }

        const demandasCriticasEmAberto = demandas.filter(
            d => d.prioridade === 'Crítica' && STATUS_EM_ABERTO.includes(d.status)
        );

        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() + DIAS_JANELA_PRAZO);
        const limiteIso = formatarDataLocalIso(dataLimite);

        const demandasProximasPrazo = demandas.filter(d => {
            if (!STATUS_EM_ABERTO.includes(d.status) || !d.prazoFinalizacao) {
                return false;
            }
            return d.prazoFinalizacao <= limiteIso;
        });

        const resumo: ResumoDashboard = {
            totalDemandas: demandas.length,
            porStatus,
            porPrioridade,
            porTipo,
            demandasCriticasEmAberto,
            demandasProximasPrazo,
            criterios: {
                emAberto:
                    "Demandas ativas no fluxo: 'Aberta', 'Em andamento' ou 'Em revisão' (exclui 'Concluída' e 'Cancelada').",
                proximasDoPrazo: `Demandas em aberto com prazo de finalizacao nos proximos ${DIAS_JANELA_PRAZO} dias ou ja vencido.`
            }
        };

        res.status(200).json(resumo);
    } catch (erro) {
        if (erro instanceof ErroBancoIndisponivel) {
            res.status(503).json({ erro: true, mensagem: erro.message });
            return;
        }
        console.error('Erro ao carregar dashboard:', erro);
        res.status(500).json({ erro: true, mensagem: 'Erro interno ao gerar dashboard.' });
    }
});

export default router;
