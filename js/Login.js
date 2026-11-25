// Autor: Abdallah Ali Borges El Khatib
// Validacao de formulario e autenticacao via POST /login

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function exibirErroLogin(mensagem) {
    const box = document.getElementById('loginErro');
    if (box) {
        box.textContent = mensagem;
        box.classList.remove('d-none');
    } else {
        alert(mensagem);
    }
}

function limparErroLogin() {
    const box = document.getElementById('loginErro');
    if (box) {
        box.textContent = '';
        box.classList.add('d-none');
    }
}

function initLoginValidation() {
    // Exibe aviso se o usuario foi redirecionado por sessao expirada
    if (sessionStorage.getItem('sessaoExpirada') === '1') {
        sessionStorage.removeItem('sessaoExpirada');
        exibirErroLogin('Sua sessão expirou. Faça login novamente.');
    }

    // Se ja existe sessao valida e nao expirada, redireciona direto para o painel
    if (possuiSessaoValida()) {
        window.location.href = 'Dashbord.html';
        return;
    }

    // Limpa eventual token expirado ou corrompido restante no localStorage
    if (obterToken() || obterUsuario()) {
        limparSessao();
    }

    const form = document.getElementById('loginForm');
    if (!form) {
        return;
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        limparErroLogin();

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('senha');
        const btnEntrar = document.getElementById('btnEntrar');

        const email = emailInput ? emailInput.value.trim() : '';
        const senha = passwordInput ? passwordInput.value : '';

        // Validacoes de cliente coerentes com as regras da Reuniao 3
        if (email === '' || senha.trim() === '') {
            exibirErroLogin('O e-mail e a senha não podem estar vazios.');
            return;
        }

        if (!REGEX_EMAIL.test(email)) {
            exibirErroLogin('Por favor, insira um e-mail válido.');
            return;
        }

        if (senha.length < 6) {
            exibirErroLogin('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        const temMaiuscula = /[A-Z]/.test(senha);
        const temMinuscula = /[a-z]/.test(senha);
        const temNumero = /[0-9]/.test(senha);

        if (!temMaiuscula || !temMinuscula || !temNumero) {
            exibirErroLogin('A senha deve conter ao menos uma letra maiúscula, uma minúscula e um número.');
            return;
        }

        if (btnEntrar) {
            btnEntrar.disabled = true;
            btnEntrar.textContent = 'Entrando...';
        }

        // Envia credenciais para POST /login e salva o token recebido
        try {
            const { ok, dados } = await apiFetch('/login', {
                method: 'POST',
                body: JSON.stringify({ email, senha })
            });

            if (!ok) {
                exibirErroLogin(dados.mensagem || 'Credenciais inválidas.');
                return;
            }

            if (!dados.token || !dados.usuario) {
                exibirErroLogin('Resposta inválida do servidor ao autenticar.');
                return;
            }

            salvarSessao(dados.token, dados.usuario);
            window.location.href = 'Dashbord.html';
        } catch {
            exibirErroLogin(`Não foi possível conectar ao servidor em ${API_BASE_URL}.`);
        } finally {
            if (btnEntrar) {
                btnEntrar.disabled = false;
                btnEntrar.textContent = 'Entrar';
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginValidation);
} else {
    initLoginValidation();
}
