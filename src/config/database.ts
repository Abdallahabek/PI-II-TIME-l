// Autor: Abdallah Ali Borges El Khatib
// Configuracao do pool de conexoes com o banco Oracle

import oracledb from 'oracledb';
import dotenv from 'dotenv';

dotenv.config();

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];

let pool: oracledb.Pool | null = null;

export class ErroBancoIndisponivel extends Error {
    constructor(mensagem: string) {
        super(mensagem);
        this.name = 'ErroBancoIndisponivel';
    }
}

export async function initPool(): Promise<void> {
    if (pool) {
        return;
    }

    const user = process.env.ORACLE_USER;
    const password = process.env.ORACLE_PASSWORD;
    const connectString = process.env.ORACLE_CONNECTION_STRING;

    if (!user || !password || !connectString) {
        throw new ErroBancoIndisponivel(
            'Variaveis ORACLE_USER, ORACLE_PASSWORD e ORACLE_CONNECTION_STRING nao configuradas no .env.'
        );
    }

    pool = await oracledb.createPool({
        user,
        password,
        connectString,
        poolMin: 1,
        poolMax: 10,
        poolIncrement: 1
    });
}

export async function closePool(): Promise<void> {
    if (pool) {
        await pool.close(0);
        pool = null;
    }
}

export async function obterConexao(): Promise<oracledb.Connection> {
    if (!pool) {
        await initPool();
    }
    if (!pool) {
        throw new ErroBancoIndisponivel('Pool de conexoes Oracle nao inicializado.');
    }
    return pool.getConnection();
}

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
        await conn.close();
    }
}

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
            // Ignora erro secundario no rollback
        }
        throw erro;
    } finally {
        await conn.close();
    }
}
