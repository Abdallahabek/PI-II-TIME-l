// Autor: Vinicius Morais
// Rota GET /demandas com visibilidade por perfil, filtros combinados, busca e ordenacao

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

// Mapeia criterios de ordenacao permitidos para expressoes SQL seguras
class ParametroInvalido extends Error {}

function escolher<T>(mapa: Record<string, T>, chave: string, parametro: string): T {
    if (!Object.prototype.hasOwnProperty.call(mapa, chave)) {
        throw new ParametroInvalido(parametro + ' invalido. Opcoes: ' + Object.keys(mapa).join(', '));
    }
    return mapa[chave];
}

function lista(valor: unknown): string[] {
    if (valor === undefined || valor === '') return [];
    const itens = (Array.isArray(valor) ? valor : [valor]).flatMap(item => {
        if (typeof item !== 'string') throw new ParametroInvalido('Lista invalida.');
        return item.split(',').map(v => v.trim());
    });
    if (itens.length > 100 || itens.includes('')) throw new ParametroInvalido('Lista vazia ou extensa demais.');
    return itens;
}

const datas = { timestamp: 'd.data_criacao', lastupdate: 'd.data_atualizacao', deadline: 'd.prazo_finalizacao' };
const camposBusca = { titulo: 'd.titulo', descricao: 'd.descricao', responsavel: 'u.nome', projeto: 'p.nome' };
const aberto = "d.status NOT IN ('Concluída','Cancelada')";
const prazos = {
    atrasada: aberto + ' AND d.prazo_finalizacao < TRUNC(CURRENT_DATE)',
    hoje: aberto + ' AND TRUNC(d.prazo_finalizacao) = TRUNC(CURRENT_DATE)',
    futura: aberto + ' AND d.prazo_finalizacao >= TRUNC(CURRENT_DATE) + 1',
    semPrazo: 'd.prazo_finalizacao IS NULL'
};

const ORDENACOES: Record<string, string> = {
    ...datas, dataatualizacao:'d.data_atualizacao', titulo:'d.titulo', tipo:'d.tipo', id:'d.id', projeto:'p.nome', responsavel:'u.nome',
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

        const filtros: [string, string, Record<string,string> | null][] = [
            ['status','d.status',MAPA_STATUS], ['tipo','d.tipo',MAPA_TIPOS],
            ['prioridade','d.prioridade',MAPA_PRIORIDADES], ['responsavelId','d.responsavel_id',null],
            ['projetoId','d.projeto_id',null]
        ];
        for (const [nome, coluna, mapa] of filtros) {
            const parametros = lista(req.query[nome]).map((item, i) => {
                const valor = mapa ? escolher(mapa, normalizarTexto(item), nome) : lerIdPositivo(item);
                if (valor === null) throw new ParametroInvalido(nome + ' invalido.');
                const chave = nome + i;
                binds[chave] = valor;
                return ':' + chave;
            });
            if (parametros.length) condicoes.push(coluna + ' IN (' + parametros.join(', ') + ')');
        }
        const atribuicao = lerParametro(req.query.atribuicao);
        if (atribuicao) {
            const atribuicoes = {comResponsavel:'d.responsavel_id IS NOT NULL', semResponsavel:'d.responsavel_id IS NULL', minhas:'d.responsavel_id = :meuId'};
            condicoes.push(escolher(atribuicoes, atribuicao, 'atribuicao'));
            if (atribuicao === 'minhas') binds.meuId = usuario.id;
        }
        const situacoes = lista(req.query.situacaoPrazo).map(v => '(' + escolher(prazos, v, 'situacaoPrazo') + ')');
        if (situacoes.length) condicoes.push('(' + situacoes.join(' OR ') + ')');
        const data = escolher(datas, (lerParametro(req.query.campoData) || 'TimeStamp').toLowerCase(), 'campoData');
        for (const limite of ['de','ate']) {
            const valor = lerParametro(req.query[limite]);
            if (!valor) continue;
            const instante = new Date(valor + 'T00:00:00Z');
            if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(instante.getTime()) || instante.toISOString().slice(0,10) !== valor || valor.startsWith('0000')) {
                throw new ParametroInvalido(limite + ' deve ser uma data valida YYYY-MM-DD.');
            }
            binds[limite] = valor;
            const limiteSql = "TO_DATE(:" + limite + ", 'YYYY-MM-DD')";
            condicoes.push(data + (limite === 'de' ? ' >= ' + limiteSql : ' < ' + limiteSql + ' + 1'));
        }
        if (binds.de && binds.ate && binds.de > binds.ate) throw new ParametroInvalido('Periodo invertido.');

        const busca = lerParametro(req.query.busca);
        const campos = lista(req.query.buscarEm);
        const colunas = (campos.length ? campos : ['titulo','descricao']).map(v => escolher(camposBusca,v,'buscarEm'));
        const modo = escolher({contem:1, exata:2, prefixo:3, sufixo:4}, lerParametro(req.query.comparacao) || 'contem','comparacao');
        const acentos = escolher({preservar:'', ignore:'composto', 'force-ignore':'todos'}, lerParametro(req.query.acentos) || 'preservar','acentos');
        const palavras = escolher({frase:'frase', todas:' AND ', qualquer:' OR '}, lerParametro(req.query.palavras) || 'frase','palavras');
        if (busca) {
            const termos = palavras === 'frase' ? [busca] : busca.split(/\s+/);
            if (termos.length > 50) throw new ParametroInvalido('Use ate 50 termos.');
            function comparar(expressao: string) {
                const base = 'LOWER(' + expressao + ')';
                if (!acentos) return base;
                const extra = acentos === 'todos' ? ['ãõñç','aonc'] : ['',''];
                return "TRANSLATE(COMPOSE(" + base + "), 'áàâäéèêëíìîïóòôöúùûü" + extra[0] + "', 'aaaaeeeeiiiioooouuuu" + extra[1] + "')";
            }
            const grupos = termos.map((termo, i) => {
                const chave = 'busca' + i;
                const literal = termo.replace(/[!%_]/g, '!$&');
                binds[chave] = (modo === 1 || modo === 4 ? '%' : '') + literal + (modo === 1 || modo === 3 ? '%' : '');
                return '(' + colunas.map(c => comparar(c) + ' LIKE ' + comparar(':' + chave) + " ESCAPE '!'").join(' OR ') + ')';
            });
            condicoes.push('(' + grupos.join(palavras) + ')');
        }

        const criterios = lista(req.query.ordenarPor);
        if (!criterios.length) criterios.push('dataCriacao');
        const direcoes = lista(req.query.ordem);
        if (direcoes.length > criterios.length) throw new ParametroInvalido('Direcoes excedem os criterios.');
        const ordenacao = criterios.map((v,i) => {
            const chave = normalizarTexto(v);
            const campo = escolher(ORDENACOES, chave, 'ordenarPor');
            const direcao = direcoes[i] ? escolher({ASC:'ASC',DESC:'DESC'},direcoes[i].toUpperCase(),'ordem') : (DIRECAO_PADRAO[chave] || 'ASC');
            return campo + ' ' + direcao + ' NULLS LAST';
        }).join(', ');

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
            res.status(400).json({erro:true, mensagem:erro.message});
            return;
        }
        if (erro instanceof ErroBancoIndisponivel) {
            res.status(503).json({ erro: true, mensagem: erro.message });
            return;
        }
        console.error('Erro ao listar demandas:', erro);
        res.status(500).json({ erro: true, mensagem: 'Erro interno ao listar demandas.' });
    }
});

export default router;
