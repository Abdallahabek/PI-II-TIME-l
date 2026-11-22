# Branch Lucas-Ruman — Swagger e testes da API

A API de acompanhamento de demandas já possuía 14 operações HTTP. As alterações desta branch acrescentam documentação interativa para essas operações, testes HTTP e quatro modos de execução. No momento da documentação, as mudanças estavam na cópia de trabalho local, ainda sem commit próprio em relação à referência local origin/main.

## Como executar

Na raiz do projeto, com Node.js e npm instalados, execute `npm ci` para instalar as dependências do arquivo de lock. Em seguida, escolha um modo.

| Objetivo | Comando | Resultado esperado |
|---|---|---|
| Consultar apenas a documentação | `npm run swagger` | Inicia um servidor de documentação independente do Oracle. A raiz redireciona para o Swagger. |
| Executar apenas os testes | `npm test` | Abre o Express em uma porta local temporária, executa a suíte e encerra o servidor. |
| Iniciar API e Swagger | `npm start` ou `npm run start:sem-testes` | Inicia o servidor da aplicação e tenta conectar ao Oracle. |
| Testar e depois iniciar API e Swagger | `npm run start:com-testes` | Executa a suíte e inicia o servidor somente se ela passar. |

A interface fica em [localhost:3000/api-docs](http://localhost:3000/api-docs) e a especificação em [localhost:3000/openapi.json](http://localhost:3000/openapi.json). A variável de ambiente `PORT` altera a porta dos servidores. Use Ctrl+C para encerrar o modo ativo. Para configurar o Oracle para uso real, consulte o [README do projeto](README.md).

## Como usar o Swagger

O documento OpenAPI 3.0.3 descreve métodos, caminhos, parâmetros, campos de entrada, autenticação Bearer e códigos de resposta. Os esquemas das respostas de sucesso são genéricos. No modo independente, a interface permite consultar a documentação. Com a API iniciada, é possível executar uma operação pela interface: faça login em `POST /login`, copie o token retornado e informe-o em **Authorize** antes de chamar as rotas protegidas. A interface baixa os recursos visuais do Swagger UI por CDN e requer internet para renderizar.

## Operações documentadas e casos de teste

A suíte verifica o inventário de 14 operações contra o documento OpenAPI, o HTML do Swagger e a exigência de autenticação nas 12 operações protegidas. Os cenários específicos implementados estão abaixo.

| Operação | Cenários específicos |
|---|---|
| GET / | Estado Online |
| POST /login | Campos ausentes, senha incorreta e retorno de token válido |
| GET /usuarios | Lista vazia |
| GET /projetos | Lista vazia |
| GET /dashboard | Total de demandas igual a zero |
| GET /demandas | Lista vazia e filtro de prioridade inválido |
| POST /demandas | Campos obrigatórios ausentes e prazo em feriado |
| GET /demandas/{id} | ID inválido e demanda inexistente |
| PUT /demandas/{id} | ID inválido |
| GET /demandas/{id}/comentarios | ID inválido |
| POST /demandas/{id}/comentarios | ID inválido |
| GET /demandas/{id}/historico | ID inválido |
| PATCH /demandas/{id}/status | ID inválido |
| PATCH /demandas/{id}/cancelar | ID inválido |

## Arquivos e funcionamento

| Arquivo | Alteração |
|---|---|
| src/openapi.ts | Define a especificação, registra as rotas da documentação e inicia o modo Swagger independente. |
| src/server.ts | Registra o Swagger na API. A inicialização do pool e a abertura da porta principal acontecem quando o arquivo é executado diretamente, permitindo importar a aplicação nos testes. |
| tests/api.test.ts | Usa o executor de testes do Node.js e requisições HTTP ao Express. Simula consultas ao banco e a verificação de feriados nos cenários que precisam dessas respostas. |
| package.json | Adiciona os scripts de Swagger, testes e inicialização combinada, reutilizando as dependências existentes. |

## Estado da validação

A instalação das dependências não foi concluída no ambiente de desenvolvimento. As tentativas de build e teste pararam antes da compilação e da execução dos casos por falta de TypeScript e ts-node. Para reproduzir a validação após a instalação, execute `npm run build` e `npm test`. A suíte atual não valida SQL em Oracle real, persistência de alterações nem os fluxos completos de sucesso para edição, comentários, histórico e transições de status.
