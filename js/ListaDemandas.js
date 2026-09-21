document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.querySelector('tbody');
    const searchInput = document.getElementById('searchInput');
    
    // Ler demandas do localStorage
    let demandas = JSON.parse(localStorage.getItem('demandas')) || [];
    
    if (demandas.length === 0) {
        demandas = [
            {
                id: 'DEM-001',
                titulo: 'Ajuste no fluxo de login',
                solicitante: 'João Silva',
                prioridade: 'Alta',
                dataDesejada: '2023-11-05',
                dataCriacao: '2023-10-20',
                descricao: 'Ajuste no fluxo de login para corrigir travamentos em smartphones. Ajuste da Demanda em solicitante, Tipo: Melhoria, Prioridade: Alta.',
                tipo: 'Defeito',
                status: 'Aberto'
            }
        ];
        localStorage.setItem('demandas', JSON.stringify(demandas));
    }

    // Função para deletar
    window.deletarDemanda = function(id) {
        if(confirm(`Tem certeza que deseja excluir a demanda ${id}?`)) {
            demandas = demandas.filter(d => d.id !== id);
            localStorage.setItem('demandas', JSON.stringify(demandas));
            renderTable(demandas);
        }
    }
    
    function renderTable(lista) {
        tableBody.innerHTML = '';
        
        if (lista.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-5">
                        <i class="fa-regular fa-folder-open fs-2 mb-2 text-secondary"></i><br>
                        Nenhuma demanda encontrada.
                    </td>
                </tr>
            `;
            return;
        }
        
        lista.forEach(demanda => {
            let badgeColor = demanda.prioridade === 'Alta' ? 'text-danger' : 
                             (demanda.prioridade === 'Média' ? 'text-warning' : 'text-success');
                             
            if(demanda.prioridade === 'Baixa') badgeColor = 'text-success';
            
            let statusBadge = demanda.status === 'Aberto' ? 'bg-primary' : 
                              (demanda.status === 'Em Andamento' ? 'bg-warning text-dark' : 'bg-success');
                              
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${demanda.id}</td>
                <td>${demanda.titulo}</td>
                <td>${demanda.solicitante}</td>
                <td><span class="badge ${statusBadge}">${demanda.status}</span></td>
                <td><span class="${badgeColor}">${demanda.prioridade}</span></td>
                <td>${demanda.dataCriacao}</td>
                <td>
                    <a href="Tela_detalhes_demanda.html?id=${demanda.id}" class="btn btn-sm btn-outline-secondary me-1" title="Ver Detalhes">
                        <i class="fa-solid fa-eye"></i>
                    </a>
                    <button onclick="deletarDemanda('${demanda.id}')" class="btn btn-sm btn-outline-danger" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // Filtro de pesquisa
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const termo = e.target.value.toLowerCase();
            const filtradas = demandas.filter(d => 
                d.titulo.toLowerCase().includes(termo) || 
                d.id.toLowerCase().includes(termo) ||
                d.solicitante.toLowerCase().includes(termo)
            );
            renderTable(filtradas);
        });
    }

    // Render inicial
    renderTable(demandas);
});
