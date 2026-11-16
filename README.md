# Sistema de Acompanhamento de Demandas de Desenvolvimento (PI-II-TIME-1)

Sistema web para gerenciamento e acompanhamento de demandas de software (tarefas, defeitos, melhorias e documentacao), desenvolvido para o componente curricular Projeto Integrador II do curso de Engenharia de Software da PUC-Campinas (2o Semestre / 2026).

---

## Informacoes Academicas

* **Curso:** Engenharia de Software
* **Componente Curricular:** Projeto Integrador II
* **Semestre/Ano:** 2o Semestre / 2026
* **Professora Orientadora:** Renata Arantes

---

## Equipe e Divisao de Responsabilidades

| Integrante | Responsabilidades | Status |
| :--- | :--- | :--- |
| **Abdallah Ali Borges El Khatib** | Estrutura Oracle/SQL, autenticacao (`POST /login`, `GET /usuarios`), `GET /projetos`, `POST /demandas`, `PUT /demandas/:id`, `GET /dashboard`, validacao de feriados nacionais, servico de historico e telas de Login, Painel, Cadastro/Edicao e Perfil | Implementado |
| **Vinicius Morais** | Rotas `GET /demandas` (filtros, busca e ordenacao), `GET /demandas/:id`, comentarios (`GET`/`POST`), ciclo de vida (`PATCH /demandas/:id/status`), cancelamento (`PATCH /demandas/:id/cancelar`), `GET /demandas/:id/historico` e integracao das telas de Listagem e Detalhes | Implementado |
| **Enrico Pacheco Del Manto** | Estrutura inicial da tela de detalhes (etapas anteriores) | - |
| **Lucas Ruman** | Listagem de demandas (atribuicao inicial) | - |

---

## Tecnologias Utilizadas

* **Backend:** Node.js (LTS), TypeScript, Express, CORS, dotenv, oracledb (Thin mode)
* **Banco de Dados:** Oracle Database
* **Frontend:** HTML5, CSS3, Bootstrap 5, JavaScript, Chart.js
* **API Externa:** BrasilAPI (validacao de feriados nacionais no prazo de finalizacao)

---

## Estrutura do Projeto

```text
PI-II-TIME-l/
├── sql/
│   ├── 01_create_tables.sql             # Script DDL das tabelas no Oracle
│   └── 02_seed_data.sql                 # Carga inicial (usuarios, projetos, demandas, comentarios, historico)
├── src/
│   ├── config/
│   │   └── database.ts                  # Pool de conexoes Oracle e helpers de query/transacao
│   ├── middlewares/
│   │   └── auth.ts                      # Autenticacao por token HMAC e controle por perfil
│   ├── routes/
│   │   ├── auth.routes.ts               # POST /login e GET /usuarios
│   │   ├── projetos.routes.ts           # GET /projetos (filtrado por vinculo do usuario)
│   │   ├── cadastroDemandas.routes.ts   # POST /demandas e PUT /demandas/:id
│   │   ├── listagemDemandas.routes.ts   # GET /demandas (filtros, busca e ordenacao)
│   │   ├── detalhesRoutes.ts            # GET /:id, comentarios, historico, status e cancelamento
│   │   └── dashboard.routes.ts          # GET /dashboard
│   ├── scripts/
│   │   └── initDb.ts                    # Criacao das tabelas e seed no Oracle via .env
│   ├── services/
│   │   ├── feriadoService.ts            # Validacao de formato de data e feriados nacionais
│   │   └── historicoService.ts          # Registro automatico na tabela historico_alteracoes
│   ├── types/
│   │   └── index.ts                     # Tipos e interfaces compartilhadas
│   └── server.ts                        # Servidor Express e registro das rotas
├── css/
│   └── style.css                        # Estilos compartilhados das telas
├── js/
│   ├── auth.js                          # Sessao, token e topbar compartilhada
│   ├── Login.js                         # Validacao e autenticacao na tela de login
│   ├── Dashboard.js                     # Graficos e indicadores do painel
│   ├── NovaDemanda.js                   # Cadastro e edicao de demandas
│   ├── ListaDemandas.js                 # Listagem de demandas
│   ├── DetalhesDemanda.js               # Detalhes da demanda
│   └── Configuracoes.js                 # Exibicao do perfil autenticado e projetos
├── Front_telalogin.html
├── Dashbord.html
├── Front_telademanda.html
├── tela_nova_demanda.html
├── Tela_detalhes_demanda.html
├── Configuracoes.html
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Como Criar o Banco, Configurar e Executar

### 1. Pre-requisitos
* Node.js (versao LTS) e npm
* Acesso a uma instancia do Oracle Database (local, Docker ou servidor da disciplina)

### 2. Criar as tabelas e carga inicial no Oracle
Voce pode executar automaticamente depois de configurar o `.env` (passo 4):
```bash
npm run db:init
```
Ou executar manualmente no SQL Developer / SQL*Plus na seguinte ordem:
1. `sql/01_create_tables.sql`
2. `sql/02_seed_data.sql`

### 3. Instalar dependencias
```bash
npm install
```

### 4. Configurar variaveis de ambiente
Copie o arquivo `.env.example` para `.env` na raiz do projeto e preencha os dados de acesso ao Oracle:
```env
PORT=3000
AUTH_SECRET=sua_chave_secreta

ORACLE_USER=seu_usuario
ORACLE_PASSWORD=sua_senha
ORACLE_CONNECTION_STRING=localhost:1521/FREEPDB1
```

### 5. Executar o backend
Em modo desenvolvimento:
```bash
npm run dev
```

Ou compilando para JavaScript antes de iniciar:
```bash
npm run build
npm start
```

A API ficara disponivel em `http://localhost:3000`.

### 6. Executar o frontend
Abra `Front_telalogin.html` no navegador (recomendado usar a extensao Live Server no VS Code) com a API rodando em `http://localhost:3000`.

---

## Usuarios Pre-cadastrados para Teste

| Perfil | E-mail | Senha |
| :--- | :--- | :--- |
| Administrador | `admin@puc.br` | `Admin123` |
| Lider de Projeto | `lider@puc.br` | `Lider123` |
| Membro da Equipe | `abdallah@puc.br` | `Dev123` |
| Membro da Equipe | `vinicius@puc.br` | `Dev123` |

---

## Endpoints Disponiveis (Integrados ao Oracle)

* `GET /`: verifica se o servidor esta online.
* `POST /login`: autentica e-mail e senha no Oracle e retorna `token` e dados do usuario (sem senha).
* `GET /usuarios`: lista os usuarios cadastrados sem expor senhas (requer token).
* `GET /projetos`: lista projetos do usuario autenticado via `usuario_projeto`, ou todos para Administrador (requer token).
* `GET /demandas`: lista demandas respeitando a visibilidade do perfil, com filtros combinaveis (`status`, `prioridade`, `tipo`, `responsavelId`, `projetoId`), busca textual (`busca`) e ordenacao (`ordenarPor`).
* `GET /demandas/:id`: retorna os dados completos de uma demanda respeitando o vinculo ao projeto.
* `POST /demandas`: cadastra nova demanda com status `Aberta` (permitido para Administrador e Lider vinculado ao projeto). Valida prazo contra feriados nacionais na BrasilAPI.
* `PUT /demandas/:id`: edita uma demanda aberta/em andamento/em revisao, atualiza `data_atualizacao`, valida feriado nacional e grava alteracoes de responsavel, prioridade e prazo em `historico_alteracoes`.
* `GET /demandas/:id/comentarios` e `POST /demandas/:id/comentarios`: lista e registra comentarios na demanda para usuarios vinculados ao projeto.
* `GET /demandas/:id/historico`: consulta o historico de alteracoes da demanda (sem exclusao de registros).
* `PATCH /demandas/:id/status`: executa as transicoes permitidas do ciclo de vida conforme o perfil do usuario e registra automaticamente em `historico_alteracoes`.
* `PATCH /demandas/:id/cancelar`: cancela a demanda (exceto se ja Concluida ou Cancelada), permitido para Administrador e Lider vinculado ao projeto, sem exclusao fisica no banco.
* `GET /dashboard`: retorna totais por status, prioridade e tipo, demandas criticas em aberto e demandas proximas do prazo (vencidas ou com vencimento nos proximos 7 dias).
