// Autor: Abdallah Ali Borges El Khatib
// Registro automatico de historico de alteracoes das demandas

import oracledb from 'oracledb';
import { executarQuery } from '../config/database';

export interface RegistroHistoricoInput {
    demandaId: number;
    usuarioId: number;
    campoAlterado: string;
    valorAnterior: string | null;
    valorNovo: string;
    descricao: string;
}

// Insere registro de alteracao imutavel usando conexao da transacao quando informada
export async function registrarHistorico(
    dados: RegistroHistoricoInput,
    conn?: oracledb.Connection
): Promise<void> {
    const sql = `
        INSERT INTO historico_alteracoes (
            demanda_id,
            usuario_id,
            campo_alterado,
            valor_anterior,
            valor_novo,
            descricao
        ) VALUES (
            :demandaId,
            :usuarioId,
            :campoAlterado,
            :valorAnterior,
            :valorNovo,
            :descricao
        )
    `;

    const binds = {
        demandaId: dados.demandaId,
        usuarioId: dados.usuarioId,
        campoAlterado: dados.campoAlterado,
        valorAnterior: dados.valorAnterior,
        valorNovo: dados.valorNovo,
        descricao: dados.descricao
    };

    if (conn) {
        await conn.execute(sql, binds);
        return;
    }

    await executarQuery(sql, binds);
}
