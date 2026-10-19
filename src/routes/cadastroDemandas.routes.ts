// Feito por: Abdallah Ali Borges El Khatib
// Rota de Cadastro de Demandas - Reuniao 4 PI2

import { Router, Request, Response } from 'express';
import { demandas, projetos, usuarios } from '../data/mockData';
import { Demanda, TipoDemanda, PrioridadeDemanda } from '../types';

const router = Router();

// Funcao para normalizar texto (tira acentos e deixa minusculo)
function normalizarTexto(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

// Mapa para aceitar tipos com ou sem acento
const MAPA_TIPOS: Record<string, TipoDemanda> = {
    'tarefa': 'Tarefa',
    'defeito': 'Defeito',
    'melhoria': 'Melhoria',
    'documentacao': 'Documentação',
    'documentação': 'Documentação'
};

// Mapa para aceitar prioridades com ou sem acento
const MAPA_PRIORIDADES: Record<string, PrioridadeDemanda> = {
    'critica': 'Crítica',
    'crítica': 'Crítica',
    'alta': 'Alta',
    'media': 'Média',
    'média': 'Média',
    'baixa': 'Baixa'
};

let contadorDemanda = demandas.length + 1;

// Valida se a string e uma data valida
function isDataValida(str: string): boolean {
    const data = new Date(str);
    return !isNaN(data.getTime());
}

// POST /demandas - cadastra uma nova demanda
router.post('/', (req: Request, res: Response) => {
    const {
        titulo,
        descricao,
        tipo,
        prioridade,
        projetoId,
        projeto,
        responsavelId,
        responsavel,
        prazoFinalizacao
    } = req.body;

    const idDoProjeto = projetoId || projeto;

    // Validacao dos campos obrigatorios
    if (!titulo || typeof titulo !== 'string' || titulo.trim() === '') {
        return res.status(400).json({
            erro: true,
            mensagem: 'O título da demanda é obrigatório.'
        });
    }

    if (!descricao || typeof descricao !== 'string' || descricao.trim() === '') {
        return res.status(400).json({
            erro: true,
            mensagem: 'A descrição detalhada da demanda é obrigatória.'
        });
    }

    if (!tipo || typeof tipo !== 'string' || tipo.trim() === '') {
        return res.status(400).json({
            erro: true,
            mensagem: 'O tipo da demanda é obrigatório.'
        });
    }

    if (!prioridade || typeof prioridade !== 'string' || prioridade.trim() === '') {
        return res.status(400).json({
            erro: true,
            mensagem: 'A prioridade da demanda é obrigatória.'
        });
    }

    if (!idDoProjeto || typeof idDoProjeto !== 'string' || idDoProjeto.trim() === '') {
        return res.status(400).json({
            erro: true,
            mensagem: 'O projeto vinculado à demanda é obrigatório.'
        });
    }

    // Valida tipo
    const chaveTipo = normalizarTexto(tipo);
    const tipoValido = MAPA_TIPOS[chaveTipo];
    if (!tipoValido) {
        return res.status(400).json({
            erro: true,
            mensagem: 'Tipo de demanda inválido. Valores aceitos: Tarefa, Defeito, Melhoria, Documentação.'
        });
    }

    // Valida prioridade
    const chavePrioridade = normalizarTexto(prioridade);
    const prioridadeValida = MAPA_PRIORIDADES[chavePrioridade];
    if (!prioridadeValida) {
        return res.status(400).json({
            erro: true,
            mensagem: 'Prioridade inválida. Valores aceitos: Crítica, Alta, Média, Baixa.'
        });
    }

    // Verifica se o projeto existe
    const projetoEncontrado = projetos.find(
        p => p.id.toLowerCase() === idDoProjeto.trim().toLowerCase() ||
             p.nome.toLowerCase() === idDoProjeto.trim().toLowerCase()
    );

    if (!projetoEncontrado) {
        return res.status(400).json({
            erro: true,
            mensagem: `Projeto informado '${idDoProjeto}' não foi encontrado. Consulte GET /projetos para ver os projetos disponíveis.`
        });
    }

    // Verifica se o responsavel existe caso informado
    const idDoResponsavel = responsavelId || responsavel;
    let usuarioResponsavelNome: string | null = null;
    let usuarioResponsavelId: string | null = null;

    if (idDoResponsavel && typeof idDoResponsavel === 'string' && idDoResponsavel.trim() !== '') {
        const usuarioEncontrado = usuarios.find(
            u => u.id.toLowerCase() === idDoResponsavel.trim().toLowerCase() ||
                 u.nome.toLowerCase() === idDoResponsavel.trim().toLowerCase() ||
                 u.email.toLowerCase() === idDoResponsavel.trim().toLowerCase()
        );

        if (!usuarioEncontrado) {
            return res.status(400).json({
                erro: true,
                mensagem: `Responsável informado '${idDoResponsavel}' não existe no sistema. Consulte GET /usuarios.`
            });
        }

        usuarioResponsavelId = usuarioEncontrado.id;
        usuarioResponsavelNome = usuarioEncontrado.nome;
    }

    // Valida o formato da data caso enviada
    let prazoFinal: string | null = null;
    if (prazoFinalizacao !== undefined && prazoFinalizacao !== null && String(prazoFinalizacao).trim() !== '') {
        if (!isDataValida(String(prazoFinalizacao))) {
            return res.status(400).json({
                erro: true,
                mensagem: 'Prazo de finalização informado possui formato de data inválido. Utilize o formato YYYY-MM-DD.'
            });
        }
        prazoFinal = String(prazoFinalizacao).trim().split('T')[0];
    }

    // Geracao de dados pelo servidor
    const agora = new Date().toISOString();
    const novoId = `DEM-${String(contadorDemanda++).padStart(3, '0')}`;

    const novaDemanda: Demanda = {
        id: novoId,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        tipo: tipoValido,
        prioridade: prioridadeValida,
        status: 'Aberta',
        projetoId: projetoEncontrado.id,
        projetoNome: projetoEncontrado.nome,
        responsavelId: usuarioResponsavelId,
        responsavelNome: usuarioResponsavelNome,
        dataCriacao: agora.split('T')[0],
        dataAtualizacao: agora,
        prazoFinalizacao: prazoFinal
    };

    demandas.push(novaDemanda);

    return res.status(201).json({
        mensagem: 'Demanda cadastrada com sucesso.',
        demanda: novaDemanda
    });
});

export default router;
