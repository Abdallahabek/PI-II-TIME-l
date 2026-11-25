// Autor: Abdallah Ali Borges El Khatib
// Rotas de cadastro (POST /demandas) e edicao (PUT /demandas/:id) com integracao Oracle

import oracledb from 'oracledb';
import { Router, Request, Response } from 'express';
import {
    comTransacao,
    ehErroConexaoOracle,
    executarQuery
} from '../config/database';
import {
    autenticarToken,
    exigirPerfis,
    usuarioTemAcessoAoProjeto
} from '../middlewares/auth';
import {
    ErroAnoForaDaFaixa,
    ErroApiFeriado,
    validarFormatoDataIso,
    verificarFeriadoNacional
} from '../services/feriadoService';
import { registrarHistorico } from '../services/historicoService';
import {
    Demanda,
    PerfilUsuario,
    PrioridadeDemanda,
    TipoDemanda,
    UsuarioPublico
} from '../types';

const router = Router();

const TAMANHO_MAXIMO_TITULO = 200;
const TAMANHO_MAXIMO_DESCRICAO = 2000;
const MENSAGEM_BANCO_INDISPONIVEL = 'Serviço de banco de dados indisponível no momento.';

// Erro interno usado para interromper a transacao do PUT em caso de conflito concorrente
class ErroConflitoEdicao extends Error {
    constructor(mensagem: string) {
        super(mensagem);
        this.name = 'ErroConflitoEdicao';
    }
}

// Normaliza acentos e caixa para validar enums de entrada sem rejeitar variacoes de digitacao
function normalizarTexto(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

// Valida estritamente IDs inteiros positivos (rejeita booleanos, arrays, notacao cientifica e <= 0)
function lerIdPositivo(valor: unknown): number | null {
    if (typeof valor === 'number') {
        return Number.isSafeInteger(valor) && valor > 0 ? valor : null;
    }
    if (typeof valor === 'string') {
        if (!/^\d+$/.test(valor)) {
            return null;
        }
        const numero = Number(valor);
        return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
    }
    return null;
}

// Retorna a data local atual em YYYY-MM-DD para validar prazos no passado sem deslocamento UTC
function obterDataHojeIsoLocal(): string {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
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

// Consulta padrao de demanda com nomes relacionados e datas formatadas em ISO UTC / YYYY-MM-DD
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

// Garante tipagem numerica dos identificadores retornados pelo driver Oracle
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
    projetoNome: string;
    responsavelId: number | null;
    responsavelNome: string | null;
    prazoFinalizacao: string | null;
}

interface OpcoesValidacaoDemanda {
    modoEdicao: boolean;
    prazoAtual?: string | null;
}

// Valida campos obrigatorios, limites de tamanho, vinculos ao projeto e regra de prazo/feriado
async function validarDadosDemanda(
    body: Record<string, unknown>,
    usuarioLogado: UsuarioPublico,
    opcoes: OpcoesValidacaoDemanda
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
        return { erroStatus: 400, erroMensagem: 'O título da demanda é obrigatório.' };
    }
    const tituloLimpo = titulo.trim();
    if (tituloLimpo.length > TAMANHO_MAXIMO_TITULO) {
        return {
            erroStatus: 400,
            erroMensagem: `O título da demanda pode ter no máximo ${TAMANHO_MAXIMO_TITULO} caracteres.`
        };
    }

    if (!descricao || typeof descricao !== 'string' || descricao.trim() === '') {
        return { erroStatus: 400, erroMensagem: 'A descrição detalhada da demanda é obrigatória.' };
    }
    const descricaoLimpa = descricao.trim();
    if (descricaoLimpa.length > TAMANHO_MAXIMO_DESCRICAO) {
        return {
            erroStatus: 400,
            erroMensagem: `A descrição da demanda pode ter no máximo ${TAMANHO_MAXIMO_DESCRICAO} caracteres.`
        };
    }

    if (!tipo || typeof tipo !== 'string' || tipo.trim() === '') {
        return { erroStatus: 400, erroMensagem: 'O tipo da demanda é obrigatório.' };
    }
    if (!prioridade || typeof prioridade !== 'string' || prioridade.trim() === '') {
        return { erroStatus: 400, erroMensagem: 'A prioridade da demanda é obrigatória.' };
    }

    const tipoValido = MAPA_TIPOS[normalizarTexto(tipo)];
    if (!tipoValido) {
        return {
            erroStatus: 400,
            erroMensagem: 'Tipo de demanda inválido. Valores aceitos: Tarefa, Defeito, Melhoria, Documentação.'
        };
    }

    const prioridadeValida = MAPA_PRIORIDADES[normalizarTexto(prioridade)];
    if (!prioridadeValida) {
        return {
            erroStatus: 400,
            erroMensagem: 'Prioridade inválida. Valores aceitos: Crítica, Alta, Média, Baixa.'
        };
    }

    const projetoIdNum = lerIdPositivo(projetoId);
    if (projetoIdNum === null) {
        return { erroStatus: 400, erroMensagem: 'O projeto vinculado é obrigatório e deve ser um ID válido.' };
    }

    const resProjeto = await executarQuery<{ id: number; nome: string }>(
        'SELECT id AS "id", nome AS "nome" FROM projetos WHERE id = :id',
        { id: projetoIdNum }
    );
    const projetoEncontrado = resProjeto.rows?.[0];
    if (!projetoEncontrado) {
        return { erroStatus: 400, erroMensagem: 'Projeto informado não foi encontrado.' };
    }

    const temAcesso = await usuarioTemAcessoAoProjeto(usuarioLogado, projetoIdNum);
    if (!temAcesso) {
        return { erroStatus: 403, erroMensagem: 'Você não está vinculado ao projeto informado.' };
    }

    // Valida existencia do responsavel e seu vinculo ao projeto selecionado (exceto Administrador)
    let respIdNum: number | null = null;
    let respNome: string | null = null;
    const responsavelInformado =
        responsavelId !== undefined &&
        responsavelId !== null &&
        !(typeof responsavelId === 'string' && responsavelId.trim() === '');

    if (responsavelInformado) {
        respIdNum = lerIdPositivo(responsavelId);
        if (respIdNum === null) {
            return { erroStatus: 400, erroMensagem: 'O responsável informado é inválido.' };
        }

        const resUsuario = await executarQuery<{ id: number; nome: string; perfil: PerfilUsuario }>(
            'SELECT id AS "id", nome AS "nome", perfil AS "perfil" FROM usuarios WHERE id = :id',
            { id: respIdNum }
        );
        const usuarioEncontrado = resUsuario.rows?.[0];
        if (!usuarioEncontrado) {
            return { erroStatus: 400, erroMensagem: 'Responsável informado não existe no sistema.' };
        }

        if (usuarioEncontrado.perfil !== 'Administrador') {
            const resVinculo = await executarQuery<{ total: number }>(
                `SELECT COUNT(*) AS "total"
                   FROM usuario_projeto
                  WHERE usuario_id = :usuarioId
                    AND projeto_id = :projetoId`,
                { usuarioId: respIdNum, projetoId: projetoIdNum }
            );
            const possuiVinculo = Number(resVinculo.rows?.[0]?.total ?? 0) > 0;
            if (!possuiVinculo) {
                return {
                    erroStatus: 400,
                    erroMensagem: 'O responsável selecionado não está vinculado ao projeto informado.'
                };
            }
        }

        respNome = usuarioEncontrado.nome;
    }

    // Valida formato de data; checa passado e feriado nacional no cadastro ou quando o prazo muda na edicao
    let prazoFinal: string | null = null;
    const prazoInformado =
        prazoFinalizacao !== undefined &&
        prazoFinalizacao !== null &&
        !(typeof prazoFinalizacao === 'string' && prazoFinalizacao.trim() === '');

    if (prazoInformado) {
        if (typeof prazoFinalizacao !== 'string') {
            return {
                erroStatus: 400,
                erroMensagem: 'Prazo de finalização inválido. Utilize o formato YYYY-MM-DD.'
            };
        }

        const prazoStr = prazoFinalizacao.trim();
        if (!validarFormatoDataIso(prazoStr)) {
            return {
                erroStatus: 400,
                erroMensagem: 'Prazo de finalização inválido. Utilize o formato YYYY-MM-DD.'
            };
        }

        const deveValidarPrazoNovo = !opcoes.modoEdicao || prazoStr !== (opcoes.prazoAtual ?? null);
        if (deveValidarPrazoNovo) {
            if (prazoStr < obterDataHojeIsoLocal()) {
                return {
                    erroStatus: 400,
                    erroMensagem: 'O prazo de finalização não pode ser anterior à data de hoje.'
                };
            }

            const feriado = await verificarFeriadoNacional(prazoStr);
            if (feriado.ehFeriado) {
                return {
                    erroStatus: 400,
                    erroMensagem: `Não é permitido definir o prazo de finalização em feriado nacional (${feriado.nome}).`
                };
            }
        }

        prazoFinal = prazoStr;
    }

    return {
        dados: {
            titulo: tituloLimpo,
            descricao: descricaoLimpa,
            tipo: tipoValido,
            prioridade: prioridadeValida,
            projetoId: projetoIdNum,
            projetoNome: projetoEncontrado.nome,
            responsavelId: respIdNum,
            responsavelNome: respNome,
            prazoFinalizacao: prazoFinal
        }
    };
}

// Centraliza tratamento de erros de negocio, API de feriados e indisponibilidade do Oracle
function tratarErroCadastro(res: Response, erro: unknown, contexto: string): void {
    if (erro instanceof ErroConflitoEdicao) {
        res.status(409).json({ erro: true, mensagem: erro.message });
        return;
    }
    if (erro instanceof ErroAnoForaDaFaixa) {
        res.status(400).json({ erro: true, mensagem: erro.message });
        return;
    }
    if (erro instanceof ErroApiFeriado) {
        res.status(503).json({ erro: true, mensagem: erro.message });
        return;
    }
    if (ehErroConexaoOracle(erro)) {
        console.error(`Banco indisponivel ao ${contexto}:`, erro);
        res.status(503).json({ erro: true, mensagem: MENSAGEM_BANCO_INDISPONIVEL });
        return;
    }
    console.error(`Erro ao ${contexto}:`, erro);
    res.status(500).json({ erro: true, mensagem: `Erro interno ao ${contexto}.` });
}

// Cadastra nova demanda com status inicial 'Aberta' (apenas Administrador ou Lider vinculado ao projeto)
router.post(
    '/',
    autenticarToken,
    exigirPerfis('Administrador', 'Líder de Projeto'),
    async (req: Request, res: Response) => {
        try {
            const usuario = req.usuario!;
            const validacao = await validarDadosDemanda(
                (req.body || {}) as Record<string, unknown>,
                usuario,
                { modoEdicao: false }
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
                    data_criacao,
                    data_atualizacao,
                    prazo_finalizacao
                ) VALUES (
                    :titulo,
                    :descricao,
                    :tipo,
                    :prioridade,
                    'Aberta',
                    :projetoId,
                    :responsavelId,
                    SYS_EXTRACT_UTC(SYSTIMESTAMP),
                    SYS_EXTRACT_UTC(SYSTIMESTAMP),
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
            tratarErroCadastro(res, erro, 'cadastrar demanda');
        }
    }
);

// Atualiza demanda ativa e registra alteracoes relevantes no historico dentro da mesma transacao
router.put(
    '/:id',
    autenticarToken,
    exigirPerfis('Administrador', 'Líder de Projeto'),
    async (req: Request, res: Response) => {
        try {
            const usuario = req.usuario!;
            const idDemanda = lerIdPositivo(req.params.id);

            if (idDemanda === null) {
                res.status(400).json({ erro: true, mensagem: 'ID da demanda inválido.' });
                return;
            }

            const resAtual = await executarQuery<Demanda>(SQL_BUSCAR_DEMANDA, { id: idDemanda });
            const rowAtual = resAtual.rows?.[0];
            if (!rowAtual) {
                res.status(404).json({ erro: true, mensagem: 'Demanda não encontrada.' });
                return;
            }

            const demandaAtual = mapearDemanda(rowAtual);

            const acessoProjetoAtual = await usuarioTemAcessoAoProjeto(usuario, demandaAtual.projetoId);
            if (!acessoProjetoAtual) {
                res.status(403).json({
                    erro: true,
                    mensagem: 'Você não possui permissão para editar demandas deste projeto.'
                });
                return;
            }

            if (demandaAtual.status === 'Concluída' || demandaAtual.status === 'Cancelada') {
                res.status(400).json({
                    erro: true,
                    mensagem: `Não é possível editar uma demanda com status ${demandaAtual.status}.`
                });
                return;
            }

            const validacao = await validarDadosDemanda(
                (req.body || {}) as Record<string, unknown>,
                usuario,
                { modoEdicao: true, prazoAtual: demandaAtual.prazoFinalizacao }
            );

            if (validacao.erroStatus || !validacao.dados) {
                res.status(validacao.erroStatus || 400).json({
                    erro: true,
                    mensagem: validacao.erroMensagem
                });
                return;
            }

            const { dados } = validacao;

            // Aplica atualizacao com protecao contra concorrencia (TOCTOU) e registra auditoria atomica
            await comTransacao(async conn => {
                const resultadoUpdate = await conn.execute(
                    `UPDATE demandas
                        SET titulo = :titulo,
                            descricao = :descricao,
                            tipo = :tipo,
                            prioridade = :prioridade,
                            projeto_id = :projetoId,
                            responsavel_id = :responsavelId,
                            prazo_finalizacao = TO_DATE(:prazoFinalizacao, 'YYYY-MM-DD'),
                            data_atualizacao = SYS_EXTRACT_UTC(SYSTIMESTAMP)
                      WHERE id = :id
                        AND status NOT IN ('Concluída', 'Cancelada')`,
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

                if (!resultadoUpdate.rowsAffected) {
                    throw new ErroConflitoEdicao(
                        'A demanda foi concluída ou cancelada durante a edição.'
                    );
                }

                // Registra historico das alteracoes relevantes (projeto, responsavel, prioridade e prazo)
                if (demandaAtual.projetoId !== dados.projetoId) {
                    await registrarHistorico(
                        {
                            demandaId: idDemanda,
                            usuarioId: usuario.id,
                            campoAlterado: 'projeto',
                            valorAnterior: demandaAtual.projetoNome,
                            valorNovo: dados.projetoNome,
                            descricao: `${usuario.nome} alterou o projeto de ${demandaAtual.projetoNome} para ${dados.projetoNome}.`
                        },
                        conn
                    );
                }

                if (demandaAtual.responsavelId !== dados.responsavelId) {
                    const anterior = demandaAtual.responsavelNome || 'Sem responsável';
                    const novo = dados.responsavelNome || 'Sem responsável';
                    await registrarHistorico(
                        {
                            demandaId: idDemanda,
                            usuarioId: usuario.id,
                            campoAlterado: 'responsavel',
                            valorAnterior: anterior,
                            valorNovo: novo,
                            descricao: `${usuario.nome} alterou o responsável de ${anterior} para ${novo}.`
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
                            descricao: `${usuario.nome} alterou o prazo de finalização de ${anterior} para ${novo}.`
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
            tratarErroCadastro(res, erro, 'atualizar demanda');
        }
    }
);

export default router;
