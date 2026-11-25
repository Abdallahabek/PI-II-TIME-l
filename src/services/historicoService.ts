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

const LIMITE_CAMPO = 50;
const LIMITE_VALOR = 200;
const LIMITE_DESCRICAO = 500;

// Sanitiza textos obrigatorios evitando string vazia (tratada como NULL no Oracle) e estouro de coluna
function normalizarObrigatorio(valor: string, limite: number, nomeCampo: string): string {
    const limpo = typeof valor === 'string' ? valor.trim() : '';
    if (!limpo) {
        throw new Error(`Campo obrigatorio do historico nao pode ser vazio: ${nomeCampo}.`);
    }
    return limpo.slice(0, limite);
}

function normalizarOpcional(valor: string | null, limite: number): string | null {
    if (valor === null || valor === undefined) {
        return null;
    }
    const limpo = String(valor).trim();
    return limpo ? limpo.slice(0, limite) : null;
}

// Insere registro de alteracao imutavel em UTC usando a conexao da transacao quando informada
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
            descricao,
            data_alteracao
        ) VALUES (
            :demandaId,
            :usuarioId,
            :campoAlterado,
            :valorAnterior,
            :valorNovo,
            :descricao,
            SYS_EXTRACT_UTC(SYSTIMESTAMP)
        )
    `;

    const binds = {
        demandaId: dados.demandaId,
        usuarioId: dados.usuarioId,
        campoAlterado: normalizarObrigatorio(dados.campoAlterado, LIMITE_CAMPO, 'campoAlterado'),
        valorAnterior: normalizarOpcional(dados.valorAnterior, LIMITE_VALOR),
        valorNovo: normalizarObrigatorio(dados.valorNovo, LIMITE_VALOR, 'valorNovo'),
        descricao: normalizarObrigatorio(dados.descricao, LIMITE_DESCRICAO, 'descricao')
    };

    if (conn) {
        await conn.execute(sql, binds);
        return;
    }

    await executarQuery(sql, binds);
}
