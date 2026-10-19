// Feito por: Abdallah Ali Borges El Khatib

function initNovaDemandaValidation() {
    const form = document.querySelector('form');

    if (form) {
        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            // Pega os campos do formulario
            const tituloInput = document.getElementById('titulo');
            const solicitanteSelect = document.getElementById('solicitante');
            const prioridadeSelect = document.getElementById('prioridade');
            const dataInput = document.getElementById('dataDesejada');
            const descricaoInput = document.getElementById('descricao');
            const tipoRadios = document.getElementsByName('tipo');

            const titulo = tituloInput ? tituloInput.value.trim() : '';
            const solicitante = solicitanteSelect ? solicitanteSelect.value : '';
            const prioridade = prioridadeSelect ? prioridadeSelect.value : '';
            const data = dataInput ? dataInput.value : '';
            const descricao = descricaoInput ? descricaoInput.value.trim() : '';

            // Verifica o tipo selecionado
            let tipoSelecionado = false;
            let tipoSelecionadoValor = '';
            for (let i = 0; i < tipoRadios.length; i++) {
                if (tipoRadios[i].checked) {
                    tipoSelecionado = true;
                    tipoSelecionadoValor = tipoRadios[i].value;
                    break;
                }
            }

            // Validacoes basicas de interface
            if (titulo === '') {
                alert('O Título da demanda é obrigatório.');
                return;
            }
            if (descricao === '') {
                alert('A Descrição detalhada é obrigatória.');
                return;
            }
            if (solicitante === '' || solicitante === 'Selecione...') {
                alert('Por favor, selecione um solicitante válido.');
                return;
            }
            if (prioridade === '' || prioridade === 'Selecione...') {
                alert('Por favor, selecione uma prioridade válida.');
                return;
            }
            if (!tipoSelecionado) {
                alert('Por favor, selecione um Tipo de Demanda.');
                return;
            }
            if (data === '') {
                alert('A Data Desejada é obrigatória.');
                return;
            }

            const dataInserida = new Date(data);
            const dataAtual = new Date();
            dataAtual.setHours(0, 0, 0, 0);
            dataInserida.setHours(0, 0, 0, 0);
            dataInserida.setDate(dataInserida.getDate() + 1);

            if (dataInserida < dataAtual) {
                alert('A Data Desejada não pode ser anterior à data de hoje.');
                return;
            }

            // Envia a requisicao para a API no backend Express
            try {
                const resposta = await fetch('http://localhost:3000/demandas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        titulo: titulo,
                        descricao: descricao,
                        tipo: tipoSelecionadoValor,
                        prioridade: prioridade,
                        projetoId: 'PRJ-001',
                        responsavelId: solicitante === 'João Silva' ? 'USR-003' : 'USR-004',
                        prazoFinalizacao: data
                    })
                });

                const dados = await resposta.json();

                // Se o servidor retornou erro (ex: 400 Bad Request)
                if (!resposta.ok) {
                    alert('Erro retornado pelo servidor: ' + (dados.mensagem || 'Dados inválidos.'));
                    return;
                }

                // Salva no LocalStorage para a tela de listagem continuar funcionando
                const demandasSalvas = JSON.parse(localStorage.getItem('demandas')) || [];
                demandasSalvas.push(dados.demanda);
                localStorage.setItem('demandas', JSON.stringify(demandasSalvas));

                alert('Demanda criada com sucesso no servidor! ID: ' + dados.demanda.id);
                window.location.href = 'Front_telademanda.html';

            } catch (erro) {
                // Se o servidor Express nao estiver rodando
                console.warn('Servidor offline, salvando apenas localmente:', erro);

                const dataCriacaoHoje = new Date();
                const novaDemandaLocal = {
                    id: 'DEM-' + String(Math.floor(Math.random() * 900) + 100),
                    titulo: titulo,
                    solicitante: solicitante,
                    prioridade: prioridade,
                    dataDesejada: data,
                    dataCriacao: dataCriacaoHoje.toISOString().split('T')[0],
                    descricao: descricao,
                    tipo: tipoSelecionadoValor,
                    status: 'Aberto'
                };

                const demandasSalvas = JSON.parse(localStorage.getItem('demandas')) || [];
                demandasSalvas.push(novaDemandaLocal);
                localStorage.setItem('demandas', JSON.stringify(demandasSalvas));

                alert('Aviso: Nao foi possivel conectar com a API (localhost:3000). A demanda foi salva localmente no navegador.');
                window.location.href = 'Front_telademanda.html';
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNovaDemandaValidation);
} else {
    initNovaDemandaValidation();
}
