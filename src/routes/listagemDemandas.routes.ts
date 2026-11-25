// Autor: Vinicius Morais
// Rota GET /demandas com visibilidade por perfil, filtros combinados, busca avancada e ordenacao

import { Router, Request, Response } from 'express';
import {
    ehErroConexaoOracle,
    executarQuery,
    MENSAGEM_BANCO_INDISPONIVEL
} from '../config/database';
import { autenticarToken } from '../middlewares/auth';
import { Demanda, PrioridadeDemanda, StatusDemanda, TipoDemanda } from '../types';

const router = Router();

const ACENTOS_COMPOSTOS_ORIGEM = 'áàâäéèêëíìîïóòôöúùûü';
const ACENTOS_COMPOSTOS_DESTINO = 'aaaaeeeeiiiioooouuuu';
const ACENTOS_EXTRAS_ORIGEM = 'ãõñç';
const ACENTOS_EXTRAS_DESTINO = 'aonc';

// Normaliza acentos e caixa para validar enums e criterios de ordenacao
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

// Erro interno de validacao para converter parametros invalidos em HTTP 400
class ParametroInvalido extends Error {}

// Garante lookup estrito apenas em chaves proprias da whitelist
function escolher<T>(mapa: Record<string, T>, chave: string, parametro: string): T {
    if (!Object.prototype.hasOwnProperty.call(mapa, chave)) {
        throw new ParametroInvalido(parametro + ' inválido. Opções: ' + Object.keys(mapa).join(', '));
    }
    return mapa[chave];
}

// Interpreta parametros com multiplos valores separados por virgula ou repetidos na query
function lista(valor: unknown): string[] {
    if (valor === undefined || valor === '') {
        return [];
    }
    const itens = (Array.isArray(valor) ? valor : [valor]).flatMap(item => {
        if (typeof item !== 'string') {
            throw new ParametroInvalido('Lista de filtros inválida.');
        }
        return item.split(',').map(v => v.trim());
    });
    if (itens.length > 100 || itens.includes('')) {
        throw new ParametroInvalido('Lista de filtros vazia ou extensa demais.');
    }
    return itens;
}

const DATAS_PERMITIDAS: Record<string, string> = {
    timestamp: 'd.data_criacao',
    lastupdate: 'd.data_atualizacao',
    deadline: 'd.prazo_finalizacao'
};

const CAMPOS_BUSCA: Record<string, string> = {
    titulo: 'd.titulo',
    descricao: 'd.descricao',
    responsavel: 'u.nome',
    projeto: 'p.nome'
};

const STATUS_ABERTO_SQL = "d.status NOT IN ('Concluída','Cancelada')";

// Situacoes de prazo alinhadas com TRUNC(SYSDATE) do Oracle (mesma referencia do Dashboard)
const PRAZOS_PERMITIDOS: Record<string, string> = {
    atrasada: `${STATUS_ABERTO_SQL} AND d.prazo_finalizacao < TRUNC(SYSDATE)`,
    hoje: `${STATUS_ABERTO_SQL} AND TRUNC(d.prazo_finalizacao) = TRUNC(SYSDATE)`,
    futura: `${STATUS_ABERTO_SQL} AND d.prazo_finalizacao >= TRUNC(SYSDATE) + 1`,
    semPrazo: 'd.prazo_finalizacao IS NULL'
};

// Mapeia criterios de ordenacao permitidos para expressoes SQL seguras
const ORDENACOES: Record<string, string> = {
    ...DATAS_PERMITIDAS,
    dataatualizacao: 'd.data_atualizacao',
    titulo: 'd.titulo',
    tipo: 'd.tipo',
    id: 'd.id',
    projeto: 'p.nome',
    responsavel: 'u.nome',
    prioridade: `CASE d.prioridade WHEN 'Crítica' THEN 1 WHEN 'Alta' THEN 2 WHEN 'Média' THEN 3 WHEN 'Baixa' THEN 4 ELSE 5 END`,
    datacriacao: 'd.data_criacao',
    prazofinalizacao: 'd.prazo_finalizacao',
    status: `CASE d.status WHEN 'Aberta' THEN 1 WHEN 'Em andamento' THEN 2 WHEN 'Em revisão' THEN 3 WHEN 'Concluída' THEN 4 WHEN 'Cancelada' THEN 5 ELSE 6 END`
};

const DIRECAO_PADRAO: Record<string, 'ASC' | 'DESC'> = {
    prioridade: 'ASC',
    datacriacao: 'DESC',
    timestamp: 'DESC',
    dataatualizacao: 'DESC',
    lastupdate: 'DESC',
    prazofinalizacao: 'ASC',
    deadline: 'ASC',
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
    return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

router.get('/', autenticarToken, async (req: Request, res: Response) => {
    try {
        const usuario = req.usuario!;
        const condicoes: string[] = [];
        const binds: Record<string, string | number> = {};

        // Administrador enxerga todas as demandas; demais perfis veem apenas projetos vinculados
        if (usuario.perfil !== 'Administrador') {
            condicoes.push(
                'EXISTS (SELECT 1 FROM usuario_projeto up WHERE up.projeto_id = d.projeto_id AND up.usuario_id = :usuarioLogadoId)'
            );
            binds.usuarioLogadoId = usuario.id;
        }

        // Filtros combinaveis com suporte a multiplos valores separados por virgula
        const filtrosPadrao: [string, string, Record<string, string> | null][] = [
            ['status', 'd.status', MAPA_STATUS],
            ['tipo', 'd.tipo', MAPA_TIPOS],
            ['prioridade', 'd.prioridade', MAPA_PRIORIDADES],
            ['projetoId', 'd.projeto_id', null]
        ];

        for (const [nome, coluna, mapa] of filtrosPadrao) {
            const parametros = lista(req.query[nome]).map((item, i) => {
                const valor = mapa ? escolher(mapa, normalizarTexto(item), nome) : lerIdPositivo(item);
                if (valor === null) {
                    throw new ParametroInvalido(`O ${nome} informado é inválido.`);
                }
                const chave = nome + i;
                binds[chave] = valor;
                return ':' + chave;
            });
            if (parametros.length) {
                condicoes.push(`${coluna} IN (${parametros.join(', ')})`);
            }
        }

        // Filtro por responsavel: aceita IDs positivos (lista ou unico) e o valor especial sem_responsavel
        const itensResponsavel = lista(req.query.responsavelId);
        if (itensResponsavel.length) {
            const chavesIds: string[] = [];
            let incluirSemResponsavel = false;

            itensResponsavel.forEach((item, i) => {
                if (item.toLowerCase() === 'sem_responsavel') {
                    incluirSemResponsavel = true;
                    return;
                }
                const idResp = lerIdPositivo(item);
                if (idResp === null) {
                    throw new ParametroInvalido('O responsavelId informado é inválido.');
                }
                const chave = 'responsavelId' + i;
                binds[chave] = idResp;
                chavesIds.push(':' + chave);
            });

            if (incluirSemResponsavel && chavesIds.length) {
                condicoes.push(`(d.responsavel_id IS NULL OR d.responsavel_id IN (${chavesIds.join(', ')}))`);
            } else if (incluirSemResponsavel) {
                condicoes.push('d.responsavel_id IS NULL');
            } else if (chavesIds.length) {
                condicoes.push(`d.responsavel_id IN (${chavesIds.join(', ')})`);
            }
        }

        // Filtro semantico de atribuicao (minhas, comResponsavel ou semResponsavel)
        const atribuicao = lerParametro(req.query.atribuicao);
        if (atribuicao) {
            const atribuicoes: Record<string, string> = {
                comResponsavel: 'd.responsavel_id IS NOT NULL',
                semResponsavel: 'd.responsavel_id IS NULL',
                minhas: 'd.responsavel_id = :meuId'
            };
            condicoes.push(escolher(atribuicoes, atribuicao, 'atribuicao'));
            if (atribuicao === 'minhas') {
                binds.meuId = usuario.id;
            }
        }

        // Filtro por situacao do prazo (atrasada, hoje, futura, semPrazo)
        const situacoes = lista(req.query.situacaoPrazo).map(
            v => '(' + escolher(PRAZOS_PERMITIDOS, v, 'situacaoPrazo') + ')'
        );
        if (situacoes.length) {
            condicoes.push('(' + situacoes.join(' OR ') + ')');
        }

        // Filtro por intervalo de datas em TimeStamp (criacao), LastUpdate (atualizacao) ou Deadline (prazo)
        const colunaData = escolher(
            DATAS_PERMITIDAS,
            (lerParametro(req.query.campoData) || 'TimeStamp').toLowerCase(),
            'campoData'
        );
        for (const limite of ['de', 'ate'] as const) {
            const valor = lerParametro(req.query[limite]);
            if (!valor) {
                continue;
            }
            const instante = new Date(valor + 'T00:00:00Z');
            if (
                !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
                !Number.isFinite(instante.getTime()) ||
                instante.toISOString().slice(0, 10) !== valor ||
                valor.startsWith('0000')
            ) {
                throw new ParametroInvalido(`${limite} deve ser uma data válida YYYY-MM-DD.`);
            }
            binds[limite] = valor;
            const limiteSql = `TO_DATE(:${limite}, 'YYYY-MM-DD')`;
            condicoes.push(
                colunaData + (limite === 'de' ? ` >= ${limiteSql}` : ` < ${limiteSql} + 1`)
            );
        }
        if (binds.de && binds.ate && binds.de > binds.ate) {
            throw new ParametroInvalido('Período invertido: a data inicial não pode ser maior que a final.');
        }

        // Busca textual insensivel a acentos por padrao (force-ignore), com escape de curingas LIKE (\, %, _)
        const busca = lerParametro(req.query.busca);
        const campos = lista(req.query.buscarEm);
        const colunas = (campos.length ? campos : ['titulo', 'descricao']).map(v =>
            escolher(CAMPOS_BUSCA, v, 'buscarEm')
        );
        const modo = escolher(
            { contem: 1, exata: 2, prefixo: 3, sufixo: 4 },
            lerParametro(req.query.comparacao) || 'contem',
            'comparacao'
        );
        const acentos = escolher(
            { preservar: '', ignore: 'composto', 'force-ignore': 'todos' },
            lerParametro(req.query.acentos) || 'force-ignore',
            'acentos'
        );
        const palavras = escolher(
            { frase: 'frase', todas: ' AND ', qualquer: ' OR ' },
            lerParametro(req.query.palavras) || 'frase',
            'palavras'
        );

        if (busca) {
            const termos = palavras === 'frase' ? [busca] : busca.split(/\s+/);
            if (termos.length > 50) {
                throw new ParametroInvalido('Use até 50 termos na busca.');
            }

            const comparar = (expressao: string): string => {
                const base = `LOWER(${expressao})`;
                if (!acentos) {
                    return base;
                }
                const origem =
                    acentos === 'todos'
                        ? ACENTOS_COMPOSTOS_ORIGEM + ACENTOS_EXTRAS_ORIGEM
                        : ACENTOS_COMPOSTOS_ORIGEM;
                const destino =
                    acentos === 'todos'
                        ? ACENTOS_COMPOSTOS_DESTINO + ACENTOS_EXTRAS_DESTINO
                        : ACENTOS_COMPOSTOS_DESTINO;
                return `TRANSLATE(COMPOSE(${base}), '${origem}', '${destino}')`;
            };

            const grupos = termos.map((termo, i) => {
                const chave = 'busca' + i;
                const literal = termo.replace(/[\\%_]/g, '\\$&');
                binds[chave] =
                    (modo === 1 || modo === 4 ? '%' : '') +
                    literal +
                    (modo === 1 || modo === 3 ? '%' : '');
                return (
                    '(' +
                    colunas
                        .map(c => `${comparar(c)} LIKE ${comparar(':' + chave)} ESCAPE '\\'`)
                        .join(' OR ') +
                    ')'
                );
            });
            condicoes.push('(' + grupos.join(palavras === 'frase' ? '' : palavras) + ')');
        }

        // Ordenacao por um ou multiplos criterios com direcao validada via whitelist
        const criterios = lista(req.query.ordenarPor);
        if (!criterios.length) {
            criterios.push('dataCriacao');
        }
        const direcoes = lista(req.query.ordem);
        if (direcoes.length > criterios.length) {
            throw new ParametroInvalido('Direções de ordenação excedem os critérios informados.');
        }

        const ordenacao = criterios
            .map((v, i) => {
                const chave = normalizarTexto(v);
                const campo = escolher(ORDENACOES, chave, 'ordenarPor');
                const direcao = direcoes[i]
                    ? escolher({ ASC: 'ASC', DESC: 'DESC' }, direcoes[i].toUpperCase(), 'ordem')
                    : DIRECAO_PADRAO[chave] || 'ASC';
                return `${campo} ${direcao} NULLS LAST`;
            })
            .join(', ');

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
             ORDER BY ${ordenacao}, d.id DESC
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
        if (erro instanceof ParametroInvalido) {
            res.status(400).json({ erro: true, mensagem: erro.message });
            return;
        }
        if (ehErroConexaoOracle(erro)) {
            console.error('Banco indisponivel ao listar demandas:', erro);
            res.status(503).json({ erro: true, mensagem: MENSAGEM_BANCO_INDISPONIVEL });
            return;
        }
        console.error('Erro ao listar demandas:', erro);
        res.status(500).json({ erro: true, mensagem: 'Erro interno ao listar demandas.' });
    }
});

export default router;
