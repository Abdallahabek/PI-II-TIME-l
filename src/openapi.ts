import express from 'express';

const demanda = 'titulo descricao tipo prioridade projetoId responsavelId prazoFinalizacao';
const operacoes = [
    ['get', '/', 'Consultar estado da API', "Consulta se o servidor HTTP está respondendo. O valor Online indica o estado da API, sem verificar a conexão Oracle."],
    ['post', '/login', 'Autenticar usuário', 'email senha', "Valida e-mail e senha e devolve o token e o perfil do usuário. Use o token em Authorize para acessar as operações protegidas."],
    ['get', '/usuarios', 'Listar usuários', "Lista os usuários que podem ser consultados para atribuir um responsável à demanda."],
    ['get', '/projetos', 'Listar projetos acessíveis', "Retorna os projetos visíveis para o usuário autenticado, conforme perfil e vínculos."],
    ['get', '/dashboard', 'Consultar indicadores', "Agrupa demandas visíveis por status, prioridade e tipo e destaca demandas críticas abertas e prazos próximos."],
    ['get', '/demandas', 'Buscar e ordenar demandas', "Combina filtros e procura texto no título ou na descrição. Por padrão, retorna as demandas mais recentes primeiro."],
    ['post', '/demandas', 'Cadastrar demanda', demanda, "Cadastra uma demanda no projeto informado. Administradores e líderes de projeto podem realizar o cadastro."],
    ['put', '/demandas/{id}', 'Editar demanda', demanda, "Atualiza os dados da demanda identificada na URL. Envie os campos obrigatórios mesmo ao alterar apenas o título."],
    ['get', '/demandas/{id}', 'Consultar demanda', "Retorna os dados de uma demanda depois de verificar o acesso do usuário ao projeto."],
    ['get', '/demandas/{id}/comentarios', 'Listar comentários', "Consulta os comentários associados à demanda e informa o total encontrado."],
    ['post', '/demandas/{id}/comentarios', 'Adicionar comentário', 'texto', "Registra o texto enviado como comentário do usuário autenticado na demanda indicada."],
    ['get', '/demandas/{id}/historico', 'Consultar histórico', "Consulta o histórico de alterações registradas para essa demanda."],
    ['patch', '/demandas/{id}/status', 'Alterar status', 'status', "Move a demanda para o status informado se a transição for permitida para o estado atual e o perfil do usuário."],
    ['patch', '/demandas/{id}/cancelar', 'Cancelar demanda', "Marca a demanda como cancelada. Exige perfil de administrador ou líder de projeto e rejeita demandas concluídas ou já canceladas."]
];

const campos: Record<string, [string, string | number]> = {
    "email": [
        "E-mail de acesso do usuário.",
        "pessoa@example.org"
    ],
    "senha": [
        "Senha da conta usada no login.",
        "senha-de-exemplo"
    ],
    "titulo": [
        "Nome curto que identifica a demanda.",
        "Corrigir tela de login"
    ],
    "descricao": [
        "Detalhes do problema ou trabalho solicitado.",
        "Exibir mensagem quando o e-mail estiver vazio."
    ],
    "tipo": [
        "Categoria da demanda: Tarefa, Defeito, Melhoria ou Documentação.",
        "Defeito"
    ],
    "prioridade": [
        "Grau de urgência: Crítica, Alta, Média ou Baixa.",
        "Alta"
    ],
    "projetoId": [
        "Identificador do projeto vinculado à demanda.",
        3
    ],
    "responsavelId": [
        "Identificador do usuário responsável pela demanda.",
        7
    ],
    "prazoFinalizacao": [
        "Data limite no formato AAAA-MM-DD. Feriados nacionais são rejeitados.",
        "2027-03-10"
    ],
    "texto": [
        "Conteúdo do novo comentário.",
        "Correção pronta para revisão."
    ],
    "status": [
        "Estado da demanda: Aberta, Em andamento, Em revisão, Concluída ou Cancelada.",
        "Em andamento"
    ],
    "busca": [
        "Trecho do título ou da descrição, sem distinguir maiúsculas e minúsculas.",
        "login"
    ],
    "ordenarPor": [
        "Critério de ordenação: prioridade, dataCriacao, prazoFinalizacao ou status.",
        "prazoFinalizacao"
    ],
    "ordem": [
        "Direção do critério escolhido: ASC (crescente) ou DESC (decrescente).",
        "ASC"
    ]
};

function objeto(description: string, properties: Record<string, object>) { return { type: 'object', description, properties }; }
function lista(description: string, items: object) { return { type: 'array', description, items }; }
const atributo = {
  "id": {
    "type": "integer",
    "description": "Identificador do registro."
  },
  "nome": {
    "type": "string",
    "description": "Nome de exibição."
  },
  "email": {
    "type": "string",
    "description": "E-mail do usuário."
  },
  "perfil": {
    "type": "string",
    "description": "Perfil que define as permissões."
  },
  "descricao": {
    "type": "string",
    "description": "Descrição do registro."
  },
  "dataCriacao": {
    "type": "string",
    "description": "Data de criação."
  },
  "titulo": {
    "type": "string",
    "description": "Título da demanda."
  },
  "tipo": {
    "type": "string",
    "description": "Categoria da demanda."
  },
  "prioridade": {
    "type": "string",
    "description": "Grau de urgência."
  },
  "status": {
    "type": "string",
    "description": "Estado atual."
  },
  "projetoId": {
    "type": "integer",
    "description": "Identificador do projeto."
  },
  "projetoNome": {
    "type": "string",
    "description": "Nome do projeto."
  },
  "responsavelId": {
    "type": "integer",
    "description": "Identificador do responsável.",
    "nullable": true
  },
  "responsavelNome": {
    "type": "string",
    "description": "Nome do responsável.",
    "nullable": true
  },
  "dataAtualizacao": {
    "type": "string",
    "description": "Data da última atualização."
  },
  "prazoFinalizacao": {
    "type": "string",
    "description": "Data limite da demanda.",
    "nullable": true
  },
  "demandaId": {
    "type": "integer",
    "description": "Demanda associada ao registro."
  },
  "usuarioId": {
    "type": "integer",
    "description": "Identificador do autor."
  },
  "usuarioNome": {
    "type": "string",
    "description": "Nome do autor."
  },
  "texto": {
    "type": "string",
    "description": "Conteúdo do comentário."
  },
  "campoAlterado": {
    "type": "string",
    "description": "Campo modificado."
  },
  "valorAnterior": {
    "type": "string",
    "description": "Valor antes da alteração.",
    "nullable": true
  },
  "valorNovo": {
    "type": "string",
    "description": "Valor após a alteração."
  },
  "dataAlteracao": {
    "type": "string",
    "description": "Data da alteração."
  },
  "mensagem": {
    "type": "string",
    "description": "Mensagem sobre o resultado da operação."
  },
  "total": {
    "type": "integer",
    "description": "Quantidade de registros retornados."
  },
  "token": {
    "type": "string",
    "description": "Token Bearer usado nas rotas protegidas."
  },
  "projeto": {
    "type": "string",
    "description": "Nome da aplicação."
  },
  "totalDemandas": {
    "type": "integer",
    "description": "Quantidade de demandas visíveis."
  },
  "emAberto": {
    "type": "string",
    "description": "Estados considerados ativos."
  },
  "proximasDoPrazo": {
    "type": "string",
    "description": "Regra de inclusão na lista de prazos próximos."
  }
};
const usuario = objeto('Dados públicos do usuário.', {id: atributo.id, nome: atributo.nome, email: atributo.email, perfil: atributo.perfil});
const projetoObj = objeto('Dados do projeto.', {id: atributo.id, nome: atributo.nome, descricao: atributo.descricao, dataCriacao: atributo.dataCriacao});
const demandaObj = objeto('Dados da demanda.', {id: atributo.id, titulo: atributo.titulo, descricao: atributo.descricao, tipo: atributo.tipo, prioridade: atributo.prioridade, status: atributo.status, projetoId: atributo.projetoId, projetoNome: atributo.projetoNome, responsavelId: atributo.responsavelId, responsavelNome: atributo.responsavelNome, dataCriacao: atributo.dataCriacao, dataAtualizacao: atributo.dataAtualizacao, prazoFinalizacao: atributo.prazoFinalizacao});
const comentario = objeto('Comentário registrado.', {id: atributo.id, demandaId: atributo.demandaId, usuarioId: atributo.usuarioId, usuarioNome: atributo.usuarioNome, texto: atributo.texto, dataCriacao: atributo.dataCriacao});
const evento = objeto('Alteração registrada.', {id: atributo.id, demandaId: atributo.demandaId, usuarioId: atributo.usuarioId, usuarioNome: atributo.usuarioNome, campoAlterado: atributo.campoAlterado, valorAnterior: atributo.valorAnterior, valorNovo: atributo.valorNovo, descricao: atributo.descricao, dataAlteracao: atributo.dataAlteracao});
const contagem = (description: string) => ({type:'object',description,additionalProperties:{type:'integer',description:'Quantidade de demandas nesta categoria.'}});
const respostas: Record<string, Record<string,object>> = {
'get /': {projeto:atributo.projeto,status:atributo.status},
'post /login': {mensagem:atributo.mensagem,token:atributo.token,usuario},
'get /usuarios': {total:atributo.total,usuarios:lista('Usuários cadastrados.',usuario)},
'get /projetos': {total:atributo.total,projetos:lista('Projetos visíveis.',projetoObj)},
'get /demandas': {total:atributo.total,demandas:lista('Demandas que atendem aos filtros.',demandaObj)},
'get /demandas/{id}': {demanda:demandaObj},
'get /demandas/{id}/comentarios': {total:atributo.total,comentarios:lista('Comentários da demanda.',comentario)},
'post /demandas/{id}/comentarios': {mensagem:atributo.mensagem,comentario},
'get /demandas/{id}/historico': {total:atributo.total,historico:lista('Alterações da demanda.',evento)},
'get /dashboard': {totalDemandas:atributo.totalDemandas,porStatus:contagem('Quantidade por estado.'),porTipo:contagem('Quantidade por tipo.'),porPrioridade:contagem('Quantidade por prioridade.'),demandasCriticasEmAberto:lista('Demandas críticas ainda ativas.',demandaObj),demandasProximasPrazo:lista('Demandas ativas próximas do prazo ou vencidas.',demandaObj),criterios:objeto('Regras usadas no painel.',{emAberto:atributo.emAberto,proximasDoPrazo:atributo.proximasDoPrazo})}
};
for (const chave of ['post /demandas','put /demandas/{id}','patch /demandas/{id}/status','patch /demandas/{id}/cancelar']) respostas[chave] = {mensagem:atributo.mensagem,demanda:demandaObj};

const parametrosLista: Record<string, [string, string | number]> = {
    ...Object.fromEntries(["status","tipo","prioridade","projetoId","responsavelId"].map(nome => [nome,[campos[nome][0] + " Aceita vários valores separados por vírgula.", campos[nome][1]]])),
    busca: campos.busca as [string,string],
    ...{
    "campoData": [
        "Campo do período. Aceita TimeStamp (criação), LastUpdate (atualização) ou Deadline (prazo).",
        "LastUpdate"
    ],
    "de": [
        "Primeiro dia do período, inclusive.",
        "2026-11-01"
    ],
    "ate": [
        "Último dia do período, inclusive.",
        "2026-11-30"
    ],
    "situacaoPrazo": [
        "Aceita atrasada, hoje, futura (demandas em aberto) e semPrazo. Separe opções por vírgula.",
        "atrasada,hoje"
    ],
    "atribuicao": [
        "Use minhas, comResponsavel ou semResponsavel. Para escolher uma pessoa, use responsavelId.",
        "minhas"
    ],
    "buscarEm": [
        "Campos pesquisados, separados por vírgula. Opções: titulo, descricao, responsavel, projeto. O padrão pesquisa título e descrição.",
        "titulo,descricao"
    ],
    "comparacao": [
        "Comparação por campo e termo. Aceita contem (padrão), exata, prefixo ou sufixo.",
        "contem"
    ],
    "acentos": [
        "preservar mantém acentos. ignore permite café/cafe e mantém til e cedilha. force-ignore também permite ação/acao.",
        "force-ignore"
    ],
    "palavras": [
        "frase mantém a expressão inteira. todas exige cada termo. qualquer aceita pelo menos um.",
        "todas"
    ],
    "ordenarPor": [
        "Critérios em sequência: prioridade, dataCriacao (TimeStamp), prazoFinalizacao (Deadline), status, LastUpdate, dataAtualizacao, titulo, tipo, id, projeto e responsavel.",
        "prioridade,LastUpdate"
    ],
    "ordem": [
        "Direções ASC ou DESC na mesma sequência dos critérios.",
        "ASC,DESC"
    ]
} as Record<string,[string,string]>
};

const paths: Record<string, Record<string, unknown>> = {};
for (const [method, path, summary, ...detalhes] of operacoes) {
    const description = detalhes[detalhes.length - 1];
    const fields = detalhes.length === 2 ? detalhes[0] : undefined;
    const publico = path === '/' || path === '/login';
    const parameters: object[] = [];
    if (path.includes('{id}')) parameters.push({ name: 'id', description: 'Identificador numérico da demanda a consultar ou alterar.', example: 42, in: 'path', required: true, schema: { type: 'integer', minimum: 1 } });
    if (method === 'get' && path === '/demandas') {
        for (const [name, [description, example]] of Object.entries(parametrosLista)) {
            parameters.push({name, description, example:String(example), in:'query', schema:{type:'string'}});
        }
    }
    const success = method === 'post' && path !== '/login' ? 201 : 200;
    const responses: Record<string, object> = { [success]: { description: summary, content: { 'application/json': { schema: objeto(summary, respostas[method + ' ' + path]) } } } };
    const errors: Record<number,string> = {400:'Entrada inválida',401:'Credenciais inválidas ou ausentes',403:'Acesso negado',404:'Recurso inexistente',409:'Conflito de atualização',500:'Erro interno',503:'Serviço indisponível'};
    const codes = path === '/' ? [] : [401,500,503];
    if (fields || path.includes('{id}') || path === '/demandas') codes.push(400);
    if (path.includes('{id}') || fields === demanda) codes.push(403,404);
    if (method === 'patch') codes.push(409);
    for (const code of codes) responses[code] = { description: errors[code], content: { 'application/json': { schema: { type:'object', properties:{ erro:{type:'boolean',description:'Indica que a operação falhou.'}, mensagem:atributo.mensagem } } } } };
    let requestBody;
    if (fields) {
        const keys = fields.split(' ');
        const properties = Object.fromEntries(keys.map(name => [name, { description: campos[name][0], example: campos[name][1], type: name.endsWith('Id') ? 'integer' : 'string', ...(name === 'prazoFinalizacao' ? { format:'date' } : {}), ...(name === 'senha' ? {format:'password'} : {}) }]));
        requestBody = { required:true, content:{ 'application/json':{schema:{type:'object',properties,required:keys.filter(k => !['prazoFinalizacao','responsavelId'].includes(k))} } } };
    }
    (paths[path] ??= {})[method] = {summary, description: description + '\n\nExemplo de chamada: `' + method.toUpperCase() + ' ' + path.replace('{id}', '42') + (path === '/demandas' && method === 'get' ? '?busca=login&prioridade=Alta&ordenarPor=prazoFinalizacao&ordem=ASC' : '') + '`', parameters, responses, security:publico ? [] : [{ bearer:[] }], requestBody};
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

