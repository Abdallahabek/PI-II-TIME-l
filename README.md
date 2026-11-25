# Sistema de Acompanhamento de Demandas de Desenvolvimento (PI-II-TIME-1)

Sistema web para gerenciamento e acompanhamento de demandas de software (tarefas, defeitos, melhorias e documentação), desenvolvido para o componente curricular Projeto Integrador II do curso de Engenharia de Software da PUC-Campinas (2º Semestre / 2026).

---

## Informações Acadêmicas

* **Curso:** Engenharia de Software
* **Componente Curricular:** Projeto Integrador II
* **Semestre/Ano:** 2º Semestre / 2026
* **Professora Orientadora:** Renata Arantes

---

## Equipe e Divisão de Responsabilidades

| Integrante | Responsabilidades | Status |
| :--- | :--- | :--- |
| **Abdallah Ali Borges El Khatib** | Estrutura Oracle/SQL, segurança de autenticação (`scrypt` + HMAC em `POST /login` e `GET /usuarios`), `GET /projetos`, `POST /demandas`, `PUT /demandas/:id`, `GET /dashboard`, validação de feriados nacionais, serviço de histórico e telas de Login, Painel, Cadastro/Edição e Perfil | Implementado |
| **Vinícius Morais** | Rotas `GET /demandas` (filtros, busca sem acento e ordenação), `GET /demandas/:id`, comentários (`GET`/`POST`), ciclo de vida (`PATCH /demandas/:id/status`), cancelamento (`PATCH /demandas/:id/cancelar`), `GET /demandas/:id/historico` e integração das telas de Listagem e Detalhes | Implementado |
| **Enrico Pacheco Del Manto** | Estrutura inicial da tela de detalhes (etapas anteriores) | - |
| **Lucas Ruman** | Listagem de demandas (atribuição inicial) | - |

---

## Tecnologias Utilizadas

* **Backend:** Node.js (LTS), TypeScript, Express, CORS, dotenv, oracledb (Thin mode)
* **Banco de Dados:** Oracle Database (`VARCHAR2(... CHAR)`, timestamps padronizados em UTC via `SYS_EXTRACT_UTC(SYSTIMESTAMP)`)
* **Segurança:** Hash de senhas com `crypto.scryptSync` + salt aleatório por usuário (`scrypt$<salt>$<hash>`) e comparação em tempo constante (`crypto.timingSafeEqual`), tokens assinados com HMAC-SHA256 usando `AUTH_SECRET` obrigatória e rate limiting por IP em `POST /login`
* **Frontend:** HTML5, CSS3, Bootstrap 5, JavaScript, Chart.js
* **API Externa:** BrasilAPI (validação de feriados nacionais no prazo de finalização)

---

## Estrutura do Projeto

```text
PI-II-TIME-1/
├── sql/
│   ├── 01_create_tables.sql             # Script DDL das tabelas e indices no Oracle
│   └── 02_seed_data.sql                 # Carga inicial (usuarios com hash scrypt, projetos, demandas, comentarios, historico)
├── src/
│   ├── config/
│   │   └── database.ts                  # Pool de conexoes Oracle, deteccao de falhas de conexao e helpers de query/transacao
│   ├── middlewares/
│   │   └── auth.ts                      # Hash scrypt, autenticacao por token HMAC e controle por perfil
│   ├── routes/
│   │   ├── auth.routes.ts               # POST /login (com rate limit) e GET /usuarios (com filtro ?projetoId=)
│   │   ├── projetos.routes.ts           # GET /projetos (filtrado por vinculo do usuario)
│   │   ├── cadastroDemandas.routes.ts   # POST /demandas e PUT /demandas/:id
│   │   ├── listagemDemandas.routes.ts   # GET /demandas (filtros, busca e ordenacao)
│   │   ├── detalhesRoutes.ts            # GET /:id, comentarios, historico, status e cancelamento
│   │   └── dashboard.routes.ts          # GET /dashboard
│   ├── scripts/
│   │   └── initDb.ts                    # Criacao idempotente das tabelas/indices e seed no Oracle via .env
│   ├── services/
│   │   ├── feriadoService.ts            # Validacao de formato de data, faixa de anos e feriados nacionais
│   │   └── historicoService.ts          # Registro automatico e imutavel em historico_alteracoes (UTC)
│   ├── types/
│   │   └── index.ts                     # Tipos e interfaces compartilhadas
│   └── server.ts                        # Servidor Express, CORS, tratamento de erros e shutdown gracioso
├── css/
│   └── style.css                        # Estilos compartilhados das telas
├── js/
│   ├── auth.js                          # Sessao, validacao de token, formatacao de datas e topbar compartilhada
│   ├── Login.js                         # Validacao e autenticacao na tela de login
│   ├── Dashboard.js                     # Graficos, indicadores e tabelas de alerta do painel
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

## Como Configurar, Criar o Banco e Executar

### 1. Pré-requisitos
* Node.js (versão LTS >= 18) e npm
* Acesso a uma instância do Oracle Database (local, Docker ou servidor da disciplina)

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
Copie o arquivo `.env.example` para `.env` na raiz do projeto e preencha os dados obrigatórios:
```env
PORT=3000
AUTH_SECRET=defina-uma-chave-secreta-forte-com-pelo-menos-32-caracteres
CORS_ORIGIN=

ORACLE_USER=seu_usuario
ORACLE_PASSWORD=sua_senha
ORACLE_CONNECTION_STRING=localhost:1521/FREEPDB1
```
> **Importante:** `AUTH_SECRET` é obrigatória (não há segredo padrão hardcoded). Se não estiver definida no `.env`, as rotas autenticadas retornam HTTP `503`. `CORS_ORIGIN` é opcional (aceita múltiplas origens separadas por vírgula; vazio permite origens locais de desenvolvimento como Live Server).

### 4. Criar as tabelas e carga inicial no Oracle
Com as dependências instaladas e o `.env` configurado, execute:
```bash
npm run db:init
```
Ou execute manualmente no SQL Developer / SQL*Plus (com encoding UTF-8 / `NLS_LANG=.AL32UTF8`) na seguinte ordem:
1. `sql/01_create_tables.sql`
2. `sql/02_seed_data.sql`

### 5. Executar o backend
Em modo desenvolvimento:
```bash
npm run dev
```

Ou compilando para JavaScript (`dist/server.js`) antes de iniciar:
```bash
npm run build
npm start
```

A API ficará disponível em `http://localhost:3000`.

### 6. Executar o frontend
Abra `Front_telalogin.html` no navegador (recomendado usar a extensão Live Server no VS Code) com a API rodando em `http://localhost:3000`.

---

## Usuários Pré-cadastrados para Teste

Todas as 6 contas criadas pelo script `sql/02_seed_data.sql` armazenam suas senhas no Oracle **exclusivamente como hash `scrypt` com salt aleatório individual** (`scrypt$<saltHex32>$<hashHex128>`), nunca em texto puro, sendo validadas no login com `crypto.timingSafeEqual`.

| Perfil | Nome | E-mail | Senha (para login) | Projetos Vinculados |
| :--- | :--- | :--- | :--- | :--- |
| Administrador | Carlos Santos | `admin@puc.br` | `Admin123` | Todos (acesso global) |
| Líder de Projeto | Mariana Silva | `lider@puc.br` | `Lider123` | Projetos 1 e 2 |
| Membro da Equipe | Abdallah Khatib | `abdallah@puc.br` | `Dev123` | Projetos 1 e 2 |
| Membro da Equipe | Vinícius Morais | `vinicius@puc.br` | `Dev123` | Projetos 1 e 3 |
| Membro da Equipe | Enrico Pacheco | `enrico@puc.br` | `Dev123` | Projeto 1 |
| Membro da Equipe | Lucas Ruman | `lucas@puc.br` | `Dev123` | Projetos 2 e 3 |

---

## Critérios de Negócio do Dashboard (`GET /dashboard`)

Para transparência operacional e avaliação na banca, os indicadores do painel seguem os seguintes critérios explícitos (também retornados no campo `criterios` da API e exibidos na interface):

* **Visibilidade por perfil:** `Administrador` visualiza indicadores consolidados de todos os projetos; `Líder de Projeto` e `Membro da Equipe` visualizam apenas demandas dos projetos vinculados em `usuario_projeto`.
* **Critério de "Demandas em aberto":** considera todas as demandas ativas no fluxo de trabalho, isto é, com status **`Aberta`**, **`Em andamento`** ou **`Em revisão`** (excluindo demandas **`Concluída`** e **`Cancelada`**). Esse critério é utilizado tanto nas **Demandas Críticas em Aberto** quanto nas **Demandas Próximas do Prazo**.
* **Critério de "Demandas próximas do prazo":** considera demandas **em aberto** que possuem `prazo_finalizacao` preenchido e cuja data já esteja **vencida** (`prazo_finalizacao < TRUNC(SYSDATE)`) ou vença nos **próximos 7 dias** (`prazo_finalizacao <= TRUNC(SYSDATE) + 7`), calculado diretamente no Oracle para evitar divergência de fuso horário. Os itens retornam ordenados do prazo mais urgente/vencido para o mais distante (`prazo_finalizacao ASC, id ASC`), acompanhados da flag booleana `vencida`.

---

## Endpoints Disponíveis (Integrados ao Oracle)

* `GET /`: verifica disponibilidade da API (`status`, `bancoConectado` e `authConfigurado`, sem expor segredos).
* `POST /login`: autentica e-mail e senha no Oracle via hash `scrypt` (com rate limiting por IP) e retorna `token` e dados do usuário (sem senha).
* `GET /usuarios`: lista usuários visíveis ao perfil sem expor senhas; aceita `?projetoId=<id>` opcional para retornar apenas responsáveis elegíveis ao projeto informado (requer token).
* `GET /projetos`: lista projetos do usuário autenticado via `usuario_projeto`, ou todos para Administrador (requer token).
* `GET /demandas`: lista demandas respeitando a visibilidade do perfil, com filtros combináveis (`status`, `prioridade`, `tipo`, `responsavelId` incluindo `sem_responsavel`, `projetoId`), busca textual insensível a acentos (`busca`) e ordenação (`ordenarPor`, `ordem`).
* `GET /demandas/:id`: retorna os dados completos de uma demanda respeitando o vínculo ao projeto.
* `POST /demandas`: cadastra nova demanda com status `Aberta` (permitido para Administrador e Líder vinculado ao projeto), validando vínculo do responsável ao projeto e prazo contra datas passadas e feriados nacionais na BrasilAPI.
* `PUT /demandas/:id`: edita demanda ativa (`Aberta`, `Em andamento` ou `Em revisão`), atualiza `data_atualizacao` em UTC, valida feriado nacional quando o prazo é alterado e grava alterações de projeto, responsável, prioridade e prazo em `historico_alteracoes`.
* `GET /demandas/:id/comentarios` e `POST /demandas/:id/comentarios`: lista e registra comentários na demanda (bloqueando novos comentários em demandas `Concluída` ou `Cancelada`).
* `GET /demandas/:id/historico`: consulta o histórico imutável de alterações da demanda.
* `PATCH /demandas/:id/status`: executa as transições permitidas do ciclo de vida conforme o perfil do usuário e registra automaticamente em `historico_alteracoes`.
* `PATCH /demandas/:id/cancelar`: cancela a demanda (exceto se já `Concluída` ou `Cancelada`), permitido para Administrador e Líder vinculado ao projeto, sem exclusão física no banco.
* `GET /dashboard`: retorna totais por status, prioridade e tipo, demandas críticas em aberto e demandas próximas do prazo (ordenadas por urgência e com flag `vencida`).
