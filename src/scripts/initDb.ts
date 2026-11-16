// Autor: Abdallah Ali Borges El Khatib
// Script para criar as tabelas e popular os dados iniciais no Oracle via .env

import fs from 'fs';
import path from 'path';
import { closePool, initPool, obterConexao } from '../config/database';

function extrairComandosSql(caminhoArquivo: string): string[] {
    const conteudo = fs.readFileSync(caminhoArquivo, 'utf8');
    const semComentarios = conteudo
        .split(/\r?\n/)
        .filter(linha => !linha.trim().startsWith('--'))
        .join('\n');

    return semComentarios
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && cmd.toUpperCase() !== 'COMMIT');
}

async function inicializarBanco() {
    const pastaSql = path.resolve(__dirname, '../../sql');
    const comandosDdl = extrairComandosSql(path.join(pastaSql, '01_create_tables.sql'));
    const comandosSeed = extrairComandosSql(path.join(pastaSql, '02_seed_data.sql'));

    await initPool();
    const conn = await obterConexao();

    try {
        console.log('Executando criacao das tabelas...');
        for (const sql of comandosDdl) {
            try {
                await conn.execute(sql);
            } catch (erro) {
                const err = erro as { errorNum?: number };
                // ORA-00955: objeto ja existe no schema
                if (err.errorNum === 955) {
                    continue;
                }
                throw erro;
            }
        }

        const resUsuarios = await conn.execute<{ total: number }>(
            'SELECT COUNT(*) AS "total" FROM usuarios'
        );
        const totalUsuarios = Number(resUsuarios.rows?.[0]?.total ?? 0);

        if (totalUsuarios > 0) {
            console.log('Dados iniciais ja existem no banco. Carga inicial ignorada.');
        } else {
            console.log('Inserindo dados iniciais...');
            for (const sql of comandosSeed) {
                await conn.execute(sql);
            }
            await conn.commit();
            console.log('Carga inicial concluida.');
        }

        console.log('Banco Oracle pronto para uso.');
    } finally {
        await conn.close();
        await closePool();
    }
}

inicializarBanco().catch(erro => {
    console.error('Falha ao inicializar banco Oracle:', erro.message || erro);
    process.exit(1);
});
