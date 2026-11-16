// Autor: Abdallah Ali Borges El Khatib
// Rotas de autenticacao (POST /login) e listagem de usuarios (GET /usuarios)

import { Router, Request, Response } from 'express';
import { ErroBancoIndisponivel, executarQuery } from '../config/database';
import { autenticarToken, gerarToken } from '../middlewares/auth';
import { PerfilUsuario, UsuarioPublico } from '../types';

interface UsuarioRow {
    id: number;
    nome: string;
    email: string;
    senha: string;
    perfil: PerfilUsuario;
}

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, senha } = req.body || {};

        if (!email || typeof email !== 'string' || email.trim() === '') {
            res.status(400).json({
                erro: true,
                mensagem: 'O e-mail e obrigatorio.'
            });
            return;
        }

        if (!senha || typeof senha !== 'string' || senha.trim() === '') {
            res.status(400).json({
                erro: true,
                mensagem: 'A senha e obrigatoria.'
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
        if (!usuarioBanco || usuarioBanco.senha !== senha) {
            res.status(401).json({
                erro: true,
                mensagem: 'E-mail ou senha invalidos.'
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
        if (erro instanceof ErroBancoIndisponivel) {
            res.status(503).json({ erro: true, mensagem: erro.message });
            return;
        }
        console.error('Erro no login:', erro);
        res.status(500).json({ erro: true, mensagem: 'Erro interno ao realizar login.' });
    }
});

router.get('/usuarios', autenticarToken, async (_req: Request, res: Response) => {
    try {
        const resultado = await executarQuery<UsuarioPublico>(
            `SELECT id AS "id",
                    nome AS "nome",
                    email AS "email",
                    perfil AS "perfil"
               FROM usuarios
              ORDER BY nome`
        );

        const usuarios = (resultado.rows ?? []).map(u => ({
            ...u,
            id: Number(u.id)
        }));

        res.status(200).json({
            total: usuarios.length,
            usuarios
        });
    } catch (erro) {
        if (erro instanceof ErroBancoIndisponivel) {
            res.status(503).json({ erro: true, mensagem: erro.message });
            return;
        }
        console.error('Erro ao listar usuarios:', erro);
        res.status(500).json({ erro: true, mensagem: 'Erro interno ao consultar usuarios.' });
    }
});

export default router;
