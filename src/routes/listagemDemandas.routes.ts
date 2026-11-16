// Autor: Vinicius Morais

import { Router, Request, Response } from 'express';
import { ErroBancoIndisponivel, executarQuery } from '../config/database';
import { autenticarToken } from '../middlewares/auth';
import { Demanda, PrioridadeDemanda, StatusDemanda, TipoDemanda } from '../types';

const router = Router();

function normalizarTexto(valor: string): string {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

const MAPA_STATUS: Record<string, StatusDemanda> = {
    'aberta': 'Aberta',
    'em andamento': 'Em andamento',
    'em revisao': 'Em revisão',
    'concluida': 'Concluída',
    'cancelada': 'Cancelada'
};

const MAPA_PRIORIDADES: Record<string, PrioridadeDemanda> = {
    critica: 'Crítica',
    alta: 'Alta',
    media: 'Média',
    baixa: 'Baixa'
};

const MAPA_TIPOS: Record<string, TipoDemanda> = {
    tarefa: 'Tarefa',
    defeito: 'Defeito',
    melhoria: 'Melhoria',
    documentacao: 'Documentação'
};

const ORDENACOES: Record<string, string> = {
    prioridade: `CASE d.prioridade WHEN 'Crítica' THEN 1 WHEN 'Alta' THEN 2 WHEN 'Média' THEN 3 WHEN 'Baixa' THEN 4 ELSE 5 END`,
    datacriacao: 'd.data_criacao',
    prazofinalizacao: 'd.prazo_finalizacao',
    status: `CASE d.status WHEN 'Aberta' THEN 1 WHEN 'Em andamento' THEN 2 WHEN 'Em revisão' THEN 3 WHEN 'Concluída' THEN 4 WHEN 'Cancelada' THEN 5 ELSE 6 END`
};

const DIRECAO_PADRAO: Record<string, 'ASC' | 'DESC'> = {
    prioridade: 'ASC',
    datacriacao: 'DESC',
    prazofinalizacao: 'ASC',
    status: 'ASC'
};

function lerParametro(valor: unknown): string {
    if (Array.isArray(valor)) {
        return lerParametro(valor[0]);
    }
    return typeof valor === 'string' ? valor.trim() : '';
}

function lerIdPositivo(valor: string): number | null {
    if (!/^\d+$/.test(valor)) {
        return null;
    }
    const numero = Number(valor);
    return numero > 0 ? numero : null;
}

router.get('/', autenticarToken, async (req: Request, res: Response) => {
    try {
        const usuario = req.usuario!;
        const condicoes: string[] = [];
        const binds: Record<string, string | number> = {};

        if (usuario.perfil !== 'Administrador') {
            condicoes.push(
                'EXISTS (SELECT 1 FROM usuario_projeto up WHERE up.projeto_id = d.projeto_id AND up.usuario_id = :usuarioLogadoId)'
            );
            binds.usuarioLogadoId = usuario.id;
        }

        const statusParam = lerParametro(req.query.status);
        if (statusParam) {
            const status = MAPA_STATUS[normalizarTexto(statusParam)];
            if (!status) {
                res.status(400).json({
                    erro: true,
                    mensagem: 'Status invalido. Valores aceitos: Aberta, Em andamento, Em revisão, Concluída, Cancelada.'
                });
                return;
            }
            condicoes.push('d.status = :status');
            binds.status = status;
        }

        const prioridadeParam = lerParametro(req.query.prioridade);
        if (prioridadeParam) {
            const prioridade = MAPA_PRIORIDADES[normalizarTexto(prioridadeParam)];
            if (!prioridade) {
                res.status(400).json({
                    erro: true,
                    mensagem: 'Prioridade invalida. Valores aceitos: Crítica, Alta, Média, Baixa.'
                });
                return;
            }
            condicoes.push('d.prioridade = :prioridade');
            binds.prioridade = prioridade;
        }

        const tipoParam = lerParametro(req.query.tipo);
        if (tipoParam) {
            const tipo = MAPA_TIPOS[normalizarTexto(tipoParam)];
            if (!tipo) {
                res.status(400).json({
                    erro: true,
                    mensagem: 'Tipo invalido. Valores aceitos: Tarefa, Defeito, Melhoria, Documentação.'
                });
                return;
            }
            condicoes.push('d.tipo = :tipo');
            binds.tipo = tipo;
        }

        const responsavelParam = lerParametro(req.query.responsavelId);
        if (responsavelParam) {
            const responsavelId = lerIdPositivo(responsavelParam);
            if (responsavelId === null) {
                res.status(400).json({ erro: true, mensagem: 'O responsavelId informado e invalido.' });
                return;
            }
            condicoes.push('d.responsavel_id = :responsavelId');
            binds.responsavelId = responsavelId;
        }

        const projetoParam = lerParametro(req.query.projetoId);
        if (projetoParam) {
            const projetoId = lerIdPositivo(projetoParam);
            if (projetoId === null) {
                res.status(400).json({ erro: true, mensagem: 'O projetoId informado e invalido.' });
                return;
            }
            condicoes.push('d.projeto_id = :projetoId');
            binds.projetoId = projetoId;
        }

        const busca = lerParametro(req.query.busca);
        if (busca) {
            condicoes.push('(LOWER(d.titulo) LIKE :busca OR LOWER(d.descricao) LIKE :busca)');
            binds.busca = `%${busca.toLowerCase()}%`;
        }

        const ordenarParam = normalizarTexto(lerParametro(req.query.ordenarPor) || 'dataCriacao');
        const expressaoOrdem = ORDENACOES[ordenarParam];
        if (!expressaoOrdem) {
            res.status(400).json({
                erro: true,
                mensagem: 'Ordenacao invalida. Valores aceitos: prioridade, dataCriacao, prazoFinalizacao, status.'
            });
            return;
        }

        const ordemParam = lerParametro(req.query.ordem).toUpperCase();
        const direcao = ordemParam === 'ASC' || ordemParam === 'DESC' ? ordemParam : DIRECAO_PADRAO[ordenarParam];

        const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

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
             ${where}
             ORDER BY ${expressaoOrdem} ${direcao} NULLS LAST, d.id DESC
        `;

        const resultado = await executarQuery<Demanda>(sql, binds);

        const demandas = (resultado.rows ?? []).map(row => ({
            ...row,
            id: Number(row.id),
            projetoId: Number(row.projetoId),
            responsavelId: row.responsavelId !== null ? Number(row.responsavelId) : null
        }));

        res.status(200).json({
            total: demandas.length,
            demandas
        });
    } catch (erro) {
        if (erro instanceof ErroBancoIndisponivel) {
            res.status(503).json({ erro: true, mensagem: erro.message });
            return;
        }
        console.error('Erro ao listar demandas:', erro);
        res.status(500).json({ erro: true, mensagem: 'Erro interno ao listar demandas.' });
    }
});

export default router;
