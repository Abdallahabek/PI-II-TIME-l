// Autor: Vinicius Morais
// Listagem de demandas integrada a API com filtros combinados, busca e ordenacao

const PERFIS_GESTAO = ['Administrador', 'Líder de Projeto'];

const CORES_STATUS = {
    'Aberta': 'bg-primary',
    'Em andamento': 'bg-warning text-dark',
    'Em revisão': 'bg-info text-dark',
    'Concluída': 'bg-success',
    'Cancelada': 'bg-secondary'
};

const CORES_PRIORIDADE = {
    'Crítica': 'text-danger fw-bold',
    'Alta': 'text-danger',
    'Média': 'text-warning',
    'Baixa': 'text-success'
};

function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatarData(valor) {
    if (!valor) {
        return '-';
    }
    const [ano, mes, dia] = String(valor).slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
}

document.addEventListener('DOMContentLoaded', function () {
    const usuario = verificarAutenticacao();
    if (!usuario) {
        return;
    }
    preencherUsuarioTopbar(usuario);

    const podeGerenciar = PERFIS_GESTAO.includes(usuario.perfil);
    const tabela = document.getElementById('tabelaDemandas');
    const alertaErro = document.getElementById('alertaErro');
    const totalDemandas = document.getElementById('totalDemandas');
    const campoBusca = document.getElementById('searchInput');
    const filtros = {
        status: document.getElementById('filtroStatus'),
        prioridade: document.getElementById('filtroPrioridade'),
        tipo: document.getElementById('filtroTipo'),
        projetoId: document.getElementById('filtroProjeto'),
        responsavelId: document.getElementById('filtroResponsavel')
    };
    const campoOrdenacao = document.getElementById('ordenarPor');
    let temporizadorBusca = null;
    let requisicaoAtual = 0;

    // Exibe o botao de nova demanda apenas para Administrador e Lider de Projeto
    if (podeGerenciar) {
        document.getElementById('btnNovaDemanda').classList.remove('d-none');
    }

    function exibirErro(mensagem) {
        alertaErro.textContent = mensagem;
        alertaErro.classList.remove('d-none');
    }

    function ocultarErro() {
        alertaErro.textContent = '';
        alertaErro.classList.add('d-none');
    }

    function renderizarMensagemTabela(texto) {
        tabela.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-muted py-5">
                    <i class="fa-regular fa-folder-open fs-2 mb-2 text-secondary"></i><br>
                    ${escaparHtml(texto)}
                </td>
            </tr>
        `;
    }

    function renderizarTabela(demandas) {
        tabela.innerHTML = '';
        totalDemandas.textContent = `${demandas.length} demanda(s) encontrada(s).`;

        if (demandas.length === 0) {
            renderizarMensagemTabela('Nenhuma demanda encontrada.');
            return;
        }

        demandas.forEach(demanda => {
            const podeEditar = podeGerenciar && demanda.status !== 'Concluída' && demanda.status !== 'Cancelada';
            const botaoEditar = podeEditar
                ? `<a href="tela_nova_demanda.html?id=${demanda.id}" class="btn btn-sm btn-outline-primary" title="Editar">
                       <i class="fa-solid fa-pen"></i>
                   </a>`
                : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${demanda.id}</td>
                <td>${escaparHtml(demanda.titulo)}</td>
                <td>${escaparHtml(demanda.tipo)}</td>
                <td>${escaparHtml(demanda.projetoNome)}</td>
                <td>${escaparHtml(demanda.responsavelNome || 'Sem responsável')}</td>
                <td><span class="badge ${CORES_STATUS[demanda.status] || 'bg-light text-dark'}">${escaparHtml(demanda.status)}</span></td>
                <td><span class="${CORES_PRIORIDADE[demanda.prioridade] || ''}">${escaparHtml(demanda.prioridade)}</span></td>
                <td>${formatarData(demanda.dataCriacao)}</td>
                <td>${formatarData(demanda.prazoFinalizacao)}</td>
                <td class="text-nowrap">
                    <a href="Tela_detalhes_demanda.html?id=${demanda.id}" class="btn btn-sm btn-outline-secondary me-1" title="Ver Detalhes">
                        <i class="fa-solid fa-eye"></i>
                    </a>
                    ${botaoEditar}
                </td>
            `;
            tabela.appendChild(tr);
        });
    }

    // Monta os parametros de busca, filtros e ordenacao e ignora respostas fora de ordem
    function montarQueryString() {
        const params = new URLSearchParams();
        const busca = campoBusca.value.trim();
        if (busca) {
            params.set('busca', busca);
        }
        Object.entries(filtros).forEach(([chave, campo]) => {
            if (campo.value) {
                params.set(chave, campo.value);
            }
        });
        params.set('ordenarPor', campoOrdenacao.value);
        return params.toString();
    }

    async function carregarDemandas() {
        const numeroRequisicao = ++requisicaoAtual;
        ocultarErro();
        renderizarMensagemTabela('Carregando demandas...');
        totalDemandas.textContent = '';

        try {
            const { ok, dados } = await apiFetch(`/demandas?${montarQueryString()}`);
            if (numeroRequisicao !== requisicaoAtual) {
                return;
            }
            if (!ok) {
                renderizarMensagemTabela('Não foi possível carregar as demandas.');
                exibirErro(dados.mensagem || 'Erro ao carregar demandas.');
                return;
            }
            renderizarTabela(dados.demandas || []);
        } catch (erro) {
            if (numeroRequisicao !== requisicaoAtual) {
                return;
            }
            renderizarMensagemTabela('Não foi possível carregar as demandas.');
            exibirErro(erro.message || 'Não foi possível conectar ao servidor.');
        }
    }

    function preencherSelect(select, itens) {
        itens.forEach(item => {
            const opcao = document.createElement('option');
            opcao.value = String(item.id);
            opcao.textContent = item.nome;
            select.appendChild(opcao);
        });
    }

    // Carrega listas de projetos e usuarios para popular os filtros dinamicamente
    async function carregarOpcoesFiltros() {
        try {
            const [respProjetos, respUsuarios] = await Promise.all([
                apiFetch('/projetos'),
                apiFetch('/usuarios')
            ]);
            if (respProjetos.ok) {
                preencherSelect(filtros.projetoId, respProjetos.dados.projetos || []);
            }
            if (respUsuarios.ok) {
                preencherSelect(filtros.responsavelId, respUsuarios.dados.usuarios || []);
            }
            if (!respProjetos.ok || !respUsuarios.ok) {
                exibirErro('Não foi possível carregar todas as opções de filtro.');
            }
        } catch (erro) {
            exibirErro(erro.message || 'Não foi possível carregar as opções de filtro.');
        }
    }

    campoBusca.addEventListener('input', function () {
        clearTimeout(temporizadorBusca);
        temporizadorBusca = setTimeout(carregarDemandas, 400);
    });

    Object.values(filtros).forEach(campo => campo.addEventListener('change', carregarDemandas));
    campoOrdenacao.addEventListener('change', carregarDemandas);

    document.getElementById('btnLimparFiltros').addEventListener('click', function () {
        campoBusca.value = '';
        Object.values(filtros).forEach(campo => {
            campo.value = '';
        });
        campoOrdenacao.value = 'dataCriacao';
        carregarDemandas();
    });

    carregarOpcoesFiltros();
    carregarDemandas();
});
