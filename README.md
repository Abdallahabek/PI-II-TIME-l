# Sistema de Acompanhamento de Demandas de Desenvolvimento (PI-II-TIME-1)

Sistema elaborado para o componente curricular Projeto Integrador II do curso de Engenharia de Software da PUC-Campinas (2026).

---

## Integrantes da Equipe e Responsabilidades (Reuniao 4)

Divisao de responsabilidades da equipe:

| Integrante | Tela (Reunioes 2 e 3) | Rotas sob Responsabilidade | Status |
| :--- | :--- | :--- | :--- |
| **Abdallah Ali Borges El Khatib** | Cadastro/Edicao de Demanda | POST /demandas e GET /projetos | Implementado |
| **Modulo Extra (Abdallah / Equipe)** | Dashboard | GET /dashboard | Implementado |
| **Enrico Pacheco Del Manto** | Login | POST /login e GET /usuarios | Em desenvolvimento na branch do integrante |
| **Lucas Ruman** | Listagem de Demandas | GET /demandas (com filtros, busca e ordenacao) | Em desenvolvimento na branch do integrante |
| **Vinicius Morais** | Detalhes da Demanda | GET /demandas/:id e comentarios | Em desenvolvimento na branch do integrante |

### Informacoes Academicas
* Curso: Engenharia de Software
* Componente Curricular: Projeto Integrador II
* Semestre/Ano: 2º Semestre / 2026
* Professora Orientadora: Renata Arantes

---

## Tecnologias Utilizadas

* Node.js (versao LTS)
* TypeScript
* Express
* CORS
* ts-node-dev

---

## Estrutura do Backend

```text
PI-II-TIME-l/
├── src/
│   ├── data/
│   │   └── mockData.ts               # Dados de teste compartilhados em memoria
│   ├── routes/
│   │   ├── cadastroDemandas.routes.ts# [Abdallah] POST /demandas com validacoes
│   │   ├── projetos.routes.ts        # [Abdallah] GET /projetos
│   │   └── dashboard.routes.ts       # [Modulo Extra - Abdallah] GET /dashboard
│   ├── types/
│   │   └── index.ts                  # Interfaces TypeScript
│   └── server.ts                     # Servidor Express e registro de rotas
├── dist/                             # Codigo compilado
├── package.json
├── tsconfig.json
└── README.md
```

---

## Como Instalar e Executar

1. Instalar as dependencias:
```bash
npm install
```

2. Executar em modo desenvolvimento:
```bash
npm run dev
```
O servidor vai rodar na porta 3000: `http://localhost:3000`

3. Compilar e executar:
```bash
npm run build
npm start
```

---

## Criterios do Dashboard (GET /dashboard)

1. Criterio para Demandas em Aberto:
   * Demandas ativas no fluxo: 'Aberta', 'Em andamento' ou 'Em revisao'.
   * Demandas concluidas ou canceladas nao entram como em aberto.

2. Criterio para Demandas Proximas do Prazo:
   * Demandas em aberto cujo prazo de finalizacao vence nos proximos 7 dias ou cujo prazo ja expirou sem conclusao.

---

## Rotas de Abdallah Ali Borges El Khatib

### 1. POST /demandas
Cadastra uma nova demanda validando titulo, descricao, tipo, prioridade e projeto. O status 'Aberta', a data de criacao, atualizacao e ID sao gerados automaticamente pelo servidor.

Exemplo de requisicao:
```bash
curl -X POST http://localhost:3000/demandas \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Corrigir falha no login",
    "descricao": "Erro ao logar com caracteres especiais",
    "tipo": "Defeito",
    "prioridade": "Alta",
    "projetoId": "PRJ-001",
    "responsavelId": "USR-004",
    "prazoFinalizacao": "2026-11-20"
  }'
```

Resposta de sucesso (201 Created):
```json
{
  "mensagem": "Demanda cadastrada com sucesso.",
  "demanda": {
    "id": "DEM-009",
    "titulo": "Corrigir falha no login",
    "status": "Aberta"
  }
}
```

Exemplo de erro (400 Bad Request):
```bash
curl -X POST http://localhost:3000/demandas \
  -H "Content-Type: application/json" \
  -d '{"titulo": "Sem descricao"}'
```

---

### 2. GET /projetos
Retorna a lista dos projetos pre-cadastrados.

Exemplo de requisicao:
```bash
curl http://localhost:3000/projetos
```

---

### 3. GET /dashboard
Retorna os totais de demandas por status, prioridade, tipo, demandas criticas em aberto e proximas do prazo.

Exemplo de requisicao:
```bash
curl http://localhost:3000/dashboard
```
