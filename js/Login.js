// Feito por Abdallah

function initLoginValidation() {
    const form = document.querySelector('form');
    
    if (form) {
        form.addEventListener('submit', function(event) {
            // 1) block do envio com preventDefault
            event.preventDefault();
            
            const emailInput = document.querySelector('input[type="email"]');
            const passwordInput = document.querySelector('input[type="password"]');
            
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value.trim() : '';
            
            // 2) alert() se email ou senha estiverem vazios
            if (email === '' || password === '') {
                alert('O e-mail e a senha não podem estar vazios.');
                return;
            }
            
            // 3) alert() se email for inválido (sem @ e .)
            if (!email.includes('@') || !email.includes('.')) {
                alert('Por favor, insira um e-mail válido com @ e .');
                return;
            }
            
            // 4) alert() se senha tiver menos de 6 caracteres
            if (password.length < 6) {
                alert('A senha deve ter pelo menos 6 caracteres.');
                return;
            }
            
            // 5) aplicar regras de senha (letras maiúsculas, minúsculas, números)
            const hasUpperCase = /[A-Z]/.test(password);
            const hasLowerCase = /[a-z]/.test(password);
            const hasNumbers = /[0-9]/.test(password);
            
            if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
                alert('A senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número.');
                return;
            }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginValidation);
} else {
    initLoginValidation();
}