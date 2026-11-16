// Autor: Vinicius Morais

import { Router, Request, Response } from 'express';
import oracledb from 'oracledb';
import { comTransacao, ErroBancoIndisponivel, executarQuery } from '../config/database';
import { autenticarToken, exigirPerfis, usuarioTemAcessoAoProjeto } from '../middlewares/auth';
import { registrarHistorico } from '../services/historicoService';
import { Comentario, Demanda, HistoricoAlteracao, StatusDemanda, UsuarioPublico } from '../types';

const router = Router();

const TAMANHO_MAXIMO_COMENTARIO = 1000;

const SQL_BUSCAR_DEMANDA = `
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
     WHERE d.id = :id
`;

const TRANSICOES_PERMITIDAS: Record<StatusDemanda, StatusDemanda[]> = {
    'Aberta': ['Em andamento'],
    'Em andamento': ['Em revisão'],
    'Em revisão': ['Concluída', 'Em andamento'],
    'Concluída': [],
    'Cancelada': []
};

const TRANSICOES_MEMBRO: Partial<Record<StatusDemanda, StatusDemanda[]>> = {
    'Aberta': ['Em andamento'],
    'Em andamento': ['Em revisão']
};

const MAPA_STATUS: Record<string, StatusDemanda> = {
    'aberta': 'Aberta',
    'em andamento': 'Em andamento',
    'em revisao': 'Em revisão',
    'concluida': 'Concluída',
    'cancelada': 'Cancelada'
};

function normalizarTexto(valor: string): string {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function lerIdDemanda(valor: string): number | null {
    if (!/^\d+$/.test(valor)) {
        return null;
    }
    const numero = Number(valor);
    return numero > 0 ? numero : null;
}

function mapearDemanda(row: Demanda): Demanda {
    return {
        ...row,
        id: Number(row.id),
        projetoId: Number(row.projetoId),
        responsavelId: row.responsavelId !== null ? Number(row.responsavelId) : null
    };
}

async function buscarDemanda(id: number): Promise<Demanda | null> {
    const resultado = await executarQuery<Demanda>(SQL_BUSCAR_DEMANDA, { id });
    const row = resultado.rows?.[0];
    return row ? mapearDemanda(row) : null;
}

interface ResultadoCarregamento {
    demanda?: Demanda;
    status?: number;
    mensagem?: string;
}

async function carregarDemandaComAcesso(idUrl: string, usuario: UsuarioPublico): Promise<ResultadoCarregamento> {
    const id = lerIdDemanda(idUrl);
    if (id === null) {
        return { status: 400, mensagem: 'ID da demanda invalido.' };
    }

    const demanda = await buscarDemanda(id);
    if (!demanda) {
        return { status: 404, mensagem: 'Demanda nao encontrada.' };
    }

    const temAcesso = await usuarioTemAcessoAoProjeto(usuario, demanda.projetoId);
    if (!temAcesso) {
        return { status: 403, mensagem: 'Voce nao esta vinculado ao projeto desta demanda.' };
    }

    return { demanda };
}

function tratarErro(res: Response, erro: unknown, contexto: string): void {
    if (erro instanceof ErroBancoIndisponivel) {
        res.status(503).json({ erro: true, mensagem: erro.message });
        return;
    }
    console.error(`Erro ao ${contexto}:`, erro);
    res.status(500).json({ erro: true, mensagem: `Erro interno ao ${contexto}.` });
}

router.get('/:id', autenticarToken, async (req: Request, res: Response) => {
    try {
        const carregamento = await carregarDemandaComAcesso(String(req.params.id), req.usuario!);
        if (!carregamento.demanda) {
            res.status(carregamento.status!).json({ erro: true, mensagem: carregamento.mensagem });
            return;
        }

        res.status(200).json({ demanda: carregamento.demanda });
    } catch (erro) {
        tratarErro(res, erro, 'consultar demanda');
    }
});

router.get('/:id/comentarios', autenticarToken, async (req: Request, res: Response) => {
    try {
        const carregamento = await carregarDemandaComAcesso(String(req.params.id), req.usuario!);
        if (!carregamento.demanda) {
            res.status(carregamento.status!).json({ erro: true, mensagem: carregamento.mensagem });
            return;
        }

        const resultado = await executarQuery<Comentario>(
            `SELECT c.id AS "id",
                    c.demanda_id AS "demandaId",
                    c.usuario_id AS "usuarioId",
                    u.nome AS "usuarioNome",
                    c.texto AS "texto",
                    TO_CHAR(c.data_criacao, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "dataCriacao"
               FROM comentarios c
              INNER JOIN usuarios u ON u.id = c.usuario_id
              WHERE c.demanda_id = :demandaId
              ORDER BY c.data_criacao ASC, c.id ASC`,
            { demandaId: carregamento.demanda.id }
        );

        const comentarios = (resultado.rows ?? []).map(c => ({
            ...c,
            id: Number(c.id),
            demandaId: Number(c.demandaId),
            usuarioId: Number(c.usuarioId)
        }));

        res.status(200).json({ total: comentarios.length, comentarios });
    } catch (erro) {
        tratarErro(res, erro, 'listar comentarios');
    }
});

router.post('/:id/comentarios', autenticarToken, async (req: Request, res: Response) => {
    try {
        const usuario = req.usuario!;
        const carregamento = await carregarDemandaComAcesso(String(req.params.id), usuario);
        if (!carregamento.demanda) {
            res.status(carregamento.status!).json({ erro: true, mensagem: carregamento.mensagem });
            return;
        }

        const corpo = (req.body || {}) as Record<string, unknown>;
        const texto = typeof corpo.texto === 'string' ? corpo.texto.trim() : '';
        if (texto === '') {
            res.status(400).json({ erro: true, mensagem: 'O texto do comentario nao pode ficar vazio.' });
            return;
        }
        if (texto.length > TAMANHO_MAXIMO_COMENTARIO) {
            res.status(400).json({
                erro: true,
                mensagem: `O comentario pode ter no maximo ${TAMANHO_MAXIMO_COMENTARIO} caracteres.`
            });
            return;
        }

        const resultado = await executarQuery<{ id: number[] }>(
            `INSERT INTO comentarios (demanda_id, usuario_id, texto)
             VALUES (:demandaId, :usuarioId, :texto)
             RETURNING id INTO :id`,
            {
                demandaId: carregamento.demanda.id,
                usuarioId: usuario.id,
                texto,
                id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
            }
        );

        const novoId = Number(resultado.outBinds?.id?.[0]);
        const resComentario = await executarQuery<Comentario>(
            `SELECT c.id AS "id",
                    c.demanda_id AS "demandaId",
                    c.usuario_id AS "usuarioId",
                    u.nome AS "usuarioNome",
                    c.texto AS "texto",
                    TO_CHAR(c.data_criacao, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "dataCriacao"
               FROM comentarios c
              INNER JOIN usuarios u ON u.id = c.usuario_id
              WHERE c.id = :id`,
            { id: novoId }
        );

        const row = resComentario.rows![0];
        res.status(201).json({
            mensagem: 'Comentario registrado com sucesso.',
            comentario: {
                ...row,
                id: Number(row.id),
                demandaId: Number(row.demandaId),
                usuarioId: Number(row.usuarioId)
            }
        });
    } catch (erro) {
        tratarErro(res, erro, 'registrar comentario');
    }
});

router.get('/:id/historico', autenticarToken, async (req: Request, res: Response) => {
    try {
        const carregamento = await carregarDemandaComAcesso(String(req.params.id), req.usuario!);
        if (!carregamento.demanda) {
            res.status(carregamento.status!).json({ erro: true, mensagem: carregamento.mensagem });
            return;
        }

        const resultado = await executarQuery<HistoricoAlteracao>(
            `SELECT h.id AS "id",
                    h.demanda_id AS "demandaId",
                    h.usuario_id AS "usuarioId",
                    u.nome AS "usuarioNome",
                    h.campo_alterado AS "campoAlterado",
                    h.valor_anterior AS "valorAnterior",
                    h.valor_novo AS "valorNovo",
                    h.descricao AS "descricao",
                    TO_CHAR(h.data_alteracao, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "dataAlteracao"
               FROM historico_alteracoes h
              INNER JOIN usuarios u ON u.id = h.usuario_id
              WHERE h.demanda_id = :demandaId
              ORDER BY h.data_alteracao DESC, h.id DESC`,
            { demandaId: carregamento.demanda.id }
        );

        const historico = (resultado.rows ?? []).map(h => ({
            ...h,
            id: Number(h.id),
            demandaId: Number(h.demandaId),
            usuarioId: Number(h.usuarioId)
        }));

        res.status(200).json({ total: historico.length, historico });
    } catch (erro) {
        tratarErro(res, erro, 'listar historico');
    }
});

async function aplicarNovoStatus(
    demanda: Demanda,
    novoStatus: StatusDemanda,
    usuario: UsuarioPublico,
    descricao: string
): Promise<boolean> {
    return comTransacao(async conn => {
        const atualizacao = await conn.execute(
            `UPDATE demandas
                SET status = :novoStatus,
                    data_atualizacao = CURRENT_TIMESTAMP
              WHERE id = :id
                AND status = :statusAtual`,
            { novoStatus, id: demanda.id, statusAtual: demanda.status }
        );

        if (!atualizacao.rowsAffected) {
            return false;
        }

        await registrarHistorico(
            {
                demandaId: demanda.id,
                usuarioId: usuario.id,
                campoAlterado: 'status',
                valorAnterior: demanda.status,
                valorNovo: novoStatus,
                descricao
            },
            conn
        );

        return true;
    });
}

router.patch('/:id/status', autenticarToken, async (req: Request, res: Response) => {
    try {
        const usuario = req.usuario!;
        const corpo = (req.body || {}) as Record<string, unknown>;
        const statusInformado = typeof corpo.status === 'string' ? corpo.status : '';
        const novoStatus = MAPA_STATUS[normalizarTexto(statusInformado)];

        if (lerIdDemanda(String(req.params.id)) === null) {
            res.status(400).json({ erro: true, mensagem: 'ID da demanda invalido.' });
            return;
        }
        if (!novoStatus) {
            res.status(400).json({
                erro: true,
                mensagem: 'Status invalido. Valores aceitos: Aberta, Em andamento, Em revisão, Concluída.'
            });
            return;
        }

        const carregamento = await carregarDemandaComAcesso(String(req.params.id), usuario);
        if (!carregamento.demanda) {
            res.status(carregamento.status!).json({ erro: true, mensagem: carregamento.mensagem });
            return;
        }
        const demanda = carregamento.demanda;

        if (usuario.perfil === 'Membro da Equipe' && demanda.responsavelId !== usuario.id) {
            res.status(403).json({
                erro: true,
                mensagem: 'Membros da equipe so podem alterar o status de demandas sob sua responsabilidade.'
            });
            return;
        }

        if (demanda.status === 'Concluída' || demanda.status === 'Cancelada') {
            res.status(400).json({
                erro: true,
                mensagem: `Nao e possivel alterar o status de uma demanda ${demanda.status}.`
            });
            return;
        }

        if (novoStatus === 'Cancelada') {
            res.status(400).json({
                erro: true,
                mensagem: 'Para cancelar a demanda utilize a acao de cancelamento.'
            });
            return;
        }

        if (!TRANSICOES_PERMITIDAS[demanda.status].includes(novoStatus)) {
            res.status(400).json({
                erro: true,
                mensagem: `Transicao de status nao permitida: ${demanda.status} para ${novoStatus}.`
            });
            return;
        }

        if (usuario.perfil === 'Membro da Equipe') {
            const permitidasMembro = TRANSICOES_MEMBRO[demanda.status] ?? [];
            if (!permitidasMembro.includes(novoStatus)) {
                res.status(403).json({
                    erro: true,
                    mensagem: `Seu perfil nao pode alterar o status de ${demanda.status} para ${novoStatus}.`
                });
                return;
            }
        }

        const atualizou = await aplicarNovoStatus(
            demanda,
            novoStatus,
            usuario,
            `${usuario.nome} alterou o status de ${demanda.status} para ${novoStatus}.`
        );

        if (!atualizou) {
            res.status(409).json({
                erro: true,
                mensagem: 'A demanda foi alterada por outro usuario. Atualize a pagina e tente novamente.'
            });
            return;
        }

        const demandaAtualizada = await buscarDemanda(demanda.id);
        res.status(200).json({
            mensagem: `Status alterado para ${novoStatus}.`,
            demanda: demandaAtualizada
        });
    } catch (erro) {
        tratarErro(res, erro, 'alterar status da demanda');
    }
});

router.patch(
    '/:id/cancelar',
    autenticarToken,
    exigirPerfis('Administrador', 'Líder de Projeto'),
    async (req: Request, res: Response) => {
        try {
            const usuario = req.usuario!;
            const carregamento = await carregarDemandaComAcesso(String(req.params.id), usuario);
            if (!carregamento.demanda) {
                res.status(carregamento.status!).json({ erro: true, mensagem: carregamento.mensagem });
                return;
            }
            const demanda = carregamento.demanda;

            if (demanda.status === 'Concluída') {
                res.status(400).json({ erro: true, mensagem: 'Nao e possivel cancelar uma demanda Concluída.' });
                return;
            }
            if (demanda.status === 'Cancelada') {
                res.status(400).json({ erro: true, mensagem: 'A demanda ja esta Cancelada.' });
                return;
            }

            const atualizou = await aplicarNovoStatus(
                demanda,
                'Cancelada',
                usuario,
                `${usuario.nome} cancelou a demanda (status anterior: ${demanda.status}).`
            );

            if (!atualizou) {
                res.status(409).json({
                    erro: true,
                    mensagem: 'A demanda foi alterada por outro usuario. Atualize a pagina e tente novamente.'
                });
                return;
            }

            const demandaAtualizada = await buscarDemanda(demanda.id);
            res.status(200).json({
                mensagem: 'Demanda cancelada com sucesso.',
                demanda: demandaAtualizada
            });
        } catch (erro) {
            tratarErro(res, erro, 'cancelar demanda');
        }
    }
);

export default router;
