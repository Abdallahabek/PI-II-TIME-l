// Feito por: Vinicius de Morais Borges de oliveira
// Dados de teste guardados em memória (Reunião 4).
// Enquanto o banco de dados não chega, as rotas leem e gravam nestes arrays.
// Quando reiniciar o servidor, tudo volta ao que está escrito aqui.

export type Perfil = 'Administrador' | 'Líder de Projeto' | 'Membro da Equipe';
export type TipoDemanda = 'Tarefa' | 'Defeito' | 'Melhoria' | 'Documentação';
export type Prioridade = 'Crítica' | 'Alta' | 'Média' | 'Baixa';
export type StatusDemanda = 'Aberta' | 'Em andamento' | 'Em revisão' | 'Concluída' | 'Cancelada';

export interface Projeto {
    id: number;
    nome: string;
}

export interface Usuario {
    id: number;
    nome: string;
    email: string;
    senha: string; // só para teste: nunca devolver a senha nas respostas da API
    perfil: Perfil;
}

export interface Demanda {
    id: number;
    titulo: string;
    descricao: string;
    tipo: TipoDemanda;
    prioridade: Prioridade;
    status: StatusDemanda;
    projetoId: number;
    responsavelId: number | null; // pode ficar em branco
    dataCriacao: string;
    dataAtualizacao: string;
    prazoFinalizacao: string | null;
}

export interface Comentario {
    id: number;
    demandaId: number;
    usuarioId: number;
    texto: string;
    dataHora: string;
}

export const projetos: Projeto[] = [
    { id: 1, nome: 'Portal do Cliente' },
    { id: 2, nome: 'Aplicativo Mobile' },
];

export const usuarios: Usuario[] = [
    { id: 1, nome: 'Marina Souza', email: 'marina@empresa.com', senha: 'Senha123', perfil: 'Administrador' },
    { id: 2, nome: 'Carlos Lima', email: 'carlos@empresa.com', senha: 'Senha123', perfil: 'Líder de Projeto' },
    { id: 3, nome: 'Ana Costa', email: 'ana@empresa.com', senha: 'Senha123', perfil: 'Membro da Equipe' },
    { id: 4, nome: 'Pedro Alves', email: 'pedro@empresa.com', senha: 'Senha123', perfil: 'Membro da Equipe' },
];

export const demandas: Demanda[] = [
    {
        id: 1,
        titulo: 'Corrigir erro no login com e-mail em maiúsculas',
        descricao: 'Ao digitar o e-mail com letras maiúsculas, o sistema diz que o usuário não existe.',
        tipo: 'Defeito',
        prioridade: 'Crítica',
        status: 'Em andamento',
        projetoId: 1,
        responsavelId: 3,
        dataCriacao: '2026-10-05T09:30:00.000Z',
        dataAtualizacao: '2026-10-08T14:10:00.000Z',
        prazoFinalizacao: '2026-10-23',
    },
    {
        id: 2,
        titulo: 'Criar tela de listagem de demandas',
        descricao: 'Montar a tabela com título, tipo, prioridade, status e responsável.',
        tipo: 'Tarefa',
        prioridade: 'Alta',
        status: 'Aberta',
        projetoId: 1,
        responsavelId: 4,
        dataCriacao: '2026-10-06T11:00:00.000Z',
        dataAtualizacao: '2026-10-06T11:00:00.000Z',
        prazoFinalizacao: '2026-10-30',
    },
    {
        id: 3,
        titulo: 'Permitir filtrar demandas por prioridade',
        descricao: 'Adicionar um filtro na listagem para escolher a prioridade desejada.',
        tipo: 'Melhoria',
        prioridade: 'Média',
        status: 'Em revisão',
        projetoId: 2,
        responsavelId: 3,
        dataCriacao: '2026-10-01T08:15:00.000Z',
        dataAtualizacao: '2026-10-12T16:45:00.000Z',
        prazoFinalizacao: '2026-11-10',
    },
    {
        id: 4,
        titulo: 'Documentar como rodar o servidor',
        descricao: 'Explicar no README como instalar as dependências e iniciar o servidor.',
        tipo: 'Documentação',
        prioridade: 'Baixa',
        status: 'Concluída',
        projetoId: 2,
        responsavelId: null,
        dataCriacao: '2026-09-28T10:00:00.000Z',
        dataAtualizacao: '2026-10-02T17:20:00.000Z',
        prazoFinalizacao: null,
    },
    {
        id: 5,
        titulo: 'Corrigir botão de salvar que não responde no celular',
        descricao: 'No aplicativo, o botão de salvar demanda não reage ao toque em alguns aparelhos.',
        tipo: 'Defeito',
        prioridade: 'Alta',
        status: 'Cancelada',
        projetoId: 2,
        responsavelId: 4,
        dataCriacao: '2026-10-03T13:40:00.000Z',
        dataAtualizacao: '2026-10-09T09:05:00.000Z',
        prazoFinalizacao: '2026-11-25',
    },
];

export const comentarios: Comentario[] = [
    { id: 1, demandaId: 1, usuarioId: 3, texto: 'Consegui reproduzir o erro. Vou começar a corrigir hoje.', dataHora: '2026-10-05T15:00:00.000Z' },
    { id: 2, demandaId: 1, usuarioId: 2, texto: 'Esse erro é prioridade, pode focar nele primeiro.', dataHora: '2026-10-06T08:30:00.000Z' },
    { id: 3, demandaId: 1, usuarioId: 3, texto: 'O problema era a comparação do e-mail, já ajustei.', dataHora: '2026-10-08T14:10:00.000Z' },
    { id: 4, demandaId: 3, usuarioId: 4, texto: 'Filtro pronto, falta só revisar o visual.', dataHora: '2026-10-12T16:45:00.000Z' },
    { id: 5, demandaId: 5, usuarioId: 2, texto: 'Cancelada: o problema já foi resolvido na última atualização do app.', dataHora: '2026-10-09T09:05:00.000Z' },
];
