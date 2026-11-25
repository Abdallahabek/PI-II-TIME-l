// Autor: Abdallah Ali Borges El Khatib
// Validacoes de formulario e integracao de cadastro/edicao de demandas com a API

const PERFIS_GESTAO_DEMANDA = ['Administrador', 'Líder de Projeto'];
const LIMITE_TITULO = 200;
const LIMITE_DESCRICAO = 2000;

let sequenciaReqUsuarios = 0;

function exibirErroFormulario(mensagem) {
    const box = document.getElementById('formErro');
    if (box) {
        box.textContent = mensagem;
        box.classList.remove('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        alert(mensagem);
    }
}

function limparErroFormulario() {
    const box = document.getElementById('formErro');
    if (box) {
        box.textContent = '';
        box.classList.add('d-none');
    }
}

// Desabilita ou habilita todos os campos e o botao de envio do formulario
function definirFormularioDesabilitado(form, desabilitar) {
    if (!form) {
        return;
    }
    form.querySelectorAll('input, select, textarea, button').forEach(el => {
        el.disabled = desabilitar;
    });
}

function definirTextoSelectUnico(selectEl, texto) {
    if (!selectEl) {
        return;
    }
    selectEl.textContent = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = texto;
    selectEl.appendChild(opt);
}

function atualizarContadoresCaracteres() {
    const titulo = document.getElementById('titulo');
    const descricao = document.getElementById('descricao');
    const contadorTitulo = document.getElementById('contadorTitulo');
    const contadorDescricao = document.getElementById('contadorDescricao');

    if (titulo && contadorTitulo) {
        contadorTitulo.textContent = `${titulo.value.length}/${LIMITE_TITULO}`;
    }
    if (descricao && contadorDescricao) {
        contadorDescricao.textContent = `${descricao.value.length}/${LIMITE_DESCRICAO}`;
    }
}

async function carregarSelectProjetos(selectProjeto) {
    const { ok, redirecionado, dados } = await apiFetch('/projetos');
    if (redirecionado) {
        return { redirecionado: true };
    }
    if (!ok) {
        throw new Error(dados.mensagem || 'Erro ao carregar projetos.');
    }

    selectProjeto.textContent = '';
    const optPadrao = document.createElement('option');
    optPadrao.value = '';
    optPadrao.textContent = 'Selecione um projeto...';
    selectProjeto.appendChild(optPadrao);

    (dados.projetos || []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = String(p.id);
        opt.textContent = p.nome;
        selectProjeto.appendChild(opt);
    });

    return { redirecionado: false };
}

// Carrega apenas usuarios elegiveis para o projeto selecionado via GET /usuarios?projetoId=
async function carregarSelectUsuariosPorProjeto(selectUsuario, projetoId, responsavelSelecionadoId = null) {
    const numeroReq = ++sequenciaReqUsuarios;

    if (!projetoId) {
        definirTextoSelectUnico(selectUsuario, 'Sem responsável (selecione um projeto)');
        return { redirecionado: false };
    }

    definirTextoSelectUnico(selectUsuario, 'Carregando responsáveis...');

    const { ok, redirecionado, dados } = await apiFetch(`/usuarios?projetoId=${encodeURIComponent(projetoId)}`);
    if (numeroReq !== sequenciaReqUsuarios) {
        return { redirecionado: false };
    }
    if (redirecionado) {
        return { redirecionado: true };
    }
    if (!ok) {
        definirTextoSelectUnico(selectUsuario, 'Sem responsável');
        throw new Error(dados.mensagem || 'Erro ao carregar usuários do projeto.');
    }

    selectUsuario.textContent = '';
    const optVazio = document.createElement('option');
    optVazio.value = '';
    optVazio.textContent = 'Sem responsável';
    selectUsuario.appendChild(optVazio);

    const usuarios = dados.usuarios || [];
    const valorDesejado = responsavelSelecionadoId !== null && responsavelSelecionadoId !== ''
        ? String(responsavelSelecionadoId)
        : '';
    let encontrouDesejado = false;

    usuarios.forEach(u => {
        const opt = document.createElement('option');
        opt.value = String(u.id);
        opt.textContent = `${u.nome} (${u.perfil})`;
        if (valorDesejado && opt.value === valorDesejado) {
            encontrouDesejado = true;
        }
        selectUsuario.appendChild(opt);
    });

    selectUsuario.value = encontrouDesejado ? valorDesejado : '';
    return { redirecionado: false };
}

// Carrega dados da demanda existente quando aberta em modo edicao (?id=)
async function preencherEdicao(demandaId, selectResponsavel) {
    const { ok, redirecionado, dados } = await apiFetch(`/demandas/${demandaId}`);
    if (redirecionado) {
        return { redirecionado: true };
    }
    if (!ok) {
        throw new Error(dados.mensagem || 'Não foi possível carregar os dados da demanda para edição.');
    }

    const demanda = dados.demanda || dados;

    document.getElementById('titulo').value = demanda.titulo || '';
    document.getElementById('descricao').value = demanda.descricao || '';
    document.getElementById('projetoId').value = demanda.projetoId ? String(demanda.projetoId) : '';
    document.getElementById('prioridade').value = demanda.prioridade || '';
    document.getElementById('prazoFinalizacao').value = demanda.prazoFinalizacao || '';

    const radios = document.getElementsByName('tipo');
    for (let i = 0; i < radios.length; i++) {
        radios[i].checked = radios[i].value === demanda.tipo;
    }

    atualizarContadoresCaracteres();

    const respUsuarios = await carregarSelectUsuariosPorProjeto(
        selectResponsavel,
        demanda.projetoId,
        demanda.responsavelId
    );
    if (respUsuarios.redirecionado) {
        return { redirecionado: true };
    }

    return {
        redirecionado: false,
        demanda,
        prazoOriginal: demanda.prazoFinalizacao || ''
    };
}

async function initNovaDemanda() {
    const usuario = verificarAutenticacao();
    if (!usuario) {
        return;
    }

    preencherUsuarioTopbar(usuario);

    const form = document.getElementById('demandaForm');
    const btnSalvar = document.getElementById('btnSalvar');
    const selectProjeto = document.getElementById('projetoId');
    const selectResponsavel = document.getElementById('responsavelId');
    const campoTitulo = document.getElementById('titulo');
    const campoDescricao = document.getElementById('descricao');
    const campoPrazo = document.getElementById('prazoFinalizacao');

    if (campoTitulo) {
        campoTitulo.addEventListener('input', atualizarContadoresCaracteres);
    }
    if (campoDescricao) {
        campoDescricao.addEventListener('input', atualizarContadoresCaracteres);
    }
    atualizarContadoresCaracteres();

    // Bloqueia o formulario completo para perfis sem permissao de gestao
    if (!PERFIS_GESTAO_DEMANDA.includes(usuario.perfil)) {
        definirTextoSelectUnico(selectProjeto, 'Indisponível para seu perfil');
        definirTextoSelectUnico(selectResponsavel, 'Indisponível para seu perfil');
        definirFormularioDesabilitado(form, true);
        exibirErroFormulario('Seu perfil não possui permissão para criar ou editar demandas.');
        return;
    }

    // Valida estritamente o parametro ?id= em modo edicao
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    let idEdicao = null;

    if (idParam !== null) {
        if (!/^\d+$/.test(idParam) || Number(idParam) <= 0) {
            definirTextoSelectUnico(selectProjeto, 'Indisponível');
            definirTextoSelectUnico(selectResponsavel, 'Indisponível');
            definirFormularioDesabilitado(form, true);
            exibirErroFormulario('ID de demanda inválido para edição. Volte para a listagem e tente novamente.');
            return;
        }
        idEdicao = Number(idParam);
        document.getElementById('tituloFormulario').textContent = `Editar Demanda #${idEdicao}`;
        if (btnSalvar) {
            btnSalvar.textContent = 'Salvar Alterações';
        }
    } else if (campoPrazo) {
        campoPrazo.min = Auth.obterDataHojeIso();
    }

    let prazoOriginal = '';

    try {
        const respProjetos = await carregarSelectProjetos(selectProjeto);
        if (respProjetos.redirecionado) {
            return;
        }

        if (idEdicao) {
            const resultadoEdicao = await preencherEdicao(idEdicao, selectResponsavel);
            if (resultadoEdicao.redirecionado) {
                return;
            }
            prazoOriginal = resultadoEdicao.prazoOriginal || '';

            const statusAtual = resultadoEdicao.demanda && resultadoEdicao.demanda.status;
            if (statusAtual === 'Concluída' || statusAtual === 'Cancelada') {
                definirFormularioDesabilitado(form, true);
                exibirErroFormulario(
                    `Esta demanda está com status "${statusAtual}" e não pode mais ser editada.`
                );
                return;
            }
        } else {
            definirTextoSelectUnico(selectResponsavel, 'Sem responsável (selecione um projeto)');
        }
    } catch (erro) {
        if (selectProjeto && selectProjeto.options.length <= 1 && selectProjeto.value === '') {
            definirTextoSelectUnico(selectProjeto, 'Erro ao carregar projetos');
        }
        definirFormularioDesabilitado(form, true);
        exibirErroFormulario(erro.message || 'Erro ao carregar dados iniciais do servidor.');
        return;
    }

    // Atualiza a lista de responsaveis elegiveis sempre que o projeto mudar
    selectProjeto.addEventListener('change', async function () {
        const responsavelAtual = selectResponsavel.value;
        try {
            const resp = await carregarSelectUsuariosPorProjeto(
                selectResponsavel,
                selectProjeto.value,
                responsavelAtual
            );
            if (resp.redirecionado) {
                return;
            }
        } catch (erro) {
            exibirErroFormulario(erro.message || 'Não foi possível carregar os responsáveis do projeto.');
        }
    });

    if (!form) {
        return;
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        limparErroFormulario();

        const titulo = campoTitulo.value.trim();
        const projetoId = selectProjeto.value;
        const responsavelId = selectResponsavel.value;
        const prioridade = document.getElementById('prioridade').value;
        const prazo = campoPrazo.value;
        const descricao = campoDescricao.value.trim();

        const tipoRadios = document.getElementsByName('tipo');
        let tipoSelecionado = '';
        for (let i = 0; i < tipoRadios.length; i++) {
            if (tipoRadios[i].checked) {
                tipoSelecionado = tipoRadios[i].value;
                break;
            }
        }

        if (titulo === '') {
            exibirErroFormulario('O título da demanda é obrigatório.');
            return;
        }
        if (titulo.length > LIMITE_TITULO) {
            exibirErroFormulario(`O título da demanda deve ter no máximo ${LIMITE_TITULO} caracteres.`);
            return;
        }
        if (projetoId === '') {
            exibirErroFormulario('Selecione o projeto vinculado à demanda.');
            return;
        }
        if (tipoSelecionado === '') {
            exibirErroFormulario('Selecione um tipo de demanda.');
            return;
        }
        if (prioridade === '') {
            exibirErroFormulario('Selecione uma prioridade.');
            return;
        }
        if (descricao === '') {
            exibirErroFormulario('A descrição detalhada é obrigatória.');
            return;
        }
        if (descricao.length > LIMITE_DESCRICAO) {
            exibirErroFormulario(`A descrição detalhada deve ter no máximo ${LIMITE_DESCRICAO} caracteres.`);
            return;
        }

        // Em modo edicao, so bloqueia prazo no passado se o usuario alterou a data original
        const prazoAlterado = !idEdicao || prazo !== prazoOriginal;
        if (prazo !== '' && prazoAlterado) {
            const hojeIso = Auth.obterDataHojeIso();
            if (prazo < hojeIso) {
                exibirErroFormulario('O prazo de finalização não pode ser anterior à data de hoje.');
                return;
            }
        }

        if (btnSalvar) {
            btnSalvar.disabled = true;
            btnSalvar.textContent = 'Salvando...';
        }

        const payload = {
            titulo,
            descricao,
            tipo: tipoSelecionado,
            prioridade,
            projetoId: Number(projetoId),
            responsavelId: responsavelId !== '' ? Number(responsavelId) : null,
            prazoFinalizacao: prazo !== '' ? prazo : null
        };

        let formularioBloqueadoPorConflito = false;

        // Envia criacao (POST) ou atualizacao (PUT) conforme o modo da tela
        try {
            const metodo = idEdicao ? 'PUT' : 'POST';
            const endpoint = idEdicao ? `/demandas/${idEdicao}` : '/demandas';

            const { ok, status, redirecionado, dados } = await apiFetch(endpoint, {
                method: metodo,
                body: JSON.stringify(payload)
            });

            if (redirecionado) {
                return;
            }

            if (status === 409) {
                formularioBloqueadoPorConflito = true;
                definirFormularioDesabilitado(form, true);
                exibirErroFormulario(
                    dados.mensagem || 'A demanda foi alterada ou encerrada por outro usuário.'
                );
                return;
            }

            if (!ok) {
                exibirErroFormulario(dados.mensagem || 'Não foi possível salvar a demanda.');
                return;
            }

            const mensagemSucesso =
                dados.mensagem ||
                (idEdicao ? 'Demanda atualizada com sucesso.' : 'Demanda cadastrada com sucesso.');
            sessionStorage.setItem('mensagemSucessoDemanda', mensagemSucesso);

            if (idEdicao) {
                window.location.href = `Tela_detalhes_demanda.html?id=${idEdicao}`;
            } else {
                window.location.href = 'Front_telademanda.html';
            }
        } catch {
            exibirErroFormulario('Não foi possível conectar ao servidor para salvar a demanda.');
        } finally {
            if (btnSalvar && !formularioBloqueadoPorConflito) {
                btnSalvar.disabled = false;
                btnSalvar.textContent = idEdicao ? 'Salvar Alterações' : 'Salvar Demanda';
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNovaDemanda);
} else {
    initNovaDemanda();
}
