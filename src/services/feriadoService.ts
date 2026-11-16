// Autor: Abdallah Ali Borges El Khatib
// Validacao de data e consulta de feriados nacionais via BrasilAPI

interface FeriadoBrasilApi {
    date: string;
    name: string;
    type: string;
}

export class ErroApiFeriado extends Error {
    constructor(mensagem: string) {
        super(mensagem);
        this.name = 'ErroApiFeriado';
    }
}

const cacheFeriadosPorAno = new Map<number, FeriadoBrasilApi[]>();

// Verifica formato YYYY-MM-DD e se o dia existe no calendario
export function validarFormatoDataIso(dataStr: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataStr);
    if (!match) {
        return false;
    }

    const ano = Number(match[1]);
    const mes = Number(match[2]);
    const dia = Number(match[3]);

    const data = new Date(Date.UTC(ano, mes - 1, dia));
    return (
        data.getUTCFullYear() === ano &&
        data.getUTCMonth() === mes - 1 &&
        data.getUTCDate() === dia
    );
}

async function buscarFeriadosDoAno(ano: number): Promise<FeriadoBrasilApi[]> {
    const emCache = cacheFeriadosPorAno.get(ano);
    if (emCache) {
        return emCache;
    }

    const url = `https://brasilapi.com.br/api/feriados/v1/${ano}`;
    let resposta: globalThis.Response;

    try {
        resposta = await fetch(url, {
            signal: AbortSignal.timeout(5000)
        });
    } catch {
        throw new ErroApiFeriado(
            'Nao foi possivel consultar a API externa de feriados nacionais no momento.'
        );
    }

    if (!resposta.ok) {
        throw new ErroApiFeriado(
            `Falha ao consultar feriados nacionais para o ano ${ano} (status ${resposta.status}).`
        );
    }

    const lista = (await resposta.json()) as FeriadoBrasilApi[];
    cacheFeriadosPorAno.set(ano, lista);
    return lista;
}

export async function verificarFeriadoNacional(
    dataIso: string
): Promise<{ ehFeriado: boolean; nome?: string }> {
    const ano = Number(dataIso.slice(0, 4));
    const feriados = await buscarFeriadosDoAno(ano);

    const encontrado = feriados.find(
        f => f.date === dataIso && (f.type === 'national' || !f.type)
    );

    if (encontrado) {
        return { ehFeriado: true, nome: encontrado.name };
    }

    return { ehFeriado: false };
}
