// Feito por: Abdallah Ali Borges El Khatib
// Rota do Dashboard - Reuniao 4 PI2

import { Router, Request, Response } from 'express';
import { demandas } from '../data/mockData';
import { Demanda, StatusDemanda, PrioridadeDemanda, TipoDemanda, ResumoDashboard } from '../types';

const router = Router();

// Status que contam como em aberto
const STATUS_EM_ABERTO: StatusDemanda[] = ['Aberta', 'Em andamento', 'Em revisão'];

// Limite de dias para considerar proxima do prazo
const DIAS_JANELA_PRAZO = 7;

// GET /dashboard - calcula os totais e indicadores
router.get('/', (_req: Request, res: Response) => {
    // Contadores por status
    const porStatus: Record<StatusDemanda, number> = {
        'Aberta': 0,
        'Em andamento': 0,
        'Em revisão': 0,
        'Concluída': 0,
        'Cancelada': 0
    };

    // Contadores por prioridade
    const porPrioridade: Record<PrioridadeDemanda, number> = {
        'Crítica': 0,
        'Alta': 0,
        'Média': 0,
        'Baixa': 0
    };

    // Contadores por tipo
    const porTipo: Record<TipoDemanda, number> = {
        'Tarefa': 0,
        'Defeito': 0,
        'Melhoria': 0,
        'Documentação': 0
    };

    // Conta cada demanda
    for (const d of demandas) {
        if (porStatus[d.status] !== undefined) {
            porStatus[d.status]++;
        }
        if (porPrioridade[d.prioridade] !== undefined) {
            porPrioridade[d.prioridade]++;
        }
        if (porTipo[d.tipo] !== undefined) {
            porTipo[d.tipo]++;
        }
    }

    // Filtra demandas criticas que continuam em aberto
    const demandasCriticasEmAberto: Demanda[] = demandas.filter(
        d => d.prioridade === 'Crítica' && STATUS_EM_ABERTO.includes(d.status)
    );

    // Filtra demandas proximas do prazo (vencendo em ate 7 dias ou vencidas e ainda nao concluidas)
    const agora = new Date();
    agora.setHours(0, 0, 0, 0);

    const limiteJanela = new Date(agora);
    limiteJanela.setDate(limiteJanela.getDate() + DIAS_JANELA_PRAZO);
    limiteJanela.setHours(23, 59, 59, 999);

    const demandasProximasPrazo: Demanda[] = demandas.filter(d => {
        if (!STATUS_EM_ABERTO.includes(d.status)) {
            return false;
        }

        if (!d.prazoFinalizacao) {
            return false;
        }

        const dataPrazo = new Date(d.prazoFinalizacao);
        if (isNaN(dataPrazo.getTime())) {
            return false;
        }

        dataPrazo.setHours(0, 0, 0, 0);

        return dataPrazo <= limiteJanela;
    });

    const resumo: ResumoDashboard = {
        totalDemandas: demandas.length,
        porStatus,
        porPrioridade,
        porTipo,
        demandasCriticasEmAberto,
        demandasProximasPrazo,
        criterios: {
            emAberto: "Consideram-se 'em aberto' todas as demandas com status ativo no ciclo de desenvolvimento: 'Aberta', 'Em andamento' ou 'Em revisão' (excluem-se 'Concluída' e 'Cancelada').",
            proximasDoPrazo: `Consideram-se 'próximas do prazo' as demandas em aberto cujo prazo de finalização está situado nos próximos ${DIAS_JANELA_PRAZO} dias a partir da data atual ou cujo prazo já expirou sem que a demanda tenha sido concluída.`
        }
    };

    return res.status(200).json(resumo);
});

export default router;
