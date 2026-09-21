document.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    const idUrl = params.get('id');

    if (!idUrl) {
        alert('Nenhuma demanda selecionada.');
        window.location.href = 'Front_telademanda.html';
        return;
    }

    let demandas = JSON.parse(localStorage.getItem('demandas')) || [];
    let demandaIndex = demandas.findIndex(d => d.id === idUrl);

    if (demandaIndex === -1) {
        alert('Demanda não encontrada.');
        window.location.href = 'Front_telademanda.html';
        return;
    }

    let demanda = demandas[demandaIndex];

    function renderizarDetalhes() {
        document.getElementById('detalhe-titulo').textContent = `Detalhes da Demanda: ${demanda.titulo} (${demanda.id})`;
        document.getElementById('detalhe-solicitante').textContent = demanda.solicitante;
        document.getElementById('detalhe-tipo').textContent = demanda.tipo;
        
        const elPrioridade = document.getElementById('detalhe-prioridade');
        elPrioridade.textContent = demanda.prioridade;
        elPrioridade.className = demanda.prioridade === 'Alta' ? 'text-danger' : (demanda.prioridade === 'Média' ? 'text-warning' : 'text-success');

        document.getElementById('detalhe-criacao').textContent = demanda.dataCriacao;
        document.getElementById('detalhe-desejada').textContent = demanda.dataDesejada;
        document.getElementById('detalhe-descricao').textContent = demanda.descricao;
        
        const tableHistory = document.getElementById('detalhe-historico');
        if (tableHistory) {
            let statusBadge = demanda.status === 'Aberto' ? 'bg-primary' : 
                              (demanda.status === 'Em Andamento' ? 'bg-warning text-dark' : 'bg-success');

            tableHistory.innerHTML = `
                <tr>
                    <td>${demanda.id}</td>
                    <td>${demanda.titulo}</td>
                    <td><span class="badge ${statusBadge}">${demanda.status}</span></td>
                    <td>${demanda.dataDesejada}</td>
                    <td>${demanda.dataCriacao}</td>
                </tr>
            `;
        }

        renderizarBotoes();
    }

    function renderizarBotoes() {
        const container = document.getElementById('acoes-status');
        container.innerHTML = ''; // Limpa botões

        if (demanda.status === 'Aberto') {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar Desenvolvimento';
            btn.onclick = () => mudarStatus('Em Andamento');
            container.appendChild(btn);
        } else if (demanda.status === 'Em Andamento') {
            const btn = document.createElement('button');
            btn.className = 'btn btn-success';
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Concluir Demanda';
            btn.onclick = () => mudarStatus('Concluído');
            container.appendChild(btn);
        } else {
            const badge = document.createElement('span');
            badge.className = 'badge bg-success fs-6';
            badge.innerHTML = '<i class="fa-solid fa-check-double"></i> Demanda Finalizada';
            container.appendChild(badge);
        }
    }

    function mudarStatus(novoStatus) {
        if(confirm(`Mudar o status para "${novoStatus}"?`)) {
            demanda.status = novoStatus;
            demandas[demandaIndex] = demanda;
            localStorage.setItem('demandas', JSON.stringify(demandas));
            renderizarDetalhes();
        }
    }

    renderizarDetalhes();
});
