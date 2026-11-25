// Autor: Abdallah Ali Borges El Khatib
// Configuracao do pool de conexoes com o banco Oracle e helpers de transacao

import oracledb from 'oracledb';
import dotenv from 'dotenv';

dotenv.config();

// Padroniza retorno das queries como objetos JSON e leitura direta de CLOB como string
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];

export const MENSAGEM_BANCO_INDISPONIVEL = 'Serviço de banco de dados indisponível no momento.';

// Codigos de erro Oracle e driver NJS que indicam indisponibilidade ou falha de conexao
const CODIGOS_ORA_CONEXAO = new Set([
    1017, // credenciais invalidas
    1033, // inicializacao ou desligamento em andamento
    1034, // Oracle indisponivel
    1089, // desligamento imediato em andamento
    3113, // fim de arquivo no canal de comunicacao
    3114, // nao conectado ao Oracle
    3135, // conexao perdida
    12154, // TNS nao conseguiu resolver identificador
    12170, // timeout de conexao TNS
    12505, // SID nao conhecido pelo listener
    12514, // servico nao conhecido pelo listener
    12528, // todas as instancias bloqueando novas conexoes
    12537, // conexao encerrada pelo TNS
    12541, // sem listener no host/porta
    12543, // destino inacessivel
    12545, // host/objeto de destino nao existe
    12560, // erro de adaptador de protocolo TNS
    28000, // conta bloqueada
    28001 // senha expirada
]);

const CODIGOS_REDE_E_NJS = new Set([
    'NJS-040',
    'NJS-046',
    'NJS-047',
    'NJS-064',
    'NJS-500',
    'NJS-503',
    'NJS-507',
    'NJS-510',
    'NJS-511',
    'NJS-512',
    'NJS-516',
    'NJS-521',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'EAI_AGAIN'
]);

const REGEX_ERRO_CONEXAO =
    /\b(ORA-(01017|01033|01034|01089|03113|03114|03135|12154|12170|12505|12514|12528|12537|12541|12543|12545|12560|28000|28001)|NJS-(040|046|047|064|500|503|507|510|511|512|516|521)|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH)\b/i;

let pool: oracledb.Pool | null = null;
// Promise compartilhada para impedir criacao duplicada do pool sob requisicoes concorrentes (NJS-046)
let poolInicializando: Promise<oracledb.Pool> | null = null;

export class ErroBancoIndisponivel extends Error {
    constructor(mensagem: string = MENSAGEM_BANCO_INDISPONIVEL) {
        super(mensagem);
        this.name = 'ErroBancoIndisponivel';
    }
}

export class ErroBancoNaoConfigurado extends ErroBancoIndisponivel {
    constructor(mensagem: string = MENSAGEM_BANCO_INDISPONIVEL) {
        super(mensagem);
        this.name = 'ErroBancoNaoConfigurado';
    }
}

// Identifica se o erro corresponde a falha de configuracao, rede ou indisponibilidade do Oracle
export function ehErroConexaoOracle(erro: unknown): boolean {
    if (erro instanceof ErroBancoNaoConfigurado || erro instanceof ErroBancoIndisponivel) {
        return true;
    }

    if (!erro || typeof erro !== 'object') {
        return false;
    }

    const detalhe = erro as { errorNum?: unknown; code?: unknown; message?: unknown };

    if (typeof detalhe.errorNum === 'number' && CODIGOS_ORA_CONEXAO.has(detalhe.errorNum)) {
        return true;
    }

    if (typeof detalhe.code === 'string' && CODIGOS_REDE_E_NJS.has(detalhe.code.toUpperCase())) {
        return true;
    }

    if (typeof detalhe.message === 'string' && REGEX_ERRO_CONEXAO.test(detalhe.message)) {
        return true;
    }

    return false;
}

// Indica se o pool de conexoes Oracle ja esta ativo para consultas de saude da API
export function poolAtivo(): boolean {
    return pool !== null;
}

// Inicializa o pool de forma idempotente e segura contra chamadas concorrentes
export async function initPool(): Promise<void> {
    if (pool) {
        return;
    }

    if (poolInicializando) {
        await poolInicializando;
        return;
    }

    const user = process.env.ORACLE_USER?.trim();
    const password = process.env.ORACLE_PASSWORD;
    const connectString = process.env.ORACLE_CONNECTION_STRING?.trim();

    if (!user || !password || !connectString) {
        console.error(
            'Configuracao Oracle incompleta: verifique ORACLE_USER, ORACLE_PASSWORD e ORACLE_CONNECTION_STRING no .env.'
        );
        throw new ErroBancoNaoConfigurado(MENSAGEM_BANCO_INDISPONIVEL);
    }

    const promessaCriacao = oracledb
        .createPool({
            user,
            password,
            connectString,
            poolMin: 1,
            poolMax: 10,
            poolIncrement: 1
        })
        .then(novoPool => {
            pool = novoPool;
            return novoPool;
        })
        .finally(() => {
            poolInicializando = null;
        });

    poolInicializando = promessaCriacao;
    await promessaCriacao;
}

// Encerra o pool aguardando brevemente conexoes em uso antes de forcar o fechamento
export async function closePool(): Promise<void> {
    if (poolInicializando) {
        try {
            await poolInicializando;
        } catch {
            // Falha na criacao em andamento ja deixou o pool nulo
        }
    }

    if (!pool) {
        return;
    }

    const poolAtual = pool;
    pool = null;

    try {
        await poolAtual.close(5);
    } catch {
        await poolAtual.close(0);
    }
}

// Obtem uma conexao do pool, inicializando-o sob demanda caso o servidor tenha subido offline
export async function obterConexao(): Promise<oracledb.Connection> {
    if (!pool) {
        await initPool();
    }
    if (!pool) {
        throw new ErroBancoIndisponivel(MENSAGEM_BANCO_INDISPONIVEL);
    }
    return pool.getConnection();
}

// Executa consulta ou comando isolado com fechamento garantido da conexao
export async function executarQuery<T = Record<string, unknown>>(
    sql: string,
    binds: oracledb.BindParameters = {},
    options: oracledb.ExecuteOptions = {}
): Promise<oracledb.Result<T>> {
    const conn = await obterConexao();
    try {
        return await conn.execute<T>(sql, binds, {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            autoCommit: true,
            ...options
        });
    } finally {
        try {
            await conn.close();
        } catch (erroFechamento) {
            console.error('Erro ao fechar conexao Oracle apos query:', erroFechamento);
        }
    }
}

// Executa multiplas operacoes em transacao unica com commit automatico ou rollback em erro
export async function comTransacao<T>(
    operacao: (conn: oracledb.Connection) => Promise<T>
): Promise<T> {
    const conn = await obterConexao();
    try {
        const resultado = await operacao(conn);
        await conn.commit();
        return resultado;
    } catch (erro) {
        try {
            await conn.rollback();
        } catch {
            // Ignora erro secundario no rollback quando a conexao foi perdida
        }
        throw erro;
    } finally {
        try {
            await conn.close();
        } catch (erroFechamento) {
            console.error('Erro ao fechar conexao Oracle apos transacao:', erroFechamento);
        }
    }
}
