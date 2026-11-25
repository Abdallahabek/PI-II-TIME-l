// Autor: Lucas Ruman
// Especificacao OpenAPI 3.0.3, interface Swagger UI (/api-docs) e servidor standalone de documentacao

import express from 'express';

// Campos comuns do corpo de cadastro e edicao de demandas
const demanda = 'titulo descricao tipo prioridade projetoId responsavelId prazoFinalizacao';

// Inventario das 14 operacoes HTTP expostas pela API
const operacoes = [
    [
        'get',
        '/',
        'Consultar estado da API',
        'Consulta se o servidor HTTP está respondendo e informa o estado do pool Oracle (bancoConectado) e da configuração de autenticação (authConfigurado), sem expor segredos.'
    ],
    [
        'post',
        '/login',
        'Autenticar usuário',
        'email senha',
        'Valida e-mail e senha (hash scrypt com salt) com proteção contra força bruta por IP (HTTP 429) e devolve o token Bearer e o perfil do usuário. Use o token em Authorize para acessar as operações protegidas.'
    ],
    [
        'get',
        '/usuarios',
        'Listar usuários',
        'Lista usuários visíveis ao perfil autenticado (sem expor senhas). Aceita o parâmetro opcional projetoId para retornar apenas responsáveis elegíveis ao projeto informado.'
    ],
    [
        'get',
        '/projetos',
        'Listar projetos acessíveis',
        'Retorna os projetos visíveis para o usuário autenticado, conforme perfil e vínculos em usuario_projeto.'
    ],
    [
        'get',
        '/dashboard',
        'Consultar indicadores',
        'Agrupa demandas visíveis por status, prioridade e tipo e destaca demandas críticas em aberto e próximas do prazo (ordenadas por urgência com indicador booleano vencida).'
    ],
    [
        'get',
        '/demandas',
        'Buscar e ordenar demandas',
        'Combina filtros múltiplos, busca textual insensível a acentos por padrão (título/descrição ou campos escolhidos), período de datas e ordenação por um ou mais critérios.'
    ],
    [
        'post',
        '/demandas',
        'Cadastrar demanda',
        demanda,
        'Cadastra uma demanda com status inicial Aberta (Administrador ou Líder vinculado ao projeto). Valida vínculo do responsável ao projeto, prazo não anterior a hoje e feriados nacionais via BrasilAPI.'
    ],
    [
        'put',
        '/demandas/{id}',
        'Editar demanda',
        demanda,
        'Atualiza demanda ativa (Aberta, Em andamento ou Em revisão), registra alterações relevantes no histórico e protege contra edição concorrente de demanda encerrada (HTTP 409).'
    ],
    [
        'get',
        '/demandas/{id}',
        'Consultar demanda',
        'Retorna os dados completos de uma demanda depois de verificar o acesso do usuário ao projeto.'
    ],
    [
        'get',
        '/demandas/{id}/comentarios',
        'Listar comentários',
        'Consulta os comentários associados à demanda em ordem cronológica e informa o total encontrado.'
    ],
    [
        'post',
        '/demandas/{id}/comentarios',
        'Adicionar comentário',
        'texto',
        'Registra o texto enviado como comentário do usuário autenticado na demanda indicada. Bloqueia novos comentários em demandas Concluídas ou Canceladas (HTTP 400).'
    ],
    [
        'get',
        '/demandas/{id}/historico',
        'Consultar histórico',
        'Consulta o histórico imutável de alterações registradas para essa demanda.'
    ],
    [
        'patch',
        '/demandas/{id}/status',
        'Alterar status',
        'status',
        'Move a demanda para o status informado respeitando as transições válidas do ciclo de vida e as permissões do perfil, com detecção de conflito concorrente (HTTP 409).'
    ],
    [
        'patch',
        '/demandas/{id}/cancelar',
        'Cancelar demanda',
        'Marca a demanda como Cancelada sem exclusão física. Exige perfil de Administrador ou Líder vinculado ao projeto e rejeita demandas Concluídas ou já Canceladas.'
    ]
];

// Metadados (descricao e exemplo) para campos de entrada e parametros de consulta
const campos: Record<string, [string, string | number]> = {
    email: ['E-mail de acesso do usuário.', 'pessoa@example.org'],
    senha: ['Senha da conta usada no login.', 'senha-de-exemplo'],
    titulo: ['Nome curto que identifica a demanda (máximo 200 caracteres).', 'Corrigir tela de login'],
    descricao: [
        'Detalhes do problema ou trabalho solicitado (máximo 2000 caracteres).',
        'Exibir mensagem quando o e-mail estiver vazio.'
    ],
    tipo: ['Categoria da demanda: Tarefa, Defeito, Melhoria ou Documentação.', 'Defeito'],
    prioridade: ['Grau de urgência: Crítica, Alta, Média ou Baixa.', 'Alta'],
    projetoId: ['Identificador numérico do projeto vinculado à demanda.', 1],
    responsavelId: ['Identificador numérico do usuário responsável vinculado ao projeto (ou Administrador).', 3],
    prazoFinalizacao: [
        'Data limite no formato AAAA-MM-DD. Datas no passado (em prazos novos/alterados) e feriados nacionais são rejeitados.',
        '2027-03-10'
    ],
    texto: ['Conteúdo do novo comentário (máximo 1000 caracteres).', 'Correção pronta para revisão.'],
    status: ['Estado da demanda: Aberta, Em andamento, Em revisão, Concluída ou Cancelada.', 'Em andamento'],
    busca: ['Trecho do título, descrição ou campos escolhidos (insensível a caixa e acentos por padrão).', 'login'],
    ordenarPor: ['Critério de ordenação: prioridade, dataCriacao, prazoFinalizacao ou status.', 'prazoFinalizacao'],
    ordem: ['Direção do critério escolhido: ASC (crescente) ou DESC (decrescente).', 'ASC']
};

// Helpers para compor esquemas OpenAPI de objetos e listas
function objeto(description: string, properties: Record<string, object>) {
    return { type: 'object', description, properties };
}

function lista(description: string, items: object) {
    return { type: 'array', description, items };
}

// Catalogo reutilizavel de atributos retornados nas respostas JSON
const atributo = {
    id: { type: 'integer', description: 'Identificador do registro.' },
    nome: { type: 'string', description: 'Nome de exibição.' },
    email: { type: 'string', description: 'E-mail do usuário.' },
    perfil: { type: 'string', description: 'Perfil que define as permissões.' },
    descricao: { type: 'string', description: 'Descrição do registro.' },
    dataCriacao: { type: 'string', description: 'Data/hora de criação em UTC (ISO-8601).' },
    titulo: { type: 'string', description: 'Título da demanda.' },
    tipo: { type: 'string', description: 'Categoria da demanda.' },
    prioridade: { type: 'string', description: 'Grau de urgência.' },
    status: { type: 'string', description: 'Estado atual.' },
    projetoId: { type: 'integer', description: 'Identificador do projeto.' },
    projetoNome: { type: 'string', description: 'Nome do projeto.' },
    responsavelId: { type: 'integer', description: 'Identificador do responsável.', nullable: true },
    responsavelNome: { type: 'string', description: 'Nome do responsável.', nullable: true },
    dataAtualizacao: { type: 'string', description: 'Data/hora da última atualização em UTC (ISO-8601).' },
    prazoFinalizacao: { type: 'string', description: 'Data limite da demanda (YYYY-MM-DD).', nullable: true },
    vencida: { type: 'boolean', description: 'Indica se o prazo de finalização já está vencido no Oracle.' },
    bancoConectado: { type: 'boolean', description: 'Indica se o pool de conexões Oracle está ativo.' },
    authConfigurado: { type: 'boolean', description: 'Indica se a variável AUTH_SECRET está configurada.' },
    demandaId: { type: 'integer', description: 'Demanda associada ao registro.' },
    usuarioId: { type: 'integer', description: 'Identificador do autor.' },
    usuarioNome: { type: 'string', description: 'Nome do autor.' },
    texto: { type: 'string', description: 'Conteúdo do comentário.' },
    campoAlterado: { type: 'string', description: 'Campo modificado.' },
    valorAnterior: { type: 'string', description: 'Valor antes da alteração.', nullable: true },
    valorNovo: { type: 'string', description: 'Valor após a alteração.' },
    dataAlteracao: { type: 'string', description: 'Data/hora da alteração em UTC (ISO-8601).' },
    mensagem: { type: 'string', description: 'Mensagem sobre o resultado da operação.' },
    total: { type: 'integer', description: 'Quantidade de registros retornados.' },
    token: { type: 'string', description: 'Token Bearer HMAC-SHA256 usado nas rotas protegidas.' },
    projeto: { type: 'string', description: 'Nome da aplicação.' },
    totalDemandas: { type: 'integer', description: 'Quantidade de demandas visíveis.' },
    emAberto: { type: 'string', description: 'Critério adotado para demandas consideradas em aberto.' },
    proximasDoPrazo: { type: 'string', description: 'Critério de inclusão na lista de demandas próximas do prazo.' }
};

const usuario = objeto('Dados públicos do usuário (sem senha).', {
    id: atributo.id,
    nome: atributo.nome,
    email: atributo.email,
    perfil: atributo.perfil
});

const projetoObj = objeto('Dados do projeto.', {
    id: atributo.id,
    nome: atributo.nome,
    descricao: atributo.descricao,
    dataCriacao: atributo.dataCriacao
});

const camposDemanda = {
    id: atributo.id,
    titulo: atributo.titulo,
    descricao: atributo.descricao,
    tipo: atributo.tipo,
    prioridade: atributo.prioridade,
    status: atributo.status,
    projetoId: atributo.projetoId,
    projetoNome: atributo.projetoNome,
    responsavelId: atributo.responsavelId,
    responsavelNome: atributo.responsavelNome,
    dataCriacao: atributo.dataCriacao,
    dataAtualizacao: atributo.dataAtualizacao,
    prazoFinalizacao: atributo.prazoFinalizacao
};

const demandaObj = objeto('Dados da demanda.', camposDemanda);

const demandaProximaPrazoObj = objeto('Demanda ativa próxima do prazo ou já vencida.', {
    ...camposDemanda,
    vencida: atributo.vencida
});

const comentario = objeto('Comentário registrado.', {
    id: atributo.id,
    demandaId: atributo.demandaId,
    usuarioId: atributo.usuarioId,
    usuarioNome: atributo.usuarioNome,
    texto: atributo.texto,
    dataCriacao: atributo.dataCriacao
});

const evento = objeto('Alteração registrada no histórico.', {
    id: atributo.id,
    demandaId: atributo.demandaId,
    usuarioId: atributo.usuarioId,
    usuarioNome: atributo.usuarioNome,
    campoAlterado: atributo.campoAlterado,
    valorAnterior: atributo.valorAnterior,
    valorNovo: atributo.valorNovo,
    descricao: atributo.descricao,
    dataAlteracao: atributo.dataAlteracao
});

const contagem = (description: string) => ({
    type: 'object',
    description,
    additionalProperties: { type: 'integer', description: 'Quantidade de demandas nesta categoria.' }
});

// Esquemas de resposta de sucesso para cada operacao documentada
const respostas: Record<string, Record<string, object>> = {
    'get /': {
        projeto: atributo.projeto,
        status: atributo.status,
        bancoConectado: atributo.bancoConectado,
        authConfigurado: atributo.authConfigurado
    },
    'post /login': { mensagem: atributo.mensagem, token: atributo.token, usuario },
    'get /usuarios': { total: atributo.total, usuarios: lista('Usuários visíveis ao perfil.', usuario) },
    'get /projetos': { total: atributo.total, projetos: lista('Projetos visíveis.', projetoObj) },
    'get /demandas': { total: atributo.total, demandas: lista('Demandas que atendem aos filtros.', demandaObj) },
    'get /demandas/{id}': { demanda: demandaObj },
    'get /demandas/{id}/comentarios': { total: atributo.total, comentarios: lista('Comentários da demanda.', comentario) },
    'post /demandas/{id}/comentarios': { mensagem: atributo.mensagem, comentario },
    'get /demandas/{id}/historico': { total: atributo.total, historico: lista('Alterações da demanda.', evento) },
    'get /dashboard': {
        totalDemandas: atributo.totalDemandas,
        porStatus: contagem('Quantidade por estado.'),
        porTipo: contagem('Quantidade por tipo.'),
        porPrioridade: contagem('Quantidade por prioridade.'),
        demandasCriticasEmAberto: lista('Demandas críticas ainda ativas.', demandaObj),
        demandasProximasPrazo: lista(
            'Demandas ativas próximas do prazo ou vencidas, ordenadas por urgência.',
            demandaProximaPrazoObj
        ),
        criterios: objeto('Regras de negócio usadas no painel.', {
            emAberto: atributo.emAberto,
            proximasDoPrazo: atributo.proximasDoPrazo
        })
    }
};

for (const chave of ['post /demandas', 'put /demandas/{id}', 'patch /demandas/{id}/status', 'patch /demandas/{id}/cancelar']) {
    respostas[chave] = { mensagem: atributo.mensagem, demanda: demandaObj };
}

// Parametros de consulta suportados em GET /demandas (filtros, busca avancada e multi-ordenacao)
const parametrosLista: Record<string, [string, string | number]> = {
    ...Object.fromEntries(
        ['status', 'tipo', 'prioridade', 'projetoId'].map(nome => [
            nome,
            [campos[nome][0] + ' Aceita vários valores separados por vírgula.', campos[nome][1]]
        ])
    ),
    responsavelId: [
        'Identificador numérico do responsável (aceita vários valores separados por vírgula) ou o valor especial sem_responsavel para listar demandas sem responsável.',
        'sem_responsavel'
    ],
    busca: campos.busca as [string, string],
    campoData: [
        'Campo do período. Aceita TimeStamp (criação), LastUpdate (atualização) ou Deadline (prazo).',
        'LastUpdate'
    ],
    de: ['Primeiro dia do período (YYYY-MM-DD), inclusive.', '2026-11-01'],
    ate: ['Último dia do período (YYYY-MM-DD), inclusive.', '2026-11-30'],
    situacaoPrazo: [
        'Aceita atrasada, hoje, futura (demandas em aberto) e semPrazo. Separe opções por vírgula.',
        'atrasada,hoje'
    ],
    atribuicao: [
        'Use minhas, comResponsavel ou semResponsavel. Para filtrar por ID específico ou sem_responsavel, também é possível usar responsavelId.',
        'minhas'
    ],
    buscarEm: [
        'Campos pesquisados, separados por vírgula. Opções: titulo, descricao, responsavel, projeto. O padrão pesquisa título e descrição.',
        'titulo,descricao'
    ],
    comparacao: ['Comparação por campo e termo. Aceita contem (padrão), exata, prefixo ou sufixo.', 'contem'],
    acentos: [
        'force-ignore (padrão) ignora acentos, til e cedilha (ação/acao e café/cafe). ignore mantém til/cedilha. preservar mantém acentos.',
        'force-ignore'
    ],
    palavras: [
        'frase (padrão) mantém a expressão inteira. todas exige cada termo. qualquer aceita pelo menos um.',
        'todas'
    ],
    ordenarPor: [
        'Critérios em sequência: prioridade, dataCriacao (TimeStamp), prazoFinalizacao (Deadline), status, LastUpdate, dataAtualizacao, titulo, tipo, id, projeto e responsavel.',
        'prioridade,LastUpdate'
    ],
    ordem: ['Direções ASC ou DESC na mesma sequência dos critérios.', 'ASC,DESC']
};

// Montagem programatica dos paths OpenAPI 3.0.3 com parametros, payloads e codigos HTTP de erro
const paths: Record<string, Record<string, unknown>> = {};
for (const [method, path, summary, ...detalhes] of operacoes) {
    const description = detalhes[detalhes.length - 1];
    const fields = detalhes.length === 2 ? detalhes[0] : undefined;
    const publico = path === '/' || path === '/login';
    const parameters: object[] = [];

    if (path.includes('{id}')) {
        parameters.push({
            name: 'id',
            description: 'Identificador numérico da demanda a consultar ou alterar.',
            example: 42,
            in: 'path',
            required: true,
            schema: { type: 'integer', minimum: 1 }
        });
    }

    if (method === 'get' && path === '/usuarios') {
        parameters.push({
            name: 'projetoId',
            description:
                'Identificador numérico opcional do projeto para filtrar apenas responsáveis elegíveis (vinculados ao projeto + Administradores).',
            example: 1,
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1 }
        });
    }

    if (method === 'get' && path === '/demandas') {
        for (const [name, [paramDesc, example]] of Object.entries(parametrosLista)) {
            parameters.push({
                name,
                description: paramDesc,
                example: String(example),
                in: 'query',
                schema: { type: 'string' }
            });
        }
    }

    const success = method === 'post' && path !== '/login' ? 201 : 200;
    const responses: Record<string, object> = {
        [success]: {
            description: summary,
            content: {
                'application/json': {
                    schema: objeto(summary, respostas[method + ' ' + path])
                }
            }
        }
    };

    const errors: Record<number, string> = {
        400: 'Entrada inválida ou regra de negócio violada',
        401: 'Credenciais inválidas ou ausentes',
        403: 'Acesso negado para o perfil ou projeto',
        404: 'Recurso inexistente',
        409: 'Conflito de atualização concorrente',
        429: 'Muitas tentativas de login (rate limit)',
        500: 'Erro interno',
        503: 'Serviço indisponível (Oracle, autenticação ou BrasilAPI)'
    };

    const codes = new Set<number>(path === '/' ? [] : [401, 500, 503]);
    if (fields || path.includes('{id}') || path === '/demandas' || path === '/usuarios') {
        codes.add(400);
    }
    if (path.includes('{id}') || fields === demanda || path === '/usuarios') {
        codes.add(403);
    }
    if (path.includes('{id}') || fields === demanda) {
        codes.add(404);
    }
    if (method === 'patch' || method === 'put') {
        codes.add(409);
    }
    if (method === 'post' && path === '/login') {
        codes.add(429);
    }

    for (const code of codes) {
        responses[code] = {
            description: errors[code],
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            erro: { type: 'boolean', description: 'Indica que a operação falhou.' },
                            mensagem: atributo.mensagem
                        }
                    }
                }
            }
        };
    }

    let requestBody;
    if (fields) {
        const keys = fields.split(' ');
        const properties = Object.fromEntries(
            keys.map(name => [
                name,
                {
                    description: campos[name][0],
                    example: campos[name][1],
                    type: name.endsWith('Id') ? 'integer' : 'string',
                    ...(name === 'prazoFinalizacao' ? { format: 'date' } : {}),
                    ...(name === 'senha' ? { format: 'password' } : {})
                }
            ])
        );
        requestBody = {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties,
                        required: keys.filter(k => !['prazoFinalizacao', 'responsavelId'].includes(k))
                    }
                }
            }
        };
    }

    (paths[path] ??= {})[method] = {
        summary,
        description:
            description +
            '\n\nExemplo de chamada: `' +
            method.toUpperCase() +
            ' ' +
            path.replace('{id}', '42') +
            (path === '/demandas' && method === 'get'
                ? '?busca=login&prioridade=Alta&ordenarPor=prazoFinalizacao&ordem=ASC'
                : '') +
            '`',
        parameters,
        responses,
        security: publico ? [] : [{ bearer: [] }],
        requestBody
    };
}

export const documento = {
    openapi: '3.0.3',
    info: { title: 'API de Demandas', version: '1.0.0' },
    paths,
    components: {
        securitySchemes: {
            bearer: { type: 'http', scheme: 'bearer' }
        }
    }
};

// Registra os endpoints /openapi.json e /api-docs (Swagger UI via CDN) no servidor Express
export function registrarSwagger(app: express.Express, somenteDocs = false) {
    app.get('/openapi.json', (_req, res) => res.json(documento));
    app.get('/api-docs', (_req, res) =>
        res
            .type('html')
            .send(
                `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>API de Demandas</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui',supportedSubmitMethods:${somenteDocs ? '[]' : JSON.stringify(['get', 'post', 'put', 'patch'])}})</script></body></html>`
            )
    );
}

// Modo standalone (npm run swagger): exibe a documentacao sem precisar do Oracle ou .env
if (require.main === module) {
    const app = express();
    registrarSwagger(app, true);
    app.get('/', (_req, res) => res.redirect('/api-docs'));
    const port = Number(process.env.PORT || 3000);
    app.listen(port, () => console.log('Swagger em http://localhost:' + port + '/api-docs'));
}
