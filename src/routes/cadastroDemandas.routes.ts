// Autor: Abdallah Ali Borges El Khatib
// Rotas de cadastro (POST /demandas) e edicao (PUT /demandas/:id) com integracao Oracle

import oracledb from 'oracledb';
import { Router, Request, Response } from 'express';
import {
    comTransacao,
    ErroBancoIndisponivel,
    executarQuery
} from '../config/database';
import {
    autenticarToken,
    exigirPerfis,
    usuarioTemAcessoAoProjeto
} from '../middlewares/auth';
import {
    ErroApiFeriado,
    validarFormatoDataIso,
    verificarFeriadoNacional
} from '../services/feriadoService';
import { registrarHistorico } from '../services/historicoService';
import { Demanda, PrioridadeDemanda, TipoDemanda } from '../types';

const router = Router();

function normalizarTexto(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

const MAPA_TIPOS: Record<string, TipoDemanda> = {
    tarefa: 'Tarefa',
    defeito: 'Defeito',
    melhoria: 'Melhoria',
    documentacao: 'Documentação'
};

const MAPA_PRIORIDADES: Record<string, PrioridadeDemanda> = {
    critica: 'Crítica',
    alta: 'Alta',
    media: 'Média',
    baixa: 'Baixa'
};

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

function mapearDemanda(row: Demanda): Demanda {
    return {
        ...row,
        id: Number(row.id),
        projetoId: Number(row.projetoId),
        responsavelId: row.responsavelId !== null ? Number(row.responsavelId) : null
    };
}

interface DadosValidados {
    titulo: string;
    descricao: string;
    tipo: TipoDemanda;
    prioridade: PrioridadeDemanda;
    projetoId: number;
    responsavelId: number | null;
    responsavelNome: string | null;
    prazoFinalizacao: string | null;
}

async function validarDadosDemanda(
    body: Record<string, unknown>,
    usuarioLogadoId: number,
    perfilLogado: string
): Promise<{ erroStatus?: number; erroMensagem?: string; dados?: DadosValidados }> {
    const {
        titulo,
        descricao,
        tipo,
        prioridade,
        projetoId,
        responsavelId,
        prazoFinalizacao
    } = body;

    if (!titulo || typeof titulo !== 'string' || titulo.trim() === '') {
        return { erroStatus: 400, erroMensagem: 'O titulo da demanda e obrigatorio.' };
    }
    if (!descricao || typeof descricao !== 'string' || descricao.trim() === '') {
        return { erroStatus: 400, erroMensagem: 'A descricao detalhada da demanda e obrigatoria.' };
    }
    if (!tipo || typeof tipo !== 'string' || tipo.trim() === '') {
        return { erroStatus: 400, erroMensagem: 'O tipo da demanda e obrigatorio.' };
    }
    if (!prioridade || typeof prioridade !== 'string' || prioridade.trim() === '') {
        return { erroStatus: 400, erroMensagem: 'A prioridade da demanda e obrigatoria.' };
    }

    const tipoValido = MAPA_TIPOS[normalizarTexto(tipo)];
    if (!tipoValido) {
        return {
            erroStatus: 400,
            erroMensagem: 'Tipo de demanda invalido. Valores aceitos: Tarefa, Defeito, Melhoria, Documentação.'
        };
    }

    const prioridadeValida = MAPA_PRIORIDADES[normalizarTexto(prioridade)];
    if (!prioridadeValida) {
        return {
            erroStatus: 400,
            erroMensagem: 'Prioridade invalida. Valores aceitos: Crítica, Alta, Média, Baixa.'
        };
    }

    const projetoIdNum = Number(projetoId);
    if (!projetoId || !Number.isInteger(projetoIdNum) || projetoIdNum <= 0) {
        return { erroStatus: 400, erroMensagem: 'O projeto vinculado e obrigatorio e deve ser um ID valido.' };
    }

    const resProjeto = await executarQuery<{ id: number }>(
        'SELECT id AS "id" FROM projetos WHERE id = :id',
        { id: projetoIdNum }
    );
    if (!resProjeto.rows?.length) {
        return { erroStatus: 400, erroMensagem: 'Projeto informado nao foi encontrado.' };
    }

    const temAcesso = await usuarioTemAcessoAoProjeto(
        { id: usuarioLogadoId, nome: '', email: '', perfil: perfilLogado as never },
        projetoIdNum
    );
    if (!temAcesso) {
        return { erroStatus: 403, erroMensagem: 'Voce nao esta vinculado ao projeto informado.' };
    }

    let respIdNum: number | null = null;
    let respNome: string | null = null;
    if (responsavelId !== undefined && responsavelId !== null && String(responsavelId).trim() !== '') {
        respIdNum = Number(responsavelId);
        if (!Number.isInteger(respIdNum) || respIdNum <= 0) {
            return { erroStatus: 400, erroMensagem: 'O responsavel informado e invalido.' };
        }

        const resUsuario = await executarQuery<{ id: number; nome: string }>(
            'SELECT id AS "id", nome AS "nome" FROM usuarios WHERE id = :id',
            { id: respIdNum }
        );
        const usuarioEncontrado = resUsuario.rows?.[0];
        if (!usuarioEncontrado) {
            return { erroStatus: 400, erroMensagem: 'Responsavel informado nao existe no sistema.' };
        }
        respNome = usuarioEncontrado.nome;
    }

    let prazoFinal: string | null = null;
    if (prazoFinalizacao !== undefined && prazoFinalizacao !== null && String(prazoFinalizacao).trim() !== '') {
        const prazoStr = String(prazoFinalizacao).trim();
        if (!validarFormatoDataIso(prazoStr)) {
            return {
                erroStatus: 400,
                erroMensagem: 'Prazo de finalizacao invalido. Utilize o formato YYYY-MM-DD.'
            };
        }

        const feriado = await verificarFeriadoNacional(prazoStr);
        if (feriado.ehFeriado) {
            return {
                erroStatus: 400,
                erroMensagem: `Nao e permitido definir o prazo de finalizacao em feriado nacional (${feriado.nome}).`
            };
        }

        prazoFinal = prazoStr;
    }

    return {
        dados: {
            titulo: titulo.trim(),
            descricao: descricao.trim(),
            tipo: tipoValido,
            prioridade: prioridadeValida,
            projetoId: projetoIdNum,
            responsavelId: respIdNum,
            responsavelNome: respNome,
            prazoFinalizacao: prazoFinal
        }
    };
}

router.post(
    '/',
    autenticarToken,
    exigirPerfis('Administrador', 'Líder de Projeto'),
    async (req: Request, res: Response) => {
        try {
            const usuario = req.usuario!;
            const validacao = await validarDadosDemanda(
                (req.body || {}) as Record<string, unknown>,
                usuario.id,
                usuario.perfil
            );

            if (validacao.erroStatus || !validacao.dados) {
                res.status(validacao.erroStatus || 400).json({
                    erro: true,
                    mensagem: validacao.erroMensagem
                });
                return;
            }

            const { dados } = validacao;

            const resultado = await executarQuery<{ id: number[] }>(
                `INSERT INTO demandas (
                    titulo,
                    descricao,
                    tipo,
                    prioridade,
                    status,
                    projeto_id,
                    responsavel_id,
                    prazo_finalizacao
                ) VALUES (
                    :titulo,
                    :descricao,
                    :tipo,
                    :prioridade,
                    'Aberta',
                    :projetoId,
                    :responsavelId,
                    TO_DATE(:prazoFinalizacao, 'YYYY-MM-DD')
                ) RETURNING id INTO :id`,
                {
                    titulo: dados.titulo,
                    descricao: dados.descricao,
                    tipo: dados.tipo,
                    prioridade: dados.prioridade,
                    projetoId: dados.projetoId,
                    responsavelId: dados.responsavelId,
                    prazoFinalizacao: dados.prazoFinalizacao,
                    id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
                }
            );

            const novoId = Number(resultado.outBinds?.id?.[0]);
            const resDemanda = await executarQuery<Demanda>(SQL_BUSCAR_DEMANDA, { id: novoId });
            const demandaCriada = mapearDemanda(resDemanda.rows![0]);

            res.status(201).json({
                mensagem: 'Demanda cadastrada com sucesso.',
                demanda: demandaCriada
            });
        } catch (erro) {
            if (erro instanceof ErroBancoIndisponivel || erro instanceof ErroApiFeriado) {
                res.status(503).json({ erro: true, mensagem: erro.message });
                return;
            }
            console.error('Erro ao cadastrar demanda:', erro);
            res.status(500).json({ erro: true, mensagem: 'Erro interno ao cadastrar demanda.' });
        }
    }
);

router.put(
    '/:id',
    autenticarToken,
    exigirPerfis('Administrador', 'Líder de Projeto'),
    async (req: Request, res: Response) => {
        try {
            const usuario = req.usuario!;
            const idDemanda = Number(req.params.id);

            if (!Number.isInteger(idDemanda) || idDemanda <= 0) {
                res.status(400).json({ erro: true, mensagem: 'ID da demanda invalido.' });
                return;
            }

            const resAtual = await executarQuery<Demanda>(SQL_BUSCAR_DEMANDA, { id: idDemanda });
            const rowAtual = resAtual.rows?.[0];
            if (!rowAtual) {
                res.status(404).json({ erro: true, mensagem: 'Demanda nao encontrada.' });
                return;
            }

            const demandaAtual = mapearDemanda(rowAtual);

            const acessoProjetoAtual = await usuarioTemAcessoAoProjeto(usuario, demandaAtual.projetoId);
            if (!acessoProjetoAtual) {
                res.status(403).json({
                    erro: true,
                    mensagem: 'Voce nao possui permissao para editar demandas deste projeto.'
                });
                return;
            }

            if (demandaAtual.status === 'Concluída' || demandaAtual.status === 'Cancelada') {
                res.status(400).json({
                    erro: true,
                    mensagem: `Nao e possivel editar uma demanda com status ${demandaAtual.status}.`
                });
                return;
            }

            const validacao = await validarDadosDemanda(
                (req.body || {}) as Record<string, unknown>,
                usuario.id,
                usuario.perfil
            );

            if (validacao.erroStatus || !validacao.dados) {
                res.status(validacao.erroStatus || 400).json({
                    erro: true,
                    mensagem: validacao.erroMensagem
                });
                return;
            }

            const { dados } = validacao;

            await comTransacao(async conn => {
                await conn.execute(
                    `UPDATE demandas
                        SET titulo = :titulo,
                            descricao = :descricao,
                            tipo = :tipo,
                            prioridade = :prioridade,
                            projeto_id = :projetoId,
                            responsavel_id = :responsavelId,
                            prazo_finalizacao = TO_DATE(:prazoFinalizacao, 'YYYY-MM-DD'),
                            data_atualizacao = CURRENT_TIMESTAMP
                      WHERE id = :id`,
                    {
                        titulo: dados.titulo,
                        descricao: dados.descricao,
                        tipo: dados.tipo,
                        prioridade: dados.prioridade,
                        projetoId: dados.projetoId,
                        responsavelId: dados.responsavelId,
                        prazoFinalizacao: dados.prazoFinalizacao,
                        id: idDemanda
                    }
                );

                // Registra historico das alteracoes relevantes previstas no escopo
                if (demandaAtual.responsavelId !== dados.responsavelId) {
                    const anterior = demandaAtual.responsavelNome || 'Sem responsavel';
                    const novo = dados.responsavelNome || 'Sem responsavel';
                    await registrarHistorico(
                        {
                            demandaId: idDemanda,
                            usuarioId: usuario.id,
                            campoAlterado: 'responsavel',
                            valorAnterior: anterior,
                            valorNovo: novo,
                            descricao: `${usuario.nome} alterou o responsavel de ${anterior} para ${novo}.`
                        },
                        conn
                    );
                }

                if (demandaAtual.prioridade !== dados.prioridade) {
                    await registrarHistorico(
                        {
                            demandaId: idDemanda,
                            usuarioId: usuario.id,
                            campoAlterado: 'prioridade',
                            valorAnterior: demandaAtual.prioridade,
                            valorNovo: dados.prioridade,
                            descricao: `${usuario.nome} alterou a prioridade de ${demandaAtual.prioridade} para ${dados.prioridade}.`
                        },
                        conn
                    );
                }

                if (demandaAtual.prazoFinalizacao !== dados.prazoFinalizacao) {
                    const anterior = demandaAtual.prazoFinalizacao || 'Sem prazo';
                    const novo = dados.prazoFinalizacao || 'Sem prazo';
                    await registrarHistorico(
                        {
                            demandaId: idDemanda,
                            usuarioId: usuario.id,
                            campoAlterado: 'prazoFinalizacao',
                            valorAnterior: anterior,
                            valorNovo: novo,
                            descricao: `${usuario.nome} alterou o prazo de finalizacao de ${anterior} para ${novo}.`
                        },
                        conn
                    );
                }
            });

            const resAtualizada = await executarQuery<Demanda>(SQL_BUSCAR_DEMANDA, { id: idDemanda });
            const demandaAtualizada = mapearDemanda(resAtualizada.rows![0]);

            res.status(200).json({
                mensagem: 'Demanda atualizada com sucesso.',
                demanda: demandaAtualizada
            });
        } catch (erro) {
            if (erro instanceof ErroBancoIndisponivel || erro instanceof ErroApiFeriado) {
                res.status(503).json({ erro: true, mensagem: erro.message });
                return;
            }
            console.error('Erro ao editar demanda:', erro);
            res.status(500).json({ erro: true, mensagem: 'Erro interno ao atualizar demanda.' });
        }
    }
);

export default router;
