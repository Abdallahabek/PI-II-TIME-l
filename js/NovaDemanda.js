// Feito por Enrico Pacheco Del Manto

function initNovaDemandaValidation() {
    const form = document.querySelector('form');

    if (form) {
        form.addEventListener('submit', function (event) {
            // Impedir envio padrão para validação
            event.preventDefault();

            // Obter campos
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

            // Verificar tipo de demanda selecionado
            let tipoSelecionado = false;
            for (let i = 0; i < tipoRadios.length; i++) {
                if (tipoRadios[i].checked) {
                    tipoSelecionado = true;
                    break;
                }
            }

            // 1. Validar Título e Descrição (obrigatórios)
            if (titulo === '') {
                alert('O Título da demanda é obrigatório.');
                return;
            }
            if (descricao === '') {
                alert('A Descrição detalhada é obrigatória.');
                return;
            }

            // 2. Validar Seleções obrigatórias (Solicitante e Prioridade)
            if (solicitante === '' || solicitante === 'Selecione...') {
                alert('Por favor, selecione um solicitante válido.');
                return;
            }
            if (prioridade === '' || prioridade === 'Selecione...') {
                alert('Por favor, selecione uma prioridade válida.');
                return;
            }

            // 3. Validar se o tipo de demanda foi selecionado
            if (!tipoSelecionado) {
                alert('Por favor, selecione um Tipo de Demanda.');
                return;
            }

            // 4. Validar formato e consistência da data
            if (data === '') {
                alert('A Data Desejada é obrigatória.');
                return;
            }

            const dataInserida = new Date(data);
            const dataAtual = new Date();
            // Zerar as horas para comparar apenas os dias
            dataAtual.setHours(0, 0, 0, 0);
            dataInserida.setHours(0, 0, 0, 0);
            // Ajustar fuso horário para a data do input type="date"
            dataInserida.setDate(dataInserida.getDate() + 1);

            if (dataInserida < dataAtual) {
                alert('A Data Desejada não pode ser anterior à data de hoje.');
                return;
            }

            // Se passar por todas as validações
            let tipoSelecionadoValor = '';
            for (let i = 0; i < tipoRadios.length; i++) {
                if (tipoRadios[i].checked) tipoSelecionadoValor = tipoRadios[i].value;
            }

            const dataCriacaoHoje = new Date();

            const novaDemanda = {
                id: 'DEM-' + String(Math.floor(Math.random() * 900) + 100), // Gera ID aleatório tipo DEM-123
                titulo: titulo,
                solicitante: solicitante,
                prioridade: prioridade,
                dataDesejada: data,
                dataCriacao: dataCriacaoHoje.toISOString().split('T')[0],
                descricao: descricao,
                tipo: tipoSelecionadoValor,
                status: 'Aberto'
            };

            // Salvar no LocalStorage
            const demandasSalvas = JSON.parse(localStorage.getItem('demandas')) || [];
            demandasSalvas.push(novaDemanda);
            localStorage.setItem('demandas', JSON.stringify(demandasSalvas));

            alert('Demanda criada com sucesso!');
            window.location.href = 'Front_telademanda.html';
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNovaDemandaValidation);
} else {
    initNovaDemandaValidation();
}
