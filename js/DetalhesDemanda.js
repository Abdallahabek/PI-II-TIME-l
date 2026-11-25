// Autor: Vinicius Morais
// Tela de detalhes, ciclo de vida, cancelamento, comentarios e historico de alteracoes

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
    projeto: 'Projeto',
    projetoId: 'Projeto',
    responsavel: 'Responsável',
    prioridade: 'Prioridade',
    prazoFinalizacao: 'Prazo de finalização'
};

const TAMANHO_MAXIMO_COMENTARIO = 1000;

function formatarValorHistorico(campo, valor) {
    if (!valor) {
        return '-';
    }
    if (campo === 'prazoFinalizacao' && /^\d{4}-\d{2}-\d{2}/.test(String(valor))) {
        return Auth.formatarData(valor);
    }
    return valor;
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
    const estadoCarregando = document.getElementById('estadoCarregando');
    const cardDetalhes = document.getElementById('cardDetalhes');
    const containerAcoes = document.getElementById('acoes-status');
    const listaComentarios = document.getElementById('listaComentarios');
    const avisoComentariosBloqueados = document.getElementById('avisoComentariosBloqueados');
    const tabelaHistorico = document.getElementById('detalhe-historico');
    const formComentario = document.getElementById('formComentario');
    const campoComentario = document.getElementById('textoComentario');
    const erroComentario = document.getElementById('erroComentario');
    const contadorComentario = document.getElementById('contadorComentario');
    const btnEnviarComentario = document.getElementById('btnEnviarComentario');

    const idUrl = new URLSearchParams(window.location.search).get('id');
    let demanda = null;

    function ocultarCarregando() {
        if (estadoCarregando) {
            estadoCarregando.classList.add('d-none');
        }
    }

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

    function exibirErroListaComentarios(mensagem) {
        listaComentarios.textContent = '';
        const alerta = document.createElement('div');
        alerta.className = 'alert alert-danger py-2 px-3 small mb-0';
        alerta.setAttribute('role', 'alert');
        alerta.textContent = mensagem;
        listaComentarios.appendChild(alerta);
    }

    function demandaFinalizada() {
        return Boolean(demanda && (demanda.status === 'Concluída' || demanda.status === 'Cancelada'));
    }

    // Oculta e desabilita o formulario de comentarios quando a demanda estiver encerrada
    function atualizarEstadoComentarios() {
        const finalizada = demandaFinalizada();
        if (finalizada) {
            formComentario.classList.add('d-none');
            campoComentario.disabled = true;
            btnEnviarComentario.disabled = true;
            if (avisoComentariosBloqueados) {
                avisoComentariosBloqueados.classList.remove('d-none');
            }
        } else {
            formComentario.classList.remove('d-none');
            campoComentario.disabled = false;
            btnEnviarComentario.disabled = false;
            if (avisoComentariosBloqueados) {
                avisoComentariosBloqueados.classList.add('d-none');
            }
        }
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

        document.getElementById('detalhe-criacao').textContent = Auth.formatarDataHora(demanda.dataCriacao);
        document.getElementById('detalhe-atualizacao').textContent = Auth.formatarDataHora(demanda.dataAtualizacao);
        document.getElementById('detalhe-prazo').textContent = demanda.prazoFinalizacao
            ? Auth.formatarData(demanda.prazoFinalizacao)
            : 'Sem prazo definido';
        document.getElementById('detalhe-responsavel').textContent = demanda.responsavelNome || 'Sem responsável';
        document.getElementById('detalhe-descricao').textContent = demanda.descricao;

        renderizarBotoes();
        atualizarEstadoComentarios();
        ocultarCarregando();
        cardDetalhes.classList.remove('d-none');
    }

    // Define quais transicoes de status aparecem conforme perfil, vinculo e status atual
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
        const finalizada = demandaFinalizada();

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
            linkEditar.href = `tela_nova_demanda.html?id=${encodeURIComponent(demanda.id)}`;
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

    function definirAcoesCarregando(carregando) {
        containerAcoes.querySelectorAll('button').forEach(botao => {
            botao.disabled = carregando;
        });
        containerAcoes.querySelectorAll('a').forEach(link => {
            link.classList.toggle('disabled', carregando);
            link.setAttribute('aria-disabled', carregando ? 'true' : 'false');
        });
    }

    // Executa mudanca de status via PATCH e recarrega detalhes automaticamente em caso de 409
    async function alterarStatus(novoStatus) {
        if (!confirm(`Alterar o status de "${demanda.status}" para "${novoStatus}"?`)) {
            return;
        }
        definirAcoesCarregando(true);
        try {
            const { ok, status, redirecionado, dados } = await apiFetch(`/demandas/${demanda.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: novoStatus })
            });
            if (redirecionado) {
                return;
            }
            if (status === 409) {
                exibirErro(mensagemErroApi(status, dados, 'A demanda foi alterada por outro usuário.'));
                await carregarDemanda({ preservarAlerta: true });
                return;
            }
            if (!ok) {
                exibirErro(mensagemErroApi(status, dados, 'Não foi possível alterar o status.'));
                definirAcoesCarregando(false);
                return;
            }
            demanda = dados.demanda;
            renderizarDetalhes();
            exibirSucesso(dados.mensagem || 'Status alterado com sucesso.');
            await carregarHistorico();
        } catch (erro) {
            exibirErro(erro.message || 'Não foi possível conectar ao servidor.');
            definirAcoesCarregando(false);
        }
    }

    async function cancelarDemanda() {
        if (!confirm('Tem certeza que deseja cancelar esta demanda? Esta ação não poderá ser desfeita.')) {
            return;
        }
        definirAcoesCarregando(true);
        try {
            const { ok, status, redirecionado, dados } = await apiFetch(`/demandas/${demanda.id}/cancelar`, {
                method: 'PATCH'
            });
            if (redirecionado) {
                return;
            }
            if (status === 409) {
                exibirErro(mensagemErroApi(status, dados, 'A demanda foi alterada por outro usuário.'));
                await carregarDemanda({ preservarAlerta: true });
                return;
            }
            if (!ok) {
                exibirErro(mensagemErroApi(status, dados, 'Não foi possível cancelar a demanda.'));
                definirAcoesCarregando(false);
                return;
            }
            demanda = dados.demanda;
            renderizarDetalhes();
            exibirSucesso(dados.mensagem || 'Demanda cancelada com sucesso.');
            await carregarHistorico();
        } catch (erro) {
            exibirErro(erro.message || 'Não foi possível conectar ao servidor.');
            definirAcoesCarregando(false);
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
            data.textContent = Auth.formatarDataHora(comentario.dataCriacao);
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
            const { ok, status, redirecionado, dados } = await apiFetch(`/demandas/${demanda.id}/comentarios`);
            if (redirecionado) {
                return;
            }
            if (!ok) {
                exibirErroListaComentarios(mensagemErroApi(status, dados, 'Não foi possível carregar os comentários.'));
                return;
            }
            renderizarComentarios(dados.comentarios || []);
        } catch (erro) {
            exibirErroListaComentarios(erro.message || 'Não foi possível carregar os comentários.');
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
                criarCelula(Auth.formatarDataHora(registro.dataAlteracao)),
                criarCelula(registro.usuarioNome),
                criarCelula(NOMES_CAMPOS[registro.campoAlterado] || registro.campoAlterado),
                criarCelula(formatarValorHistorico(registro.campoAlterado, registro.valorAnterior)),
                criarCelula(formatarValorHistorico(registro.campoAlterado, registro.valorNovo)),
                criarCelula(registro.descricao)
            );
            tabelaHistorico.appendChild(tr);
        });
    }

    async function carregarHistorico() {
        try {
            const { ok, status, redirecionado, dados } = await apiFetch(`/demandas/${demanda.id}/historico`);
            if (redirecionado) {
                return;
            }
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

    // Valida e envia novos comentarios para a demanda usando POST /demandas/:id/comentarios
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
        if (!demanda || demandaFinalizada()) {
            return;
        }
        if (!validarComentario()) {
            return;
        }
        btnEnviarComentario.disabled = true;
        campoComentario.disabled = true;
        try {
            const { ok, status, redirecionado, dados } = await apiFetch(`/demandas/${demanda.id}/comentarios`, {
                method: 'POST',
                body: JSON.stringify({ texto: campoComentario.value.trim() })
            });
            if (redirecionado) {
                return;
            }
            if (status === 409) {
                exibirErro(mensagemErroApi(status, dados, 'A demanda foi alterada por outro usuário.'));
                await carregarDemanda({ preservarAlerta: true });
                return;
            }
            if (!ok) {
                const msg = mensagemErroApi(status, dados, 'Não foi possível enviar o comentário.');
                erroComentario.textContent = msg;
                campoComentario.classList.add('is-invalid');
                if (status === 400) {
                    await carregarDemanda({ preservarAlerta: true });
                    if (demandaFinalizada()) {
                        exibirErro(msg);
                    }
                }
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
            if (!demandaFinalizada()) {
                btnEnviarComentario.disabled = false;
                campoComentario.disabled = false;
            }
        }
    });

    async function carregarDemanda({ preservarAlerta = false } = {}) {
        if (!idUrl || !/^\d+$/.test(idUrl) || Number(idUrl) <= 0) {
            ocultarCarregando();
            exibirErro('Nenhuma demanda válida foi selecionada. Volte para a listagem e escolha uma demanda.');
            return;
        }

        try {
            const { ok, status, redirecionado, dados } = await apiFetch(`/demandas/${idUrl}`);
            if (redirecionado) {
                return;
            }
            if (!ok) {
                ocultarCarregando();
                exibirErro(mensagemErroApi(status, dados, 'Não foi possível carregar a demanda.'));
                return;
            }
            if (!preservarAlerta) {
                ocultarAlertas();
            }
            demanda = dados.demanda;
            renderizarDetalhes();

            const msgSucesso = sessionStorage.getItem('mensagemSucessoDemanda');
            if (msgSucesso) {
                exibirSucesso(msgSucesso);
                sessionStorage.removeItem('mensagemSucessoDemanda');
            }

            await Promise.all([carregarComentarios(), carregarHistorico()]);
        } catch (erro) {
            ocultarCarregando();
            exibirErro(erro.message || 'Não foi possível conectar ao servidor.');
        }
    }

    carregarDemanda();
});
