// Autor: Abdallah Ali Borges El Khatib
// Utilitarios de sessao autenticada e comunicacao com a API

const API_BASE_URL = 'http://localhost:3000';
const CHAVE_TOKEN = 'pi2_auth_token';
const CHAVE_USUARIO = 'pi2_auth_usuario';

function salvarSessao(token, usuario) {
    localStorage.setItem(CHAVE_TOKEN, token);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

function obterToken() {
    return localStorage.getItem(CHAVE_TOKEN);
}

function obterUsuario() {
    const bruto = localStorage.getItem(CHAVE_USUARIO);
    if (!bruto) {
        return null;
    }
    try {
        return JSON.parse(bruto);
    } catch {
        return null;
    }
}

function limparSessao() {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
}

function verificarAutenticacao() {
    const token = obterToken();
    const usuario = obterUsuario();

    if (!token || !usuario) {
        limparSessao();
        window.location.href = 'Front_telalogin.html';
        return null;
    }

    return usuario;
}

function preencherUsuarioTopbar(usuario) {
    if (!usuario) {
        return;
    }

    const elInfo = document.getElementById('topbarUsuario');
    if (elInfo) {
        elInfo.textContent = '';

        const texto = document.createTextNode(`${usuario.nome} (${usuario.perfil}) `);
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.innerHTML = '<i class="fa-solid fa-user"></i>';

        elInfo.appendChild(texto);
        elInfo.appendChild(avatar);
    }

    const linkSair = document.querySelector('a[href="Front_telalogin.html"]');
    if (linkSair) {
        linkSair.addEventListener('click', function () {
            limparSessao();
        });
    }
}

async function apiFetch(caminho, opcoes = {}) {
    const token = obterToken();
    const headers = new Headers(opcoes.headers || {});

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    if (opcoes.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const resposta = await fetch(`${API_BASE_URL}${caminho}`, {
        ...opcoes,
        headers
    });

    let dados = {};
    try {
        dados = await resposta.json();
    } catch {
        dados = {};
    }

    if (resposta.status === 401 && caminho !== '/login') {
        limparSessao();
        window.location.href = 'Front_telalogin.html';
        throw new Error(dados.mensagem || 'Sessao expirada.');
    }

    return { ok: resposta.ok, status: resposta.status, dados };
}
