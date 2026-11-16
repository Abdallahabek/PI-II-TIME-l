// Autor: Vinicius Morais

const PERFIS_GESTAO = ['Administrador', 'Líder de Projeto'];

const TRANSICOES_GESTAO = {
    'Aberta': ['Em andamento'],
    'Em andamento': ['Em revisão'],
    'Em revisão': ['Concluída', 'Em andamento'],
    'Concluída': [],
    'Cancelada': []
};

const TRANSICOES_MEMBRO = {
    'Aberta': ['Em andamento'],
    'Em andamento': ['Em revisão']
};

const BOTOES_TRANSICAO = {
    'Aberta>Em andamento': { texto: 'Iniciar desenvolvimento', icone: 'fa-play', classe: 'btn-primary' },
    'Em andamento>Em revisão': { texto: 'Enviar para revisão', icone: 'fa-magnifying-glass', classe: 'btn-info' },
    'Em revisão>Concluída': { texto: 'Concluir demanda', icone: 'fa-check', classe: 'btn-success' },
    'Em revisão>Em andamento': { texto: 'Devolver para andamento', icone: 'fa-rotate-left', classe: 'btn-warning' }
};

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

const NOMES_CAMPOS = {
    status: 'Status',
    responsavel: 'Responsável',
    prioridade: 'Prioridade',
    prazoFinalizacao: 'Prazo de finalização'
};

const TAMANHO_MAXIMO_COMENTARIO = 1000;

function formatarData(valor) {
    if (!valor) {
        return '-';
    }
    const [ano, mes, dia] = String(valor).slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(valor) {
    if (!valor) {
        return '-';
    }
    const texto = String(valor);
    const hora = texto.length >= 16 ? texto.slice(11, 16) : '';
    return hora ? `${formatarData(texto)} ${hora}` : formatarData(texto);
}

function criarCelula(texto) {
    const td = document.createElement('td');
    td.textContent = texto ?? '-';
    return td;
}

document.addEventListener('DOMContentLoaded', function () {
    const usuario = verificarAutenticacao();
    if (!usuario) {
        return;
    }
    preencherUsuarioTopbar(usuario);

    const alertaErro = document.getElementById('alertaErro');
    const alertaSucesso = document.getElementById('alertaSucesso');
    const cardDetalhes = document.getElementById('cardDetalhes');
    const containerAcoes = document.getElementById('acoes-status');
    const listaComentarios = document.getElementById('listaComentarios');
    const tabelaHistorico = document.getElementById('detalhe-historico');
    const formComentario = document.getElementById('formComentario');
    const campoComentario = document.getElementById('textoComentario');
    const erroComentario = document.getElementById('erroComentario');
    const contadorComentario = document.getElementById('contadorComentario');
    const btnEnviarComentario = document.getElementById('btnEnviarComentario');

    const idUrl = new URLSearchParams(window.location.search).get('id');
    let demanda = null;

    function exibirErro(mensagem) {
        alertaSucesso.classList.add('d-none');
        alertaErro.textContent = mensagem;
        alertaErro.classList.remove('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function exibirSucesso(mensagem) {
        alertaErro.classList.add('d-none');
        alertaSucesso.textContent = mensagem;
        alertaSucesso.classList.remove('d-none');
    }

    function ocultarAlertas() {
        alertaErro.classList.add('d-none');
        alertaSucesso.classList.add('d-none');
    }

    function mensagemErroApi(status, dados, padrao) {
        const mensagem = dados && dados.mensagem ? dados.mensagem : padrao;
        return status ? `Erro ${status}: ${mensagem}` : mensagem;
    }

    function renderizarDetalhes() {
        document.getElementById('detalhe-titulo').textContent = `#${demanda.id} - ${demanda.titulo}`;
        document.getElementById('detalhe-projeto').textContent = demanda.projetoNome || '-';
        document.getElementById('detalhe-tipo').textContent = demanda.tipo;

        const elPrioridade = document.getElementById('detalhe-prioridade');
        elPrioridade.textContent = demanda.prioridade;
        elPrioridade.className = CORES_PRIORIDADE[demanda.prioridade] || 'text-dark';

        const elStatus = document.getElementById('detalhe-status');
        elStatus.textContent = demanda.status;
        elStatus.className = `badge ${CORES_STATUS[demanda.status] || 'bg-light text-dark'}`;

        document.getElementById('detalhe-criacao').textContent = formatarDataHora(demanda.dataCriacao);
        document.getElementById('detalhe-atualizacao').textContent = formatarDataHora(demanda.dataAtualizacao);
        document.getElementById('detalhe-prazo').textContent = demanda.prazoFinalizacao ? formatarData(demanda.prazoFinalizacao) : 'Sem prazo definido';
        document.getElementById('detalhe-responsavel').textContent = demanda.responsavelNome || 'Sem responsável';
        document.getElementById('detalhe-descricao').textContent = demanda.descricao;

        renderizarBotoes();
        cardDetalhes.classList.remove('d-none');
    }

    function transicoesDisponiveis() {
        if (PERFIS_GESTAO.includes(usuario.perfil)) {
            return TRANSICOES_GESTAO[demanda.status] || [];
        }
        if (usuario.perfil === 'Membro da Equipe' && demanda.responsavelId === usuario.id) {
            return TRANSICOES_MEMBRO[demanda.status] || [];
        }
        return [];
    }

    function criarBotao(texto, icone, classe, aoClicar) {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = `btn btn-sm ${classe}`;
        botao.innerHTML = `<i class="fa-solid ${icone}"></i> `;
        botao.appendChild(document.createTextNode(texto));
        botao.addEventListener('click', aoClicar);
        return botao;
    }

    function renderizarBotoes() {
        containerAcoes.innerHTML = '';
        const finalizada = demanda.status === 'Concluída' || demanda.status === 'Cancelada';

        transicoesDisponiveis().forEach(novoStatus => {
            const config = BOTOES_TRANSICAO[`${demanda.status}>${novoStatus}`];
            if (!config) {
                return;
            }
            containerAcoes.appendChild(
                criarBotao(config.texto, config.icone, config.classe, () => alterarStatus(novoStatus))
            );
        });

        if (PERFIS_GESTAO.includes(usuario.perfil) && !finalizada) {
            const linkEditar = document.createElement('a');
            linkEditar.href = `tela_nova_demanda.html?id=${demanda.id}`;
            linkEditar.className = 'btn btn-sm btn-outline-primary';
            linkEditar.innerHTML = '<i class="fa-solid fa-pen"></i> Editar';
            containerAcoes.appendChild(linkEditar);

            containerAcoes.appendChild(
                criarBotao('Cancelar demanda', 'fa-ban', 'btn-outline-danger', cancelarDemanda)
            );
        }

        if (finalizada) {
            const selo = document.createElement('span');
            selo.className = `badge fs-6 ${CORES_STATUS[demanda.status]}`;
            selo.textContent = `Demanda ${demanda.status}`;
            containerAcoes.appendChild(selo);
        }
    }

    function definirBotoesDesabilitados(desabilitar) {
        containerAcoes.querySelectorAll('button').forEach(botao => {
            botao.disabled = desabilitar;
        });
    }

    async function alterarStatus(novoStatus) {
        if (!confirm(`Alterar o status de "${demanda.status}" para "${novoStatus}"?`)) {
            return;
        }
        definirBotoesDesabilitados(true);
        try {
            const { ok, status, dados } = await apiFetch(`/demandas/${demanda.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: novoStatus })
            });
            if (!ok) {
                exibirErro(mensagemErroApi(status, dados, 'Não foi possível alterar o status.'));
                definirBotoesDesabilitados(false);
                return;
            }
            demanda = dados.demanda;
            renderizarDetalhes();
            exibirSucesso(dados.mensagem || 'Status alterado com sucesso.');
            carregarHistorico();
        } catch (erro) {
            exibirErro(erro.message || 'Não foi possível conectar ao servidor.');
            definirBotoesDesabilitados(false);
        }
    }

    async function cancelarDemanda() {
        if (!confirm('Tem certeza que deseja cancelar esta demanda? Esta ação não poderá ser desfeita.')) {
            return;
        }
        definirBotoesDesabilitados(true);
        try {
            const { ok, status, dados } = await apiFetch(`/demandas/${demanda.id}/cancelar`, {
                method: 'PATCH'
            });
            if (!ok) {
                exibirErro(mensagemErroApi(status, dados, 'Não foi possível cancelar a demanda.'));
                definirBotoesDesabilitados(false);
                return;
            }
            demanda = dados.demanda;
            renderizarDetalhes();
            exibirSucesso(dados.mensagem || 'Demanda cancelada com sucesso.');
            carregarHistorico();
        } catch (erro) {
            exibirErro(erro.message || 'Não foi possível conectar ao servidor.');
            definirBotoesDesabilitados(false);
        }
    }

    function renderizarComentarios(comentarios) {
        listaComentarios.innerHTML = '';
        if (comentarios.length === 0) {
            const vazio = document.createElement('p');
            vazio.className = 'text-muted small mb-0';
            vazio.textContent = 'Nenhum comentário registrado.';
            listaComentarios.appendChild(vazio);
            return;
        }

        comentarios.forEach(comentario => {
            const item = document.createElement('div');
            item.className = 'd-flex mb-3';

            const icone = document.createElement('div');
            icone.className = 'me-2';
            icone.innerHTML = '<i class="fa-solid fa-circle-user text-secondary fs-3"></i>';

            const conteudo = document.createElement('div');
            const autor = document.createElement('strong');
            autor.textContent = comentario.usuarioNome;
            const data = document.createElement('small');
            data.className = 'text-muted ms-2';
            data.textContent = formatarDataHora(comentario.dataCriacao);
            const texto = document.createElement('div');
            texto.className = 'text-muted descricao-texto';
            texto.style.fontSize = '0.9rem';
            texto.textContent = comentario.texto;

            conteudo.append(autor, data, texto);
            item.append(icone, conteudo);
            listaComentarios.appendChild(item);
        });
        listaComentarios.scrollTop = listaComentarios.scrollHeight;
    }

    async function carregarComentarios() {
        try {
            const { ok, status, dados } = await apiFetch(`/demandas/${demanda.id}/comentarios`);
            if (!ok) {
                listaComentarios.textContent = mensagemErroApi(status, dados, 'Não foi possível carregar os comentários.');
                return;
            }
            renderizarComentarios(dados.comentarios || []);
        } catch (erro) {
            listaComentarios.textContent = erro.message || 'Não foi possível carregar os comentários.';
        }
    }

    function renderizarHistorico(registros) {
        tabelaHistorico.innerHTML = '';
        if (registros.length === 0) {
            const tr = document.createElement('tr');
            const td = criarCelula('Nenhuma alteração registrada.');
            td.colSpan = 6;
            td.className = 'text-center text-muted';
            tr.appendChild(td);
            tabelaHistorico.appendChild(tr);
            return;
        }

        registros.forEach(registro => {
            const tr = document.createElement('tr');
            tr.append(
                criarCelula(formatarDataHora(registro.dataAlteracao)),
                criarCelula(registro.usuarioNome),
                criarCelula(NOMES_CAMPOS[registro.campoAlterado] || registro.campoAlterado),
                criarCelula(registro.valorAnterior || '-'),
                criarCelula(registro.valorNovo),
                criarCelula(registro.descricao)
            );
            tabelaHistorico.appendChild(tr);
        });
    }

    async function carregarHistorico() {
        try {
            const { ok, status, dados } = await apiFetch(`/demandas/${demanda.id}/historico`);
            if (!ok) {
                tabelaHistorico.innerHTML = '';
                const tr = document.createElement('tr');
                const td = criarCelula(mensagemErroApi(status, dados, 'Não foi possível carregar o histórico.'));
                td.colSpan = 6;
                td.className = 'text-danger';
                tr.appendChild(td);
                tabelaHistorico.appendChild(tr);
                return;
            }
            renderizarHistorico(dados.historico || []);
        } catch (erro) {
            exibirErro(erro.message || 'Não foi possível carregar o histórico.');
        }
    }

    function validarComentario() {
        const texto = campoComentario.value.trim();
        let mensagem = '';
        if (texto === '') {
            mensagem = 'O comentário não pode ficar vazio.';
        } else if (texto.length > TAMANHO_MAXIMO_COMENTARIO) {
            mensagem = `O comentário pode ter no máximo ${TAMANHO_MAXIMO_COMENTARIO} caracteres.`;
        }
        erroComentario.textContent = mensagem;
        campoComentario.classList.toggle('is-invalid', mensagem !== '');
        return mensagem === '';
    }

    campoComentario.addEventListener('input', function () {
        contadorComentario.textContent = `${campoComentario.value.length}/${TAMANHO_MAXIMO_COMENTARIO}`;
        if (campoComentario.classList.contains('is-invalid')) {
            validarComentario();
        }
    });

    formComentario.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        if (!validarComentario()) {
            return;
        }
        btnEnviarComentario.disabled = true;
        try {
            const { ok, status, dados } = await apiFetch(`/demandas/${demanda.id}/comentarios`, {
                method: 'POST',
                body: JSON.stringify({ texto: campoComentario.value.trim() })
            });
            if (!ok) {
                erroComentario.textContent = mensagemErroApi(status, dados, 'Não foi possível enviar o comentário.');
                campoComentario.classList.add('is-invalid');
                return;
            }
            campoComentario.value = '';
            contadorComentario.textContent = `0/${TAMANHO_MAXIMO_COMENTARIO}`;
            campoComentario.classList.remove('is-invalid');
            await carregarComentarios();
        } catch (erro) {
            erroComentario.textContent = erro.message || 'Não foi possível conectar ao servidor.';
            campoComentario.classList.add('is-invalid');
        } finally {
            btnEnviarComentario.disabled = false;
        }
    });

    async function iniciar() {
        if (!idUrl || !/^\d+$/.test(idUrl)) {
            exibirErro('Nenhuma demanda válida foi selecionada. Volte para a listagem e escolha uma demanda.');
            return;
        }

        try {
            const { ok, status, dados } = await apiFetch(`/demandas/${idUrl}`);
            if (!ok) {
                exibirErro(mensagemErroApi(status, dados, 'Não foi possível carregar a demanda.'));
                return;
            }
            ocultarAlertas();
            demanda = dados.demanda;
            renderizarDetalhes();
            carregarComentarios();
            carregarHistorico();
        } catch (erro) {
            exibirErro(erro.message || 'Não foi possível conectar ao servidor.');
        }
    }

    iniciar();
});
