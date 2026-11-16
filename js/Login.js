// Autor: Abdallah Ali Borges El Khatib
// Validacao de formulario e autenticacao via POST /login

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

        if (email === '' || senha.trim() === '') {
            exibirErroLogin('O e-mail e a senha nao podem estar vazios.');
            return;
        }

        if (!email.includes('@') || !email.includes('.')) {
            exibirErroLogin('Por favor, insira um e-mail valido.');
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
            exibirErroLogin('A senha deve conter ao menos uma letra maiuscula, uma minuscula e um numero.');
            return;
        }

        if (btnEntrar) {
            btnEntrar.disabled = true;
            btnEntrar.textContent = 'Entrando...';
        }

        try {
            const { ok, dados } = await apiFetch('/login', {
                method: 'POST',
                body: JSON.stringify({ email, senha })
            });

            if (!ok) {
                exibirErroLogin(dados.mensagem || 'Credenciais invalidas.');
                return;
            }

            salvarSessao(dados.token, dados.usuario);
            window.location.href = 'Dashbord.html';
        } catch {
            exibirErroLogin('Nao foi possivel conectar ao servidor em http://localhost:3000.');
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
