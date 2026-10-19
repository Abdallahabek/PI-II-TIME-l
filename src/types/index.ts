// Feito por: Abdallah Ali Borges El Khatib e Equipe
// Definições de tipos e interfaces do Sistema de Acompanhamento de Demandas

export type PerfilUsuario = 'Administrador' | 'Líder de Projeto' | 'Membro da Equipe';

export type TipoDemanda = 'Tarefa' | 'Defeito' | 'Melhoria' | 'Documentação';

export type PrioridadeDemanda = 'Crítica' | 'Alta' | 'Média' | 'Baixa';

export type StatusDemanda = 'Aberta' | 'Em andamento' | 'Em revisão' | 'Concluída' | 'Cancelada';

export interface Usuario {
    id: string;
    nome: string;
    email: string;
    senha?: string;
    perfil: PerfilUsuario;
}

export type UsuarioPublico = Omit<Usuario, 'senha'>;

export interface Projeto {
    id: string;
    nome: string;
    descricao: string;
    dataCriacao: string;
}

export interface Demanda {
    id: string;
    titulo: string;
    descricao: string;
    tipo: TipoDemanda;
    prioridade: PrioridadeDemanda;
    status: StatusDemanda;
    projetoId: string;
    projetoNome: string;
    responsavelId: string | null;
    responsavelNome: string | null;
    dataCriacao: string;
    dataAtualizacao: string;
    prazoFinalizacao: string | null;
}

export interface Comentario {
    id: string;
    demandaId: string;
    usuarioId: string;
    usuarioNome: string;
    texto: string;
    dataCriacao: string;
}

export interface ResumoDashboard {
    totalDemandas: number;
    porStatus: Record<StatusDemanda, number>;
    porPrioridade: Record<PrioridadeDemanda, number>;
    porTipo: Record<TipoDemanda, number>;
    demandasCriticasEmAberto: Demanda[];
    demandasProximasPrazo: Demanda[];
    criterios: {
        emAberto: string;
        proximasDoPrazo: string;
    };
}
