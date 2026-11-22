import express from 'express';

const demanda = 'titulo descricao tipo prioridade projetoId responsavelId prazoFinalizacao';
const operacoes = [
    ['get', '/', 'Consultar estado da API'],
    ['post', '/login', 'Autenticar usuário', 'email senha'],
    ['get', '/usuarios', 'Listar usuários'],
    ['get', '/projetos', 'Listar projetos acessíveis'],
    ['get', '/dashboard', 'Consultar indicadores'],
    ['get', '/demandas', 'Buscar e ordenar demandas'],
    ['post', '/demandas', 'Cadastrar demanda', demanda],
    ['put', '/demandas/{id}', 'Editar demanda', demanda],
    ['get', '/demandas/{id}', 'Consultar demanda'],
    ['get', '/demandas/{id}/comentarios', 'Listar comentários'],
    ['post', '/demandas/{id}/comentarios', 'Adicionar comentário', 'texto'],
    ['get', '/demandas/{id}/historico', 'Consultar histórico'],
    ['patch', '/demandas/{id}/status', 'Alterar status', 'status'],
    ['patch', '/demandas/{id}/cancelar', 'Cancelar demanda']
];

const paths: Record<string, Record<string, unknown>> = {};
for (const [method, path, summary, fields] of operacoes) {
    const publico = path === '/' || path === '/login';
    const parameters: object[] = [];
    if (path.includes('{id}')) parameters.push({ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } });
    if (method === 'get' && path === '/demandas') {
        for (const name of ['status','prioridade','tipo','responsavelId','projetoId','busca','ordenarPor','ordem']) {
            parameters.push({ name, in: 'query', schema: { type: name.endsWith('Id') ? 'integer' : 'string' } });
        }
    }
    const success = method === 'post' && path !== '/login' ? 201 : 200;
    const responses: Record<string, object> = { [success]: { description: summary, content: { 'application/json': { schema: { type: 'object' } } } } };
    const errors: Record<number,string> = {400:'Entrada inválida',401:'Credenciais inválidas ou ausentes',403:'Acesso negado',404:'Recurso inexistente',409:'Conflito de atualização',500:'Erro interno',503:'Serviço indisponível'};
    const codes = path === '/' ? [] : [401,500,503];
    if (fields || path.includes('{id}') || path === '/demandas') codes.push(400);
    if (path.includes('{id}') || fields === demanda) codes.push(403,404);
    if (method === 'patch') codes.push(409);
    for (const code of codes) responses[code] = { description: errors[code], content: { 'application/json': { schema: { type:'object', properties:{ erro:{type:'boolean'}, mensagem:{type:'string'} } } } } };
    let requestBody;
    if (fields) {
        const keys = fields.split(' ');
        const properties = Object.fromEntries(keys.map(name => [name, { type: name.endsWith('Id') ? 'integer' : 'string', ...(name === 'prazoFinalizacao' ? { format:'date' } : {}), ...(name === 'senha' ? {format:'password'} : {}) }]));
        requestBody = { required:true, content:{ 'application/json':{schema:{type:'object',properties,required:keys.filter(k => !['prazoFinalizacao','responsavelId'].includes(k))} } } };
    }
    (paths[path] ??= {})[method] = {summary, parameters, responses, security:publico ? [] : [{ bearer:[] }], requestBody};
}
export const documento = { openapi:'3.0.3', info:{ title:'API de Demandas', version:'1.0.0' }, paths, components:{securitySchemes:{bearer:{type:'http',scheme:'bearer'}}} };

export function registrarSwagger(app: express.Express, somenteDocs = false) {
    app.get('/openapi.json', (_req,res) => res.json(documento));
    app.get('/api-docs', (_req,res) => res.type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>API de Demandas</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui',supportedSubmitMethods:${somenteDocs ? '[]' : JSON.stringify(['get','post','put','patch'])}})</script></body></html>`));
}
if (require.main === module) {
    const app = express();
    registrarSwagger(app,true);
    app.get('/', (_req,res) => res.redirect('/api-docs'));
    const port = Number(process.env.PORT || 3000);
    app.listen(port, () => console.log('Swagger em http://localhost:' + port + '/api-docs'));
}

