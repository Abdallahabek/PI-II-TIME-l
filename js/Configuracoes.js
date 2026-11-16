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

    const lista = document.getElementById('listaProjetosUsuario');
    if (!lista) {
        return;
    }

    try {
        const { ok, dados } = await apiFetch('/projetos');
        lista.textContent = '';

        if (!ok || !dados.projetos || dados.projetos.length === 0) {
            const li = document.createElement('li');
            li.className = 'list-group-item text-muted';
            li.textContent = dados.mensagem || 'Nenhum projeto vinculado.';
            lista.appendChild(li);
            return;
        }

        dados.projetos.forEach(p => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.textContent = `${p.nome} - ${p.descricao}`;
            lista.appendChild(li);
        });
    } catch {
        lista.textContent = '';
        const li = document.createElement('li');
        li.className = 'list-group-item text-danger';
        li.textContent = 'Nao foi possivel consultar os projetos no servidor.';
        lista.appendChild(li);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConfiguracoes);
} else {
    initConfiguracoes();
}
