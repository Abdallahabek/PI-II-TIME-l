// Autor: Lucas Ruman
// Suite automatizada de testes HTTP dos endpoints da API e da documentacao Swagger/OpenAPI

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { before, after, test, mock, afterEach } from 'node:test';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import app from '../src/server';
import { gerarHashSenha, gerarToken } from '../src/middlewares/auth';
import * as banco from '../src/config/database';
import * as feriados from '../src/services/feriadoService';

let server: Server;
let base: string;
let token: string;

const usuario = { id: 1, nome: 'Teste', email: 'teste@example.org', perfil: 'Administrador' as const };

// Garante AUTH_SECRET de teste em memoria e sobe o Express em porta efemera antes da suite
before(async () => {
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.trim() === '') {
        process.env.AUTH_SECRET = 'segredo-de-testes-automatizados-pi2-2026';
    }
    token = gerarToken(usuario);

    await new Promise<void>(resolve => {
        server = app.listen(0, '127.0.0.1', () => {
            base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
            resolve();
        });
    });
});

// Encerra o servidor efemero e restaura mocks entre os testes
after(() => new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve()))));
afterEach(() => mock.restoreAll());

// Helper HTTP para chamar rotas do servidor de testes com Bearer token opcional
function chamar(method: string, path: string, body?: object, auth?: string) {
    const tokenUso = auth === undefined ? token : auth;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (tokenUso !== '') {
        headers.authorization = 'Bearer ' + tokenUso;
    }
    return fetch(base + path, {
        method,
        headers,
        body: body && JSON.stringify(body)
    });
}

// Inventario das 14 operacoes oficiais cobertas pela API e pelo documento OpenAPI
const rotas = [
    'GET /',
    'POST /login',
    'GET /usuarios',
    'GET /projetos',
    'GET /dashboard',
    'GET /demandas',
    'POST /demandas',
    'GET /demandas/{id}',
    'PUT /demandas/{id}',
    'GET /demandas/{id}/comentarios',
    'POST /demandas/{id}/comentarios',
    'GET /demandas/{id}/historico',
    'PATCH /demandas/{id}/status',
    'PATCH /demandas/{id}/cancelar'
];

// Verifica inventario OpenAPI 3.0.3 e renderizacao da pagina Swagger UI
test('Swagger cobre as operações esperadas', async () => {
    const res = await chamar('GET', '/openapi.json');
    const doc = (await res.json()) as { paths: Record<string, object> };
    const operations = Object.entries(doc.paths).flatMap(([path, ops]) =>
        Object.keys(ops).map(m => m.toUpperCase() + ' ' + path)
    );
    assert.deepEqual(operations.sort(), [...rotas].sort());
    assert.match(await (await chamar('GET', '/api-docs')).text(), /SwaggerUIBundle/);
});

// Verifica exigencia de autenticacao Bearer em todas as 12 rotas protegidas
for (const route of rotas.slice(2)) {
    test(route + ' exige autenticação', async () => {
        const [method, path] = route.split(' ');
        assert.equal((await chamar(method, path.replace('{id}', '1'), undefined, '')).status, 401);
    });
}

// Verifica rejeicao de tokens adulterados (chave antiga) e tokens com exp invalido/expirado
test('Rotas protegidas rejeitam token adulterado ou expirado com 401', async () => {
    const criarTokenForjado = (payload: object, segredo: string) => {
        const corpo = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
        const assinatura = crypto.createHmac('sha256', segredo).update(corpo).digest('base64url');
        return `${corpo}.${assinatura}`;
    };

    const tokenChaveAntiga = criarTokenForjado(
        { ...usuario, exp: Date.now() + 60_000 },
        'pi2-time1-chave-padrao'
    );
    const tokenExpInvalido = criarTokenForjado(
        { ...usuario, exp: 1 },
        process.env.AUTH_SECRET!
    );

    assert.equal((await chamar('GET', '/demandas', undefined, tokenChaveAntiga)).status, 401);
    assert.equal((await chamar('GET', '/demandas', undefined, tokenExpInvalido)).status, 401);
});

// Verifica endpoint de disponibilidade raiz (status, bancoConectado e authConfigurado)
test('Raiz informa estado online e indicadores de configuração', async () => {
    const data = (await (await chamar('GET', '/')).json()) as {
        status: string;
        bancoConectado: boolean;
        authConfigurado: boolean;
    };
    assert.equal(data.status, 'Online');
    assert.equal(typeof data.bancoConectado, 'boolean');
    assert.equal(data.authConfigurado, true);
});

// Verifica autenticacao com hash scrypt, campos obrigatorios e JSON malformado (400)
test('Login valida campos, credenciais com hash scrypt e rejeita JSON malformado', async () => {
    const senhaHash = gerarHashSenha('exemplo');
    mock.method(banco, 'executarQuery', async () => ({ rows: [{ ...usuario, senha: senhaHash }] }));

    assert.equal((await chamar('POST', '/login', {})).status, 400);
    assert.equal((await chamar('POST', '/login', { email: usuario.email, senha: 'incorreta' })).status, 401);

    const resOk = await chamar('POST', '/login', { email: usuario.email, senha: 'exemplo' });
    assert.equal(resOk.status, 200);
    assert.ok(((await resOk.json()) as { token: string }).token);

    const resJsonInvalido = await fetch(base + '/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{json-invalido'
    });
    assert.equal(resJsonInvalido.status, 400);
});

// Verifica respostas vazias consistentes nas rotas principais de consulta
for (const path of ['/usuarios', '/projetos', '/demandas', '/dashboard']) {
    test('Consulta vazia ' + path, async () => {
        mock.method(banco, 'executarQuery', async () => ({ rows: [] }));
        const res = await chamar('GET', path);
        assert.equal(res.status, 200);
        const data = (await res.json()) as Record<string, unknown>;
        if (path === '/dashboard') {
            assert.equal(data.totalDemandas, 0);
        } else {
            assert.deepEqual(data[path.slice(1)], []);
        }
    });
}

// Verifica filtro ?projetoId= em GET /usuarios (valido -> 200, invalido -> 400)
test('GET /usuarios aceita ?projetoId= válido e rejeita inválido', async () => {
    let bindsRecebidos: Record<string, unknown> = {};
    mock.method(banco, 'executarQuery', async (_sql: string, binds?: Record<string, unknown>) => {
        bindsRecebidos = binds || {};
        return { rows: [] };
    });

    assert.equal((await chamar('GET', '/usuarios?projetoId=abc')).status, 400);
    assert.equal((await chamar('GET', '/usuarios?projetoId=2')).status, 200);
    assert.equal(bindsRecebidos.projetoId, 2);
});

// Verifica rejeicao de IDs nao numericos em todas as rotas com {id}
for (const route of rotas.filter(r => r.includes('{id}'))) {
    test(route + ' rejeita ID inválido', async () => {
        const [method, path] = route.split(' ');
        const body = method === 'GET' ? undefined : { status: 'Aberta' };
        assert.equal((await chamar(method, path.replace('{id}', 'abc'), body)).status, 400);
    });
}

test('Demanda inexistente retorna 404', async () => {
    mock.method(banco, 'executarQuery', async () => ({ rows: [] }));
    assert.equal((await chamar('GET', '/demandas/999')).status, 404);
});

// Verifica bloqueio de novos comentarios em demandas Concluidas ou Canceladas (400)
test('POST /demandas/{id}/comentarios bloqueia demanda Concluída com 400', async () => {
    mock.method(banco, 'executarQuery', async () => ({
        rows: [
            {
                id: 6,
                titulo: 'Ajuste GPS',
                descricao: 'Concluída',
                tipo: 'Melhoria',
                prioridade: 'Alta',
                status: 'Concluída',
                projetoId: 3,
                projetoNome: 'App Mobile',
                responsavelId: 6,
                responsavelNome: 'Lucas Ruman',
                dataCriacao: '2026-11-01T10:00:00Z',
                dataAtualizacao: '2026-11-05T10:00:00Z',
                prazoFinalizacao: '2026-11-10'
            }
        ]
    }));

    const res = await chamar('POST', '/demandas/6/comentarios', { texto: 'Tentativa após conclusão' });
    assert.equal(res.status, 400);
    assert.match(await res.text(), /concluídas ou canceladas/i);
});

// Verifica validacoes de cadastro: campos obrigatorios, feriado nacional (400) e ano fora da faixa (400)
test('Cadastro rejeita dados incompletos, prazo em feriado e ano fora da faixa', async () => {
    assert.equal((await chamar('POST', '/demandas', {})).status, 400);

    mock.method(banco, 'executarQuery', async () => ({ rows: [{ id: 1, nome: 'Portal' }] }));
    mock.method(feriados, 'verificarFeriadoNacional', async () => ({ ehFeriado: true, nome: 'Natal' }));

    const resFeriado = await chamar('POST', '/demandas', {
        titulo: 'Entrega',
        descricao: 'Revisar',
        tipo: 'Tarefa',
        prioridade: 'Alta',
        projetoId: 1,
        prazoFinalizacao: '2027-12-25'
    });
    assert.equal(resFeriado.status, 400);
    assert.match(await resFeriado.text(), /feriado/i);

    mock.restoreAll();
    mock.method(banco, 'executarQuery', async () => ({ rows: [{ id: 1, nome: 'Portal' }] }));
    const resAnoInvalido = await chamar('POST', '/demandas', {
        titulo: 'Entrega futura',
        descricao: 'Revisar',
        tipo: 'Tarefa',
        prioridade: 'Alta',
        projetoId: 1,
        prazoFinalizacao: '2200-01-01'
    });
    assert.equal(resAnoInvalido.status, 400);
});

test('Filtro desconhecido é rejeitado', async () => {
    assert.equal((await chamar('GET', '/demandas?prioridade=invalida')).status, 400);
});

// Verifica suporte ao filtro responsavelId=sem_responsavel usado no frontend
test('Listagem aceita responsavelId=sem_responsavel gerando IS NULL', async () => {
    let consulta = '';
    mock.method(banco, 'executarQuery', async (sql: string) => {
        consulta = sql;
        return { rows: [] };
    });

    const res = await chamar('GET', '/demandas?responsavelId=sem_responsavel');
    assert.equal(res.status, 200);
    assert.match(consulta, /d\.responsavel_id IS NULL/);
});

// Verifica combinacao avancada de filtros, busca por palavras e multi-ordenacao em GET /demandas
test('Listagem combina filtros, busca por palavras e critérios de ordenação', async () => {
    let consulta = '';
    let parametros: Record<string, unknown> = {};
    mock.method(banco, 'executarQuery', async (sql: string, binds: Record<string, unknown>) => {
        consulta = sql;
        parametros = binds;
        return { rows: [] };
    });

    const query = new URLSearchParams({
        responsavelId: '7,9',
        campoData: 'LastUpdate',
        de: '2026-11-01',
        ate: '2026-11-30',
        busca: 'ação café',
        acentos: 'force-ignore',
        palavras: 'todas',
        comparacao: 'prefixo',
        buscarEm: 'titulo,descricao',
        ordenarPor: 'prioridade,LastUpdate',
        ordem: 'ASC,DESC'
    });

    assert.equal((await chamar('GET', '/demandas?' + query)).status, 200);
    assert.equal(parametros.responsavelId1, 9);
    assert.equal(parametros.busca0, 'ação%');
    assert.equal(parametros.busca1, 'café%');
    assert.match(consulta, /d\.data_atualizacao >= TO_DATE/);
    assert.match(consulta, /d\.data_atualizacao DESC NULLS LAST/);
});
