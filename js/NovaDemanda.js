// Autor: Abdallah Ali Borges El Khatib
// Validacoes de formulario e integracao de cadastro/edicao de demandas com a API

function exibirErroFormulario(mensagem) {
    const box = document.getElementById('formErro');
    if (box) {
        box.textContent = mensagem;
        box.classList.remove('d-none');
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

async function carregarSelectProjetos(selectProjeto) {
    const { ok, dados } = await apiFetch('/projetos');
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
}

async function carregarSelectUsuarios(selectUsuario) {
    const { ok, dados } = await apiFetch('/usuarios');
    if (!ok) {
        throw new Error(dados.mensagem || 'Erro ao carregar usuarios.');
    }

    selectUsuario.textContent = '';
    const optVazio = document.createElement('option');
    optVazio.value = '';
    optVazio.textContent = 'Sem responsavel';
    selectUsuario.appendChild(optVazio);

    (dados.usuarios || []).forEach(u => {
        const opt = document.createElement('option');
        opt.value = String(u.id);
        opt.textContent = `${u.nome} (${u.perfil})`;
        selectUsuario.appendChild(opt);
    });
}

async function preencherEdicao(demandaId) {
    const { ok, dados } = await apiFetch(`/demandas/${demandaId}`);
    if (!ok) {
        throw new Error(dados.mensagem || 'Nao foi possivel carregar os dados da demanda para edicao.');
    }

    const demanda = dados.demanda || dados;

    document.getElementById('titulo').value = demanda.titulo || '';
    document.getElementById('descricao').value = demanda.descricao || '';
    document.getElementById('projetoId').value = demanda.projetoId ? String(demanda.projetoId) : '';
    document.getElementById('responsavelId').value = demanda.responsavelId ? String(demanda.responsavelId) : '';
    document.getElementById('prioridade').value = demanda.prioridade || '';
    document.getElementById('prazoFinalizacao').value = demanda.prazoFinalizacao || '';

    const radios = document.getElementsByName('tipo');
    for (let i = 0; i < radios.length; i++) {
        radios[i].checked = radios[i].value === demanda.tipo;
    }
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

    if (usuario.perfil === 'Membro da Equipe') {
        exibirErroFormulario('Membros da equipe nao possuem permissao para criar ou editar demandas.');
        if (btnSalvar) {
            btnSalvar.disabled = true;
        }
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const idEdicao = params.get('id');

    if (idEdicao) {
        document.getElementById('tituloFormulario').textContent = `Editar Demanda #${idEdicao}`;
        if (btnSalvar) {
            btnSalvar.textContent = 'Salvar Alteracoes';
        }
    }

    try {
        await Promise.all([
            carregarSelectProjetos(selectProjeto),
            carregarSelectUsuarios(selectResponsavel)
        ]);

        if (idEdicao) {
            await preencherEdicao(idEdicao);
        }
    } catch (erro) {
        exibirErroFormulario(erro.message || 'Erro ao carregar dados iniciais do servidor.');
    }

    if (!form) {
        return;
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        limparErroFormulario();

        const titulo = document.getElementById('titulo').value.trim();
        const projetoId = selectProjeto.value;
        const responsavelId = selectResponsavel.value;
        const prioridade = document.getElementById('prioridade').value;
        const prazo = document.getElementById('prazoFinalizacao').value;
        const descricao = document.getElementById('descricao').value.trim();

        const tipoRadios = document.getElementsByName('tipo');
        let tipoSelecionado = '';
        for (let i = 0; i < tipoRadios.length; i++) {
            if (tipoRadios[i].checked) {
                tipoSelecionado = tipoRadios[i].value;
                break;
            }
        }

        if (titulo === '') {
            exibirErroFormulario('O titulo da demanda e obrigatorio.');
            return;
        }
        if (projetoId === '') {
            exibirErroFormulario('Selecione o projeto vinculado a demanda.');
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
            exibirErroFormulario('A descricao detalhada e obrigatoria.');
            return;
        }

        if (prazo !== '' && !idEdicao) {
            const hoje = new Date();
            const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
            if (prazo < hojeIso) {
                exibirErroFormulario('O prazo de finalizacao nao pode ser anterior a data de hoje.');
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

        try {
            const metodo = idEdicao ? 'PUT' : 'POST';
            const endpoint = idEdicao ? `/demandas/${idEdicao}` : '/demandas';

            const { ok, dados } = await apiFetch(endpoint, {
                method: metodo,
                body: JSON.stringify(payload)
            });

            if (!ok) {
                exibirErroFormulario(dados.mensagem || 'Nao foi possivel salvar a demanda.');
                return;
            }

            window.location.href = 'Front_telademanda.html';
        } catch {
            exibirErroFormulario('Nao foi possivel conectar ao servidor para salvar a demanda.');
        } finally {
            if (btnSalvar) {
                btnSalvar.disabled = false;
                btnSalvar.textContent = idEdicao ? 'Salvar Alteracoes' : 'Salvar Demanda';
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNovaDemanda);
} else {
    initNovaDemanda();
}
