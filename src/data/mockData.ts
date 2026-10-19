// Feito por: Equipe PI-II (Abdallah Ali Borges El Khatib, Enrico Pacheco Del Manto, Lucas Ruman, Vinicius Morais)
// Base de dados de teste compartilhada e mantida em memória

import { Usuario, Projeto, Demanda, Comentario } from '../types';

// Função auxiliar para gerar datas relativas ao dia de execução
function gerarDataRelativa(diasOffset: number): string {
    const data = new Date();
    data.setDate(data.getDate() + diasOffset);
    return data.toISOString().split('T')[0];
}

// Usuários pré-cadastrados cobrindo os três perfis exigidos
export const usuarios: Usuario[] = [
    {
        id: 'USR-001',
        nome: 'Carlos Santos (Admin)',
        email: 'admin@puc.br',
        senha: 'AdminPassword123',
        perfil: 'Administrador'
    },
    {
        id: 'USR-002',
        nome: 'Mariana Silva (Líder)',
        email: 'lider@puc.br',
        senha: 'LiderPassword123',
        perfil: 'Líder de Projeto'
    },
    {
        id: 'USR-003',
        nome: 'Lucas Ruman (Desenvolvedor)',
        email: 'lucas@puc.br',
        senha: 'DevPassword123',
        perfil: 'Membro da Equipe'
    },
    {
        id: 'USR-004',
        nome: 'Enrico Pacheco (Desenvolvedor)',
        email: 'enrico@puc.br',
        senha: 'DevPassword123',
        perfil: 'Membro da Equipe'
    },
    {
        id: 'USR-005',
        nome: 'Vinicius Morais (Desenvolvedor)',
        email: 'vinicius@puc.br',
        senha: 'DevPassword123',
        perfil: 'Membro da Equipe'
    },
    {
        id: 'USR-006',
        nome: 'Abdallah Khatib (Desenvolvedor)',
        email: 'abdallah@puc.br',
        senha: 'DevPassword123',
        perfil: 'Membro da Equipe'
    }
];

// Projetos pré-cadastrados
export const projetos: Projeto[] = [
    {
        id: 'PRJ-001',
        nome: 'Portal de Atendimento ao Cliente',
        descricao: 'Plataforma web para autoatendimento e abertura de chamados pelos clientes.',
        dataCriacao: '2026-01-15'
    },
    {
        id: 'PRJ-002',
        nome: 'Sistema de Faturamento Automático',
        descricao: 'Módulo backend para emissão e conciliação de faturas fiscais e cobranças.',
        dataCriacao: '2026-02-01'
    },
    {
        id: 'PRJ-003',
        nome: 'App Mobile de Logística e Entregas',
        descricao: 'Aplicativo híbrido para rastreamento de entregas em tempo real.',
        dataCriacao: '2026-03-10'
    }
];

// Demandas de teste com tipos, prioridades, status e prazos variados
export const demandas: Demanda[] = [
    {
        id: 'DEM-001',
        titulo: 'Falha crítica de autenticação no portal',
        descricao: 'Usuários não conseguem realizar login quando há caracteres especiais no e-mail.',
        tipo: 'Defeito',
        prioridade: 'Crítica',
        status: 'Aberta',
        projetoId: 'PRJ-001',
        projetoNome: 'Portal de Atendimento ao Cliente',
        responsavelId: 'USR-004',
        responsavelNome: 'Enrico Pacheco (Desenvolvedor)',
        dataCriacao: gerarDataRelativa(-5),
        dataAtualizacao: gerarDataRelativa(-1),
        prazoFinalizacao: gerarDataRelativa(2) // Próxima do prazo (2 dias restantes)
    },
    {
        id: 'DEM-002',
        titulo: 'Implementar exportação de relatórios em PDF',
        descricao: 'Permitir que líderes baixem faturas consolidadas do mês em formato PDF.',
        tipo: 'Melhoria',
        prioridade: 'Alta',
        status: 'Em andamento',
        projetoId: 'PRJ-002',
        projetoNome: 'Sistema de Faturamento Automático',
        responsavelId: 'USR-003',
        responsavelNome: 'Lucas Ruman (Desenvolvedor)',
        dataCriacao: gerarDataRelativa(-10),
        dataAtualizacao: gerarDataRelativa(-2),
        prazoFinalizacao: gerarDataRelativa(4) // Próxima do prazo (4 dias restantes)
    },
    {
        id: 'DEM-003',
        titulo: 'Vazamento de memória no serviço de notas fiscais',
        descricao: 'Serviço de notas fiscais reinicia após 1000 requisições simultâneas em produção.',
        tipo: 'Defeito',
        prioridade: 'Crítica',
        status: 'Em andamento',
        projetoId: 'PRJ-002',
        projetoNome: 'Sistema de Faturamento Automático',
        responsavelId: 'USR-006',
        responsavelNome: 'Abdallah Khatib (Desenvolvedor)',
        dataCriacao: gerarDataRelativa(-3),
        dataAtualizacao: gerarDataRelativa(-1),
        prazoFinalizacao: gerarDataRelativa(3) // Próxima do prazo (3 dias restantes)
    },
    {
        id: 'DEM-004',
        titulo: 'Elaborar documentação de arquitetura da API',
        descricao: 'Criar diagramas C4 e documentação de rotas Swagger/OpenAPI para desenvolvedores.',
        tipo: 'Documentação',
        prioridade: 'Baixa',
        status: 'Em revisão',
        projetoId: 'PRJ-001',
        projetoNome: 'Portal de Atendimento ao Cliente',
        responsavelId: 'USR-005',
        responsavelNome: 'Vinicius Morais (Desenvolvedor)',
        dataCriacao: gerarDataRelativa(-15),
        dataAtualizacao: gerarDataRelativa(-3),
        prazoFinalizacao: gerarDataRelativa(20)
    },
    {
        id: 'DEM-005',
        titulo: 'Criar tela de perfil do motorista',
        descricao: 'Construir tela no aplicativo para que o motorista visualize dados e rotas do dia.',
        tipo: 'Tarefa',
        prioridade: 'Média',
        status: 'Aberta',
        projetoId: 'PRJ-003',
        projetoNome: 'App Mobile de Logística e Entregas',
        responsavelId: null, // Sem responsável alocado inicialmente
        responsavelNome: null,
        dataCriacao: gerarDataRelativa(-2),
        dataAtualizacao: gerarDataRelativa(-2),
        prazoFinalizacao: gerarDataRelativa(15)
    },
    {
        id: 'DEM-006',
        titulo: 'Ajuste no tempo limite de consulta ao GPS',
        descricao: 'Aumentar o timeout do GPS de 3s para 8s para evitar cancelamento indevido.',
        tipo: 'Melhoria',
        prioridade: 'Alta',
        status: 'Concluída',
        projetoId: 'PRJ-003',
        projetoNome: 'App Mobile de Logística e Entregas',
        responsavelId: 'USR-003',
        responsavelNome: 'Lucas Ruman (Desenvolvedor)',
        dataCriacao: gerarDataRelativa(-20),
        dataAtualizacao: gerarDataRelativa(-5),
        prazoFinalizacao: gerarDataRelativa(-6)
    },
    {
        id: 'DEM-007',
        titulo: 'Cancelamento de integração legada com ERP antigo',
        descricao: 'Demanda cancelada após definição de migração direta para o novo ERP em nuvem.',
        tipo: 'Tarefa',
        prioridade: 'Baixa',
        status: 'Cancelada',
        projetoId: 'PRJ-002',
        projetoNome: 'Sistema de Faturamento Automático',
        responsavelId: 'USR-002',
        responsavelNome: 'Mariana Silva (Líder)',
        dataCriacao: gerarDataRelativa(-30),
        dataAtualizacao: gerarDataRelativa(-10),
        prazoFinalizacao: null
    },
    {
        id: 'DEM-008',
        titulo: 'Interrupção na sincronização de notificações push',
        descricao: 'Dispositivos iOS não estão recebendo alertas em segundo plano.',
        tipo: 'Defeito',
        prioridade: 'Crítica',
        status: 'Aberta',
        projetoId: 'PRJ-003',
        projetoNome: 'App Mobile de Logística e Entregas',
        responsavelId: 'USR-005',
        responsavelNome: 'Vinicius Morais (Desenvolvedor)',
        dataCriacao: gerarDataRelativa(-1),
        dataAtualizacao: gerarDataRelativa(-1),
        prazoFinalizacao: gerarDataRelativa(1) // Próxima do prazo (1 dia restante)
    }
];

// Comentários pré-cadastrados vinculados às demandas e usuários
export const comentarios: Comentario[] = [
    {
        id: 'COM-001',
        demandaId: 'DEM-001',
        usuarioId: 'USR-002',
        usuarioNome: 'Mariana Silva (Líder)',
        texto: 'Por favor, priorizem a correção deste bug de login, pois impacta diretamente os clientes.',
        dataCriacao: new Date(Date.now() - 3600000 * 24).toISOString()
    },
    {
        id: 'COM-002',
        demandaId: 'DEM-001',
        usuarioId: 'USR-004',
        usuarioNome: 'Enrico Pacheco (Desenvolvedor)',
        texto: 'Já identifiquei a expressão regular que causava o erro. Estou preparando o teste unitário.',
        dataCriacao: new Date(Date.now() - 3600000 * 12).toISOString()
    },
    {
        id: 'COM-003',
        demandaId: 'DEM-002',
        usuarioId: 'USR-003',
        usuarioNome: 'Lucas Ruman (Desenvolvedor)',
        texto: 'A biblioteca de PDF foi configurada no backend e o layout da fatura está sendo montado.',
        dataCriacao: new Date(Date.now() - 3600000 * 48).toISOString()
    }
];
