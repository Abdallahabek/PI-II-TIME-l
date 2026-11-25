// Autor: Abdallah Ali Borges El Khatib
// Utilitarios de sessao autenticada, formatacao de datas e comunicacao com a API

const API_BASE_URL = String(
    (typeof window !== 'undefined' && window.API_BASE_URL) ||
    (localStorage.getItem('apiBaseUrl') || '').trim() ||
    'http://localhost:3000'
).replace(/\/+$/, '');

const CHAVE_TOKEN = 'pi2_auth_token';
const CHAVE_USUARIO = 'pi2_auth_usuario';
const CHAVE_SESSAO_EXPIRADA = 'sessaoExpirada';
const CHAVE_MSG_SUCESSO_DEMANDA = 'mensagemSucessoDemanda';

let paginaProtegida = false;

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

// Decodifica o payload base64url do token HMAC para checar expiracao no cliente
function decodificarPayloadToken(token) {
    if (!token || typeof token !== 'string') {
        return null;
    }
    const partes = token.split('.');
    if (partes.length < 2) {
        return null;
    }
    try {
        const base64 = partes[0].replace(/-/g, '+').replace(/_/g, '/');
        const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        const binario = atob(preenchido);
        const bytes = Uint8Array.from(binario, ch => ch.charCodeAt(0));
        const json = new TextDecoder('utf-8').decode(bytes);
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function tokenEstaExpirado(token) {
    const payload = decodificarPayloadToken(token);
    if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
        return true;
    }
    return Date.now() >= payload.exp;
}

function possuiSessaoValida() {
    const token = obterToken();
    const usuario = obterUsuario();
    if (!token || !usuario) {
        return false;
    }
    return !tokenEstaExpirado(token);
}

function redirecionarParaLogin(expirada = false) {
    limparSessao();
    if (expirada) {
        sessionStorage.setItem(CHAVE_SESSAO_EXPIRADA, '1');
    }
    window.location.href = 'Front_telalogin.html';
}

// Redireciona para o login se nao houver sessao valida ou se o token estiver expirado
function verificarAutenticacao() {
    paginaProtegida = true;
    const token = obterToken();
    const usuario = obterUsuario();

    if (!token || !usuario) {
        redirecionarParaLogin(false);
        return null;
    }

    if (tokenEstaExpirado(token)) {
        redirecionarParaLogin(true);
        return null;
    }

    return usuario;
}

// Revalida sessao ao voltar pelo historico do navegador (protecao contra BFCache apos logout)
window.addEventListener('pageshow', function (event) {
    if (paginaProtegida && (event.persisted || !possuiSessaoValida())) {
        verificarAutenticacao();
    }
});

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
    if (linkSair && !linkSair.dataset.logoutBound) {
        linkSair.dataset.logoutBound = '1';
        linkSair.addEventListener('click', function () {
            limparSessao();
            sessionStorage.removeItem(CHAVE_SESSAO_EXPIRADA);
        });
    }
}

// Converte YYYY-MM-DD por split de string (sem deslocamento de fuso) e timestamps UTC para data local
function formatarData(dataIso) {
    if (!dataIso) {
        return '-';
    }
    const texto = String(dataIso).trim();
    const matchSomenteData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (matchSomenteData) {
        return `${matchSomenteData[3]}/${matchSomenteData[2]}/${matchSomenteData[1]}`;
    }

    const data = new Date(texto);
    if (!Number.isNaN(data.getTime())) {
        try {
            const partes = new Intl.DateTimeFormat('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).formatToParts(data);
            const mapa = {};
            partes.forEach(p => {
                mapa[p.type] = p.value;
            });
            return `${mapa.day}/${mapa.month}/${mapa.year}`;
        } catch {
            const dia = String(data.getDate()).padStart(2, '0');
            const mes = String(data.getMonth() + 1).padStart(2, '0');
            const ano = data.getFullYear();
            return `${dia}/${mes}/${ano}`;
        }
    }

    const matchPrefixo = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
    if (matchPrefixo) {
        return `${matchPrefixo[3]}/${matchPrefixo[2]}/${matchPrefixo[1]}`;
    }
    return texto;
}

// Converte timestamp ISO UTC (...Z) para DD/MM/YYYY HH:mm no fuso local do navegador
function formatarDataHora(isoUtc) {
    if (!isoUtc) {
        return '-';
    }
    const texto = String(isoUtc).trim();
    const data = new Date(texto);
    if (Number.isNaN(data.getTime())) {
        return formatarData(texto);
    }
    try {
        const partes = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).formatToParts(data);
        const mapa = {};
        partes.forEach(p => {
            mapa[p.type] = p.value;
        });
        return `${mapa.day}/${mapa.month}/${mapa.year} ${mapa.hour}:${mapa.minute}`;
    } catch {
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        const hora = String(data.getHours()).padStart(2, '0');
        const min = String(data.getMinutes()).padStart(2, '0');
        return `${dia}/${mes}/${ano} ${hora}:${min}`;
    }
}

function obterDataHojeIso() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// Wrapper de fetch que envia Bearer token e trata sessao expirada (401) sem falso erro de rede
async function requisicaoAutenticada(caminho, opcoes = {}) {
    const token = obterToken();
    const ehLogin = caminho === '/login';

    if (!ehLogin && token && tokenEstaExpirado(token)) {
        redirecionarParaLogin(true);
        return { ok: false, status: 401, redirecionado: true, dados: {} };
    }

    const headers = new Headers(opcoes.headers || {});

    if (!ehLogin && token) {
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

    if (resposta.status === 401 && !ehLogin) {
        redirecionarParaLogin(true);
        return { ok: false, status: 401, redirecionado: true, dados };
    }

    return { ok: resposta.ok, status: resposta.status, redirecionado: false, dados };
}

const apiFetch = requisicaoAutenticada;

window.Auth = {
    API_BASE_URL,
    CHAVE_SESSAO_EXPIRADA,
    CHAVE_MSG_SUCESSO_DEMANDA,
    salvarSessao,
    obterToken,
    obterUsuario,
    limparSessao,
    decodificarPayloadToken,
    tokenEstaExpirado,
    possuiSessaoValida,
    verificarAutenticacao,
    preencherUsuarioTopbar,
    formatarData,
    formatarDataHora,
    obterDataHojeIso,
    requisicaoAutenticada,
    apiFetch
};
