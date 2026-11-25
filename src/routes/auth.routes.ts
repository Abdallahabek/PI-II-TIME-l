// Autor: Abdallah Ali Borges El Khatib
// Rotas de autenticacao (POST /login) e listagem de usuarios (GET /usuarios)

import { Router, Request, Response } from 'express';
import {
    ehErroConexaoOracle,
    executarQuery,
    MENSAGEM_BANCO_INDISPONIVEL
} from '../config/database';
import {
    autenticarToken,
    ErroConfiguracaoAuth,
    gerarToken,
    MENSAGEM_AUTH_INDISPONIVEL,
    usuarioTemAcessoAoProjeto,
    verificarSenha
} from '../middlewares/auth';
import { PerfilUsuario, UsuarioPublico } from '../types';

interface UsuarioRow {
    id: number;
    nome: string;
    email: string;
    senha: string;
    perfil: PerfilUsuario;
}

interface RegistroRateLimit {
    tentativas: number;
    resetEm: number;
}

const JANELA_RATE_LIMIT_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS_LOGIN = 20;
const tentativasLoginPorIp = new Map<string, RegistroRateLimit>();

const router = Router();

function obterIpCliente(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'desconhecido';
}

// Aplica limite simples em memoria por IP para mitigar forca bruta no endpoint de login
function registrarEVerificarRateLimit(ip: string): boolean {
    const agora = Date.now();

    if (tentativasLoginPorIp.size > 1000) {
        for (const [chave, registro] of tentativasLoginPorIp.entries()) {
            if (registro.resetEm <= agora) {
                tentativasLoginPorIp.delete(chave);
            }
        }
    }

    const existente = tentativasLoginPorIp.get(ip);
    if (!existente || existente.resetEm <= agora) {
        tentativasLoginPorIp.set(ip, {
            tentativas: 1,
            resetEm: agora + JANELA_RATE_LIMIT_MS
        });
        return true;
    }

    if (existente.tentativas >= MAX_TENTATIVAS_LOGIN) {
        return false;
    }

    existente.tentativas += 1;
    return true;
}

function lerParametro(valor: unknown): string {
    if (Array.isArray(valor)) {
        return lerParametro(valor[0]);
    }
    return typeof valor === 'string' ? valor.trim() : '';
}

function lerIdPositivo(valor: string): number | null {
    if (!/^\d+$/.test(valor)) {
        return null;
    }
    const numero = Number(valor);
    return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

// Autentica o usuario no Oracle usando hash scrypt e devolve token sem expor a senha
router.post('/login', async (req: Request, res: Response) => {
    try {
        const ip = obterIpCliente(req);
        if (!registrarEVerificarRateLimit(ip)) {
            res.status(429).json({
                erro: true,
                mensagem: 'Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.'
            });
            return;
        }

        const { email, senha } = req.body || {};

        if (!email || typeof email !== 'string' || email.trim() === '') {
            res.status(400).json({
                erro: true,
                mensagem: 'O e-mail é obrigatório.'
            });
            return;
        }

        if (!senha || typeof senha !== 'string' || senha.trim() === '') {
            res.status(400).json({
                erro: true,
                mensagem: 'A senha é obrigatória.'
            });
            return;
        }

        const resultado = await executarQuery<UsuarioRow>(
            `SELECT id AS "id",
                    nome AS "nome",
                    email AS "email",
                    senha AS "senha",
                    perfil AS "perfil"
               FROM usuarios
              WHERE LOWER(email) = LOWER(:email)`,
            { email: email.trim() }
        );

        const usuarioBanco = resultado.rows?.[0];
        if (!usuarioBanco || !verificarSenha(senha, usuarioBanco.senha)) {
            res.status(401).json({
                erro: true,
                mensagem: 'E-mail ou senha inválidos.'
            });
            return;
        }

        const usuarioPublico: UsuarioPublico = {
            id: Number(usuarioBanco.id),
            nome: usuarioBanco.nome,
            email: usuarioBanco.email,
            perfil: usuarioBanco.perfil
        };

        const token = gerarToken(usuarioPublico);

        res.status(200).json({
            mensagem: 'Login realizado com sucesso.',
            token,
            usuario: usuarioPublico
        });
    } catch (erro) {
        if (erro instanceof ErroConfiguracaoAuth) {
            console.error('Erro de configuracao de autenticacao no login:', erro.message);
            res.status(503).json({ erro: true, mensagem: MENSAGEM_AUTH_INDISPONIVEL });
            return;
        }
        if (ehErroConexaoOracle(erro)) {
            console.error('Erro de conexao Oracle no login:', erro);
            res.status(503).json({ erro: true, mensagem: MENSAGEM_BANCO_INDISPONIVEL });
            return;
        }
        console.error('Erro no login:', erro);
        res.status(500).json({ erro: true, mensagem: 'Erro interno ao realizar login.' });
    }
});

// Lista usuarios visiveis ao perfil (sem senha), com filtro opcional por projetoId
router.get('/usuarios', autenticarToken, async (req: Request, res: Response) => {
    try {
        const usuario = req.usuario!;
        const projetoIdParam = lerParametro(req.query.projetoId);

        let sql: string;
        let binds: Record<string, number> = {};

        if (projetoIdParam !== '') {
            const projetoId = lerIdPositivo(projetoIdParam);
            if (projetoId === null) {
                res.status(400).json({
                    erro: true,
                    mensagem: 'O projetoId informado é inválido.'
                });
                return;
            }

            if (usuario.perfil !== 'Administrador') {
                const temAcesso = await usuarioTemAcessoAoProjeto(usuario, projetoId);
                if (!temAcesso) {
                    res.status(403).json({
                        erro: true,
                        mensagem: 'Você não está vinculado ao projeto informado.'
                    });
                    return;
                }
            }

            // Retorna usuarios vinculados ao projeto informado mais Administradores
            sql = `
                SELECT u.id AS "id",
                       u.nome AS "nome",
                       u.email AS "email",
                       u.perfil AS "perfil"
                  FROM usuarios u
                 WHERE u.perfil = 'Administrador'
                    OR EXISTS (
                        SELECT 1
                          FROM usuario_projeto up
                         WHERE up.usuario_id = u.id
                           AND up.projeto_id = :projetoId
                    )
                 ORDER BY u.nome ASC
            `;
            binds = { projetoId };
        } else if (usuario.perfil === 'Administrador') {
            sql = `
                SELECT id AS "id",
                       nome AS "nome",
                       email AS "email",
                       perfil AS "perfil"
                  FROM usuarios
                 ORDER BY nome ASC
            `;
        } else {
            // Lider e Membro veem apenas colegas que compartilham ao menos um projeto e Administradores
            sql = `
                SELECT u.id AS "id",
                       u.nome AS "nome",
                       u.email AS "email",
                       u.perfil AS "perfil"
                  FROM usuarios u
                 WHERE u.perfil = 'Administrador'
                    OR u.id = :usuarioId
                    OR EXISTS (
                        SELECT 1
                          FROM usuario_projeto up1
                         INNER JOIN usuario_projeto up2 ON up2.projeto_id = up1.projeto_id
                         WHERE up1.usuario_id = :usuarioId
                           AND up2.usuario_id = u.id
                    )
                 ORDER BY u.nome ASC
            `;
            binds = { usuarioId: usuario.id };
        }

        const resultado = await executarQuery<UsuarioPublico>(sql, binds);

        const usuarios = (resultado.rows ?? []).map(u => ({
            ...u,
            id: Number(u.id)
        }));

        res.status(200).json({
            total: usuarios.length,
            usuarios
        });
    } catch (erro) {
        if (ehErroConexaoOracle(erro)) {
            console.error('Erro de conexao Oracle ao listar usuarios:', erro);
            res.status(503).json({ erro: true, mensagem: MENSAGEM_BANCO_INDISPONIVEL });
            return;
        }
        console.error('Erro ao listar usuarios:', erro);
        res.status(500).json({ erro: true, mensagem: 'Erro interno ao consultar usuários.' });
    }
});

export default router;
