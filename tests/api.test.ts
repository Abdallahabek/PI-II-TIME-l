import assert from 'node:assert/strict';
import { before, after, test, mock, afterEach } from 'node:test';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import app from '../src/server';
import { gerarToken } from '../src/middlewares/auth';
import * as banco from '../src/config/database';
import * as feriados from '../src/services/feriadoService';

let server: Server;
let base: string;
const usuario = { id: 1, nome: 'Teste', email: 'teste@example.org', perfil: 'Administrador' as const };
const token = gerarToken(usuario);
before(async () => {
    await new Promise<void>(resolve => {
        server = app.listen(0, '127.0.0.1', () => {
            base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
            resolve();
        });
    });
});
after(() => new Promise<void>((resolve,reject) => server.close(err => err ? reject(err) : resolve())));
afterEach(() => mock.restoreAll());
function chamar(method:string, path:string, body?:object, auth = token) {
    return fetch(base + path, {method,headers:{'content-type':'application/json',authorization:'Bearer ' + auth},body:body && JSON.stringify(body)});
}
const rotas = [
    'GET /','POST /login','GET /usuarios','GET /projetos','GET /dashboard',
    'GET /demandas','POST /demandas','GET /demandas/{id}','PUT /demandas/{id}',
    'GET /demandas/{id}/comentarios','POST /demandas/{id}/comentarios',
    'GET /demandas/{id}/historico','PATCH /demandas/{id}/status','PATCH /demandas/{id}/cancelar'
];
test('Swagger cobre as operações esperadas', async () => {
    const res = await chamar('GET','/openapi.json');
    const doc = await res.json() as {paths:Record<string,object>};
    const operations = Object.entries(doc.paths).flatMap(([path,ops]) => Object.keys(ops).map(m => m.toUpperCase()+' '+path));
    assert.deepEqual(operations.sort(), [...rotas].sort());
    assert.match(await (await chamar('GET','/api-docs')).text(), /SwaggerUIBundle/);
});
for (const route of rotas.slice(2)) {
    test(route + ' exige autenticação', async () => {
        const [method,path] = route.split(' ');
        assert.equal((await chamar(method,path.replace('{id}','1'),undefined,'')).status,401);
    });
}
test('Raiz informa estado online',async () => assert.equal((await (await chamar('GET','/')).json() as {status:string}).status,'Online'));
test('Login valida campos e credenciais', async () => {
    mock.method(banco,'executarQuery', async () => ({ rows:[{...usuario,senha:'exemplo'}] }));
    assert.equal((await chamar('POST','/login',{})).status,400);
    assert.equal((await chamar('POST','/login',{email:usuario.email,senha:'incorreta'})).status,401);
    const res = await chamar('POST','/login',{email:usuario.email,senha:'exemplo'});
    assert.equal(res.status,200);
    assert.ok((await res.json() as {token:string}).token);
});
for (const path of ['/usuarios','/projetos','/demandas','/dashboard']) {
    test('Consulta vazia ' + path, async () => {
        mock.method(banco,'executarQuery', async () => ({rows:[]}));
        const res = await chamar('GET',path);
        assert.equal(res.status,200);
        const data = await res.json() as Record<string,unknown>;
        if (path === '/dashboard') assert.equal(data.totalDemandas,0);
        else assert.deepEqual(data[path.slice(1)],[]);
    });
}
for (const route of rotas.filter(r => r.includes('{id}'))) {
    test(route + ' rejeita ID inválido', async () => {
        const [method,path] = route.split(' ');
        assert.equal((await chamar(method,path.replace('{id}','abc'),{status:'Aberta'})).status,400);
    });
}
test('Demanda inexistente retorna 404',async () => {
    mock.method(banco,'executarQuery',async () => ({rows:[]}));
    assert.equal((await chamar('GET','/demandas/999')).status,404);
});
test('Cadastro rejeita dados incompletos e prazo em feriado',async () => {
    assert.equal((await chamar('POST','/demandas',{})).status,400);
    mock.method(banco,'executarQuery',async () => ({rows:[{id:1}]}));
    mock.method(feriados,'verificarFeriadoNacional',async () => ({ehFeriado:true,nome:'Natal'}));
    const res = await chamar('POST','/demandas',{titulo:'Entrega',descricao:'Revisar',tipo:'Tarefa',prioridade:'Alta',projetoId:1,prazoFinalizacao:'2026-12-25'});
    assert.equal(res.status,400);
    assert.match(await res.text(),/feriado/i);
});
test('Filtro desconhecido é rejeitado',async () => assert.equal((await chamar('GET','/demandas?prioridade=invalida')).status,400));

