// Autor: Abdallah Ali Borges El Khatib
// Exibicao dos dados do usuario autenticado e projetos vinculados

// Preenche os campos somente leitura e lista projetos retornados por GET /projetos
async function initConfiguracoes() {
    const usuario = verificarAutenticacao();
    if (!usuario) {
        return;
    }

    preencherUsuarioTopbar(usuario);

    document.getElementById('perfilNome').value = usuario.nome || '';
    document.getElementById('perfilEmail').value = usuario.email || '';
    document.getElementById('perfilTipo').value = usuario.perfil || '';

    const tituloProjetos = document.getElementById('tituloProjetosUsuario');
    if (tituloProjetos && usuario.perfil === 'Administrador') {
        tituloProjetos.innerHTML = '<i class="fa-solid fa-folder-open me-2"></i> Projetos Acessíveis (Visão Global de Administrador)';
    }

    const lista = document.getElementById('listaProjetosUsuario');
    if (!lista) {
        return;
    }

    try {
        const { ok, redirecionado, dados } = await apiFetch('/projetos');
        if (redirecionado) {
            return;
        }

        lista.textContent = '';

        if (!ok) {
            const li = document.createElement('li');
            li.className = 'list-group-item text-danger';
            li.textContent = dados.mensagem || 'Não foi possível consultar os projetos no servidor.';
            lista.appendChild(li);
            return;
        }

        if (!dados.projetos || dados.projetos.length === 0) {
            const li = document.createElement('li');
            li.className = 'list-group-item text-muted';
            li.textContent = 'Nenhum projeto vinculado.';
            lista.appendChild(li);
            return;
        }

        dados.projetos.forEach(p => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            const sufixoData = p.dataCriacao ? ` (criado em ${Auth.formatarData(p.dataCriacao)})` : '';
            li.textContent = `${p.nome} - ${p.descricao || 'Sem descrição'}${sufixoData}`;
            lista.appendChild(li);
        });
    } catch {
        lista.textContent = '';
        const li = document.createElement('li');
        li.className = 'list-group-item text-danger';
        li.textContent = 'Não foi possível consultar os projetos no servidor.';
        lista.appendChild(li);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConfiguracoes);
} else {
    initConfiguracoes();
}
