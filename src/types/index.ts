// Autor: Abdallah Ali Borges El Khatib
// Interfaces e tipos compartilhados do sistema

// Perfis e enumeracoes de dominio conforme Documento de Visao
export type PerfilUsuario = 'Administrador' | 'Líder de Projeto' | 'Membro da Equipe';

export type TipoDemanda = 'Tarefa' | 'Defeito' | 'Melhoria' | 'Documentação';

export type PrioridadeDemanda = 'Crítica' | 'Alta' | 'Média' | 'Baixa';

export type StatusDemanda = 'Aberta' | 'Em andamento' | 'Em revisão' | 'Concluída' | 'Cancelada';

export interface Usuario {
    id: number;
    nome: string;
    email: string;
    senha?: string;
    perfil: PerfilUsuario;
}

export type UsuarioPublico = Omit<Usuario, 'senha'>;

export interface Projeto {
    id: number;
    nome: string;
    descricao: string;
    dataCriacao: string;
}

export interface Demanda {
    id: number;
    titulo: string;
    descricao: string;
    tipo: TipoDemanda;
    prioridade: PrioridadeDemanda;
    status: StatusDemanda;
    projetoId: number;
    projetoNome: string;
    responsavelId: number | null;
    responsavelNome: string | null;
    dataCriacao: string;
    dataAtualizacao: string;
    prazoFinalizacao: string | null;
}

export interface Comentario {
    id: number;
    demandaId: number;
    usuarioId: number;
    usuarioNome: string;
    texto: string;
    dataCriacao: string;
}

export interface HistoricoAlteracao {
    id: number;
    demandaId: number;
    usuarioId: number;
    usuarioNome: string;
    campoAlterado: string;
    valorAnterior: string | null;
    valorNovo: string;
    descricao: string;
    dataAlteracao: string;
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

// Adiciona o usuario autenticado ao objeto Request do Express
declare global {
    namespace Express {
        interface Request {
            usuario?: UsuarioPublico;
        }
    }
}
