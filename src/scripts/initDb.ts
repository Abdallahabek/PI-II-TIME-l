// Autor: Abdallah Ali Borges El Khatib
// Script para criar as tabelas, indices e carga inicial no Oracle via .env

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';
import { closePool, initPool, obterConexao } from '../config/database';

const TABELAS_OBRIGATORIAS = [
    'USUARIOS',
    'PROJETOS',
    'USUARIO_PROJETO',
    'DEMANDAS',
    'COMENTARIOS',
    'HISTORICO_ALTERACOES'
];

// Quebra arquivo SQL em comandos individuais ignorando comentarios e ponto-e-virgula dentro de strings
export function extrairComandosSql(caminhoArquivo: string): string[] {
    const conteudo = fs.readFileSync(caminhoArquivo, 'utf8');
    const comandos: string[] = [];
    let atual = '';
    let dentroString = false;

    const linhas = conteudo.split(/\r?\n/);
    for (const linha of linhas) {
        if (!dentroString && linha.trim().startsWith('--')) {
            continue;
        }

        for (let i = 0; i < linha.length; i++) {
            const ch = linha[i];
            const proximo = linha[i + 1];

            if (!dentroString && ch === '-' && proximo === '-') {
                break;
            }

            if (ch === "'") {
                atual += ch;
                if (dentroString && proximo === "'") {
                    atual += proximo;
                    i++;
                } else {
                    dentroString = !dentroString;
                }
                continue;
            }

            if (ch === ';' && !dentroString) {
                const comando = atual.trim();
                if (comando.length > 0 && comando.toUpperCase() !== 'COMMIT') {
                    comandos.push(comando);
                }
                atual = '';
                continue;
            }

            atual += ch;
        }

        atual += '\n';
    }

    const restante = atual.trim();
    if (restante.length > 0 && restante.toUpperCase() !== 'COMMIT') {
        comandos.push(restante);
    }

    return comandos;
}

// Confirma no dicionario de dados Oracle se todas as tabelas do projeto existem no schema
async function verificarTabelasObrigatorias(conn: oracledb.Connection): Promise<void> {
    const resTabelas = await conn.execute<{ nome: string }>(
        'SELECT table_name AS "nome" FROM user_tables'
    );
    const existentes = new Set((resTabelas.rows ?? []).map(r => r.nome.toUpperCase()));
    const faltantes = TABELAS_OBRIGATORIAS.filter(t => !existentes.has(t));

    if (faltantes.length > 0) {
        throw new Error(`Tabelas obrigatorias ausentes apos DDL: ${faltantes.join(', ')}.`);
    }
}

// Executa criacao idempotente do schema e aplica seed apenas quando o banco esta vazio
async function inicializarBanco() {
    const pastaSql = path.resolve(__dirname, '../../sql');
    const comandosDdl = extrairComandosSql(path.join(pastaSql, '01_create_tables.sql'));
    const comandosSeed = extrairComandosSql(path.join(pastaSql, '02_seed_data.sql'));

    let conn: oracledb.Connection | null = null;

    try {
        await initPool();
        conn = await obterConexao();

        console.log('Executando criacao das tabelas e indices...');
        for (const sql of comandosDdl) {
            try {
                await conn.execute(sql);
            } catch (erro) {
                const err = erro as { errorNum?: number };
                // ORA-00955 (objeto ja existe) e ORA-01408 (coluna ja indexada) garantem idempotencia
                if (err.errorNum === 955 || err.errorNum === 1408) {
                    continue;
                }
                throw erro;
            }
        }

        await verificarTabelasObrigatorias(conn);

        const resContagem = await conn.execute<{
            totalUsuarios: number;
            totalProjetos: number;
            totalDemandas: number;
        }>(
            `SELECT (SELECT COUNT(*) FROM usuarios) AS "totalUsuarios",
                    (SELECT COUNT(*) FROM projetos) AS "totalProjetos",
                    (SELECT COUNT(*) FROM demandas) AS "totalDemandas"
               FROM dual`
        );

        const contagem = resContagem.rows?.[0];
        const totalUsuarios = Number(contagem?.totalUsuarios ?? 0);
        const totalProjetos = Number(contagem?.totalProjetos ?? 0);
        const totalDemandas = Number(contagem?.totalDemandas ?? 0);

        if (totalUsuarios > 0 || totalProjetos > 0 || totalDemandas > 0) {
            console.log(
                `Dados iniciais ja existem no banco (usuarios=${totalUsuarios}, projetos=${totalProjetos}, demandas=${totalDemandas}). Carga inicial ignorada.`
            );
        } else {
            console.log('Inserindo dados iniciais...');
            try {
                for (const sql of comandosSeed) {
                    await conn.execute(sql);
                }
                await conn.commit();
                console.log('Carga inicial concluida.');
            } catch (erroSeed) {
                try {
                    await conn.rollback();
                } catch {
                    // Ignora falha secundaria no rollback
                }
                throw erroSeed;
            }
        }

        console.log('Banco Oracle pronto para uso.');
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (erroFechamento) {
                console.error('Erro ao fechar conexao Oracle no initDb:', erroFechamento);
            }
        }
        await closePool();
    }
}

if (require.main === module) {
    inicializarBanco().catch(erro => {
        console.error(
            'Falha ao inicializar banco Oracle:',
            erro instanceof Error ? erro.message : erro
        );
        process.exit(1);
    });
}
