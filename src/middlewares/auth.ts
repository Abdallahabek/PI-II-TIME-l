// Autor: Abdallah Ali Borges El Khatib
// Autenticacao por token HMAC e controle de acesso por perfil

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { executarQuery } from '../config/database';
import { PerfilUsuario, UsuarioPublico } from '../types';

interface TokenPayload extends UsuarioPublico {
    exp: number;
}

const SEGUNDO_EM_MS = 1000;
const DURACAO_TOKEN_MS = 24 * 60 * 60 * 1000;

function obterSegredo(): string {
    return process.env.AUTH_SECRET || 'pi2-time1-chave-padrao';
}

function assinar(dadosBase64: string): string {
    return crypto
        .createHmac('sha256', obterSegredo())
        .update(dadosBase64)
        .digest('base64url');
}

// Gera token assinado com validade de 24h para o usuario autenticado
export function gerarToken(usuario: UsuarioPublico): string {
    const payload: TokenPayload = {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        exp: Date.now() + DURACAO_TOKEN_MS
    };

    const corpo = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const assinatura = assinar(corpo);
    return `${corpo}.${assinatura}`;
}

export function validarToken(token: string): UsuarioPublico | null {
    const partes = token.split('.');
    if (partes.length !== 2) {
        return null;
    }

    const [corpo, assinaturaRecebida] = partes;
    const assinaturaEsperada = assinar(corpo);

    const bufRecebida = Buffer.from(assinaturaRecebida);
    const bufEsperada = Buffer.from(assinaturaEsperada);
    if (bufRecebida.length !== bufEsperada.length || !crypto.timingSafeEqual(bufRecebida, bufEsperada)) {
        return null;
    }

    try {
        const json = Buffer.from(corpo, 'base64url').toString('utf8');
        const payload = JSON.parse(json) as TokenPayload;

        if (!payload.id || !payload.email || !payload.perfil || !payload.exp) {
            return null;
        }
        if (Date.now() > payload.exp && payload.exp > SEGUNDO_EM_MS) {
            return null;
        }

        return {
            id: payload.id,
            nome: payload.nome,
            email: payload.email,
            perfil: payload.perfil
        };
    } catch {
        return null;
    }
}

export function autenticarToken(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            erro: true,
            mensagem: 'Autenticacao obrigatoria. Faca login para continuar.'
        });
        return;
    }

    const token = authHeader.slice(7).trim();
    const usuario = validarToken(token);
    if (!usuario) {
        res.status(401).json({
            erro: true,
            mensagem: 'Sessao invalida ou expirada. Faca login novamente.'
        });
        return;
    }

    req.usuario = usuario;
    next();
}

export function exigirPerfis(...perfisPermitidos: PerfilUsuario[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.usuario) {
            res.status(401).json({
                erro: true,
                mensagem: 'Usuario nao autenticado.'
            });
            return;
        }

        if (!perfisPermitidos.includes(req.usuario.perfil)) {
            res.status(403).json({
                erro: true,
                mensagem: 'Seu perfil nao possui permissao para realizar esta acao.'
            });
            return;
        }

        next();
    };
}

// Verifica se Administrador ou usuario vinculado ao projeto na tabela usuario_projeto
export async function usuarioTemAcessoAoProjeto(
    usuario: UsuarioPublico,
    projetoId: number
): Promise<boolean> {
    if (usuario.perfil === 'Administrador') {
        return true;
    }

    const resultado = await executarQuery<{ total: number }>(
        `SELECT COUNT(*) AS "total"
           FROM usuario_projeto
          WHERE usuario_id = :usuarioId
            AND projeto_id = :projetoId`,
        { usuarioId: usuario.id, projetoId }
    );

    const total = resultado.rows?.[0]?.total ?? 0;
    return Number(total) > 0;
}
