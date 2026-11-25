// Autor: Abdallah Ali Borges El Khatib
// Carregamento e renderizacao do painel via GET /dashboard

let graficoPrioridade = null;
let graficoStatus = null;
let graficoTipo = null;

function exibirErroDashboard(mensagem) {
    const box = document.getElementById('dashboardErro');
    if (box) {
        box.textContent = mensagem;
        box.classList.remove('d-none');
    }
}

function exibirAvisoGraficosIndisponiveis(mensagem) {
    const pares = [
        ['barChartPrioridade', 'avisoChartPrioridade'],
        ['doughnutChartStatus', 'avisoChartStatus'],
        ['barChartTipo', 'avisoChartTipo']
    ];

    pares.forEach(([canvasId, avisoId]) => {
        const canvas = document.getElementById(canvasId);
        const aviso = document.getElementById(avisoId);
        if (canvas) {
            canvas.classList.add('d-none');
        }
        if (aviso) {
            aviso.textContent = mensagem;
            aviso.classList.remove('d-none');
        }
    });
}

function destruirGraficos() {
    if (graficoPrioridade) {
        graficoPrioridade.destroy();
        graficoPrioridade = null;
    }
    if (graficoStatus) {
        graficoStatus.destroy();
        graficoStatus = null;
    }
    if (graficoTipo) {
        graficoTipo.destroy();
        graficoTipo = null;
    }
}

// Preenche as tabelas de atencao com prazo formatado e badge para demandas vencidas
function preencherTabelaDemandas(tbodyId, lista, campoTerceiraColuna, fallbackTerceiraColuna, destacarVencidas = false) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) {
        return;
    }

    tbody.textContent = '';

    if (!lista || lista.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.className = 'text-center text-muted py-3';
        td.textContent = 'Nenhuma demanda encontrada.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    const hojeIso = Auth.obterDataHojeIso();

    lista.forEach(item => {
        const tr = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = String(item.id);

        const tdTitulo = document.createElement('td');
        const link = document.createElement('a');
        link.href = `Tela_detalhes_demanda.html?id=${encodeURIComponent(item.id)}`;
        link.className = 'text-decoration-none';
        link.textContent = item.titulo;
        tdTitulo.appendChild(link);

        const tdExtra = document.createElement('td');
        tdExtra.textContent = item[campoTerceiraColuna] || fallbackTerceiraColuna;

        const tdStatus = document.createElement('td');
        tdStatus.textContent = item.status;

        const tdPrazo = document.createElement('td');
        tdPrazo.className = 'text-nowrap';
        if (item.prazoFinalizacao) {
            tdPrazo.appendChild(document.createTextNode(Auth.formatarData(item.prazoFinalizacao)));
            const estaVencida = Boolean(item.vencida) || item.prazoFinalizacao < hojeIso;
            if (destacarVencidas && estaVencida) {
                const badgeVencida = document.createElement('span');
                badgeVencida.className = 'badge bg-danger ms-1';
                badgeVencida.textContent = 'Vencida';
                tdPrazo.appendChild(badgeVencida);
            }
        } else {
            tdPrazo.textContent = 'Sem prazo';
        }

        tr.appendChild(tdId);
        tr.appendChild(tdTitulo);
        tr.appendChild(tdExtra);
        tr.appendChild(tdStatus);
        tr.appendChild(tdPrazo);

        tbody.appendChild(tr);
    });
}

// Monta os graficos de prioridade, status e tipo com Chart.js protegendo contra falha de CDN
function renderizarGraficos(resumo) {
    if (typeof Chart === 'undefined') {
        exibirAvisoGraficosIndisponiveis('Gráfico indisponível no momento (biblioteca Chart.js não carregada).');
        return;
    }

    try {
        destruirGraficos();

        const total = resumo.totalDemandas || 0;
        const porPrioridade = resumo.porPrioridade || {};
        const porStatus = resumo.porStatus || {};
        const porTipo = resumo.porTipo || {};

        const ctxPrioridade = document.getElementById('barChartPrioridade').getContext('2d');
        graficoPrioridade = new Chart(ctxPrioridade, {
            type: 'bar',
            data: {
                labels: ['Crítica', 'Alta', 'Média', 'Baixa'],
                datasets: [
                    {
                        label: 'Demandas',
                        data: [
                            porPrioridade['Crítica'] || 0,
                            porPrioridade['Alta'] || 0,
                            porPrioridade['Média'] || 0,
                            porPrioridade['Baixa'] || 0
                        ],
                        backgroundColor: ['#6f42c1', '#dc3545', '#ffc107', '#198754']
                    }
                ]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, suggestedMax: total < 5 ? 5 : total, ticks: { stepSize: 1 } }
                }
            }
        });

        const ctxStatus = document.getElementById('doughnutChartStatus').getContext('2d');
        const valoresStatus = [
            porStatus['Aberta'] || 0,
            porStatus['Em andamento'] || 0,
            porStatus['Em revisão'] || 0,
            porStatus['Concluída'] || 0,
            porStatus['Cancelada'] || 0
        ];

        graficoStatus = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: total === 0 ? ['Sem dados'] : ['Aberta', 'Em andamento', 'Em revisão', 'Concluída', 'Cancelada'],
                datasets: [
                    {
                        data: total === 0 ? [1] : valoresStatus,
                        backgroundColor:
                            total === 0
                                ? ['#e2e8f0']
                                : ['#0d6efd', '#ffc107', '#0dcaf0', '#198754', '#6c757d']
                    }
                ]
            },
            options: {
                cutout: '60%',
                plugins: {
                    legend: { display: total > 0, position: 'bottom' },
                    tooltip: { enabled: total > 0 }
                }
            }
        });

        const ctxTipo = document.getElementById('barChartTipo').getContext('2d');
        graficoTipo = new Chart(ctxTipo, {
            type: 'bar',
            data: {
                labels: ['Tarefa', 'Defeito', 'Melhoria', 'Documentação'],
                datasets: [
                    {
                        label: 'Demandas',
                        data: [
                            porTipo['Tarefa'] || 0,
                            porTipo['Defeito'] || 0,
                            porTipo['Melhoria'] || 0,
                            porTipo['Documentação'] || 0
                        ],
                        backgroundColor: ['#0d6efd', '#dc3545', '#20c997', '#6c757d']
                    }
                ]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, suggestedMax: total < 5 ? 5 : total, ticks: { stepSize: 1 } }
                }
            }
        });
    } catch {
        exibirAvisoGraficosIndisponiveis('Não foi possível renderizar o gráfico no momento.');
    }
}

function exibirCriteriosDashboard(criterios) {
    if (!criterios) {
        return;
    }
    const elCriticas = document.getElementById('criterioCriticas');
    if (elCriticas && criterios.emAberto) {
        elCriticas.textContent = criterios.emAberto;
        elCriticas.classList.remove('d-none');
    }
    const elPrazo = document.getElementById('criterioPrazo');
    if (elPrazo && criterios.proximasDoPrazo) {
        elPrazo.textContent = criterios.proximasDoPrazo;
        elPrazo.classList.remove('d-none');
    }
}

// Busca os indicadores em GET /dashboard e atualiza cards, graficos e tabelas
async function initDashboard() {
    const usuario = verificarAutenticacao();
    if (!usuario) {
        return;
    }

    preencherUsuarioTopbar(usuario);

    try {
        const { ok, redirecionado, dados } = await apiFetch('/dashboard');
        if (redirecionado) {
            return;
        }

        if (!ok) {
            exibirErroDashboard(dados.mensagem || 'Erro ao carregar dados do painel.');
            return;
        }

        const porStatus = dados.porStatus || {};
        document.getElementById('metricTotal').textContent = String(dados.totalDemandas ?? 0);
        document.getElementById('metricAbertas').textContent = String(porStatus['Aberta'] ?? 0);
        document.getElementById('metricEmAndamento').textContent = String(porStatus['Em andamento'] ?? 0);
        document.getElementById('metricEmRevisao').textContent = String(porStatus['Em revisão'] ?? 0);
        document.getElementById('metricConcluidas').textContent = String(porStatus['Concluída'] ?? 0);
        document.getElementById('metricCanceladas').textContent = String(porStatus['Cancelada'] ?? 0);

        exibirCriteriosDashboard(dados.criterios);
        preencherTabelaDemandas('tabelaCriticas', dados.demandasCriticasEmAberto, 'projetoNome', 'Sem projeto', true);
        preencherTabelaDemandas('tabelaPrazo', dados.demandasProximasPrazo, 'responsavelNome', 'Sem responsável', true);
        renderizarGraficos(dados);
    } catch {
        exibirErroDashboard('Não foi possível conectar ao servidor para carregar o painel.');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
