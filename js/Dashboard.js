// Autor: Abdallah Ali Borges El Khatib
// Carregamento e renderizacao do painel via GET /dashboard

function exibirErroDashboard(mensagem) {
    const box = document.getElementById('dashboardErro');
    if (box) {
        box.textContent = mensagem;
        box.classList.remove('d-none');
    }
}

function preencherTabelaDemandas(tbodyId, lista, campoTerceiraColuna) {
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

    lista.forEach(item => {
        const tr = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = String(item.id);

        const tdTitulo = document.createElement('td');
        const link = document.createElement('a');
        link.href = `Tela_detalhes_demanda.html?id=${item.id}`;
        link.className = 'text-decoration-none';
        link.textContent = item.titulo;
        tdTitulo.appendChild(link);

        const tdExtra = document.createElement('td');
        tdExtra.textContent = item[campoTerceiraColuna] || 'Sem responsavel';

        const tdStatus = document.createElement('td');
        tdStatus.textContent = item.status;

        const tdPrazo = document.createElement('td');
        tdPrazo.textContent = item.prazoFinalizacao || 'Sem prazo';

        tr.appendChild(tdId);
        tr.appendChild(tdTitulo);
        tr.appendChild(tdExtra);
        tr.appendChild(tdStatus);
        tr.appendChild(tdPrazo);

        tbody.appendChild(tr);
    });
}

function renderizarGraficos(resumo) {
    const total = resumo.totalDemandas;

    const ctxPrioridade = document.getElementById('barChartPrioridade').getContext('2d');
    new Chart(ctxPrioridade, {
        type: 'bar',
        data: {
            labels: ['Crítica', 'Alta', 'Média', 'Baixa'],
            datasets: [
                {
                    label: 'Demandas',
                    data: [
                        resumo.porPrioridade['Crítica'] || 0,
                        resumo.porPrioridade['Alta'] || 0,
                        resumo.porPrioridade['Média'] || 0,
                        resumo.porPrioridade['Baixa'] || 0
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
        resumo.porStatus['Aberta'] || 0,
        resumo.porStatus['Em andamento'] || 0,
        resumo.porStatus['Em revisão'] || 0,
        resumo.porStatus['Concluída'] || 0,
        resumo.porStatus['Cancelada'] || 0
    ];

    new Chart(ctxStatus, {
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
    new Chart(ctxTipo, {
        type: 'bar',
        data: {
            labels: ['Tarefa', 'Defeito', 'Melhoria', 'Documentação'],
            datasets: [
                {
                    label: 'Demandas',
                    data: [
                        resumo.porTipo['Tarefa'] || 0,
                        resumo.porTipo['Defeito'] || 0,
                        resumo.porTipo['Melhoria'] || 0,
                        resumo.porTipo['Documentação'] || 0
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
}

async function initDashboard() {
    const usuario = verificarAutenticacao();
    if (!usuario) {
        return;
    }

    preencherUsuarioTopbar(usuario);

    try {
        const { ok, dados } = await apiFetch('/dashboard');

        if (!ok) {
            exibirErroDashboard(dados.mensagem || 'Erro ao carregar dados do painel.');
            return;
        }

        document.getElementById('metricTotal').textContent = String(dados.totalDemandas ?? 0);
        document.getElementById('metricAbertas').textContent = String(dados.porStatus['Aberta'] ?? 0);
        document.getElementById('metricEmAndamento').textContent = String(dados.porStatus['Em andamento'] ?? 0);
        document.getElementById('metricEmRevisao').textContent = String(dados.porStatus['Em revisão'] ?? 0);
        document.getElementById('metricConcluidas').textContent = String(dados.porStatus['Concluída'] ?? 0);
        document.getElementById('metricCanceladas').textContent = String(dados.porStatus['Cancelada'] ?? 0);

        renderizarGraficos(dados);
        preencherTabelaDemandas('tabelaCriticas', dados.demandasCriticasEmAberto, 'projetoNome');
        preencherTabelaDemandas('tabelaPrazo', dados.demandasProximasPrazo, 'responsavelNome');
    } catch {
        exibirErroDashboard('Nao foi possivel conectar ao servidor para carregar o painel.');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
