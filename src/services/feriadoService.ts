// Autor: Abdallah Ali Borges El Khatib
// Validacao de formato de data ISO e consulta de feriados nacionais via BrasilAPI

interface FeriadoBrasilApi {
    date: string;
    name: string;
    type?: string;
}

interface EntradaCacheFeriados {
    feriados: FeriadoBrasilApi[];
    expiraEm: number;
}

const ANO_MINIMO_BRASIL_API = 1900;
const ANO_MAXIMO_BRASIL_API = 2199;
const TIMEOUT_BRASIL_API_MS = 5000;
const TTL_CACHE_MS = 24 * 60 * 60 * 1000;

export class ErroApiFeriado extends Error {
    constructor(mensagem: string) {
        super(mensagem);
        this.name = 'ErroApiFeriado';
    }
}

export class ErroAnoForaDaFaixa extends Error {
    constructor(mensagem: string) {
        super(mensagem);
        this.name = 'ErroAnoForaDaFaixa';
    }
}

// Cache em memoria por ano com expiracao de 24h para reduzir chamadas externas repetidas
const cacheFeriadosPorAno = new Map<number, EntradaCacheFeriados>();

// Verifica se a data segue YYYY-MM-DD e existe realmente no calendario gregoriano
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

// Alias mantido para compatibilidade entre rotas de cadastro e edicao de demandas
export const dataIsoValida = validarFormatoDataIso;

// Valida estrutura minima dos itens retornados pela BrasilAPI antes de gravar no cache
function listaFeriadosValida(dados: unknown): dados is FeriadoBrasilApi[] {
    if (!Array.isArray(dados)) {
        return false;
    }

    return dados.every(
        item =>
            item !== null &&
            typeof item === 'object' &&
            typeof (item as Record<string, unknown>).date === 'string' &&
            typeof (item as Record<string, unknown>).name === 'string'
    );
}

// Consulta feriados nacionais de um ano especifico com timeout e validacao de resposta
async function buscarFeriadosDoAno(ano: number): Promise<FeriadoBrasilApi[]> {
    if (!Number.isInteger(ano) || ano < ANO_MINIMO_BRASIL_API || ano > ANO_MAXIMO_BRASIL_API) {
        throw new ErroAnoForaDaFaixa(
            `O ano ${ano} está fora do intervalo suportado para consulta de feriados (${ANO_MINIMO_BRASIL_API} a ${ANO_MAXIMO_BRASIL_API}).`
        );
    }

    const entradaCache = cacheFeriadosPorAno.get(ano);
    if (entradaCache && entradaCache.expiraEm > Date.now()) {
        return entradaCache.feriados;
    }

    const url = `https://brasilapi.com.br/api/feriados/v1/${ano}`;
    let resposta: globalThis.Response;

    try {
        resposta = await fetch(url, {
            signal: AbortSignal.timeout(TIMEOUT_BRASIL_API_MS)
        });
    } catch {
        throw new ErroApiFeriado(
            'Não foi possível consultar a API externa de feriados nacionais no momento.'
        );
    }

    if (resposta.status === 404) {
        throw new ErroAnoForaDaFaixa(
            `O ano ${ano} não é suportado pela API de feriados nacionais.`
        );
    }

    if (!resposta.ok) {
        throw new ErroApiFeriado(
            `Falha ao consultar feriados nacionais para o ano ${ano} (status ${resposta.status}).`
        );
    }

    let corpoJson: unknown;
    try {
        corpoJson = await resposta.json();
    } catch {
        throw new ErroApiFeriado(
            'Não foi possível interpretar a resposta da API externa de feriados nacionais.'
        );
    }

    if (!listaFeriadosValida(corpoJson)) {
        throw new ErroApiFeriado(
            'Formato inesperado recebido da API externa de feriados nacionais.'
        );
    }

    cacheFeriadosPorAno.set(ano, {
        feriados: corpoJson,
        expiraEm: Date.now() + TTL_CACHE_MS
    });

    return corpoJson;
}

// Verifica se uma data YYYY-MM-DD corresponde a um feriado nacional brasileiro
export async function verificarFeriadoNacional(
    dataIso: string
): Promise<{ ehFeriado: boolean; nome?: string }> {
    if (!validarFormatoDataIso(dataIso)) {
        throw new ErroAnoForaDaFaixa('Data inválida para consulta de feriado. Utilize YYYY-MM-DD.');
    }

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
