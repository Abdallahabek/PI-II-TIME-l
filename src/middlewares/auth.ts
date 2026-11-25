// Autor: Abdallah Ali Borges El Khatib
// Autenticacao por token HMAC, hash scrypt de senhas e controle de acesso por perfil

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { executarQuery } from '../config/database';
import { PerfilUsuario, UsuarioPublico } from '../types';

interface TokenPayload extends UsuarioPublico {
    exp: number;
}

const DURACAO_TOKEN_MS = 24 * 60 * 60 * 1000;
const PERFIS_VALIDOS: PerfilUsuario[] = ['Administrador', 'Líder de Projeto', 'Membro da Equipe'];
const PREFIXO_HASH_SCRYPT = 'scrypt';
const TAMANHO_SALT_BYTES = 16;
const TAMANHO_CHAVE_SCRYPT = 64;
const REGEX_SALT_HEX = /^[0-9a-f]{32}$/i;
const REGEX_HASH_HEX = /^[0-9a-f]{128}$/i;

export const MENSAGEM_AUTH_INDISPONIVEL = 'Serviço de autenticação indisponível no momento.';

export class ErroConfiguracaoAuth extends Error {
    constructor(mensagem: string = MENSAGEM_AUTH_INDISPONIVEL) {
        super(mensagem);
        this.name = 'ErroConfiguracaoAuth';
    }
}

// Verifica se AUTH_SECRET foi informada no ambiente sem expor o valor
export function authSecretConfigurado(): boolean {
    return typeof process.env.AUTH_SECRET === 'string' && process.env.AUTH_SECRET.trim().length > 0;
}

// Exige AUTH_SECRET configurada no ambiente e elimina qualquer segredo padrao no codigo
export function obterSegredoAuth(): string {
    if (!authSecretConfigurado()) {
        console.error('Configuracao de autenticacao incompleta: defina AUTH_SECRET no arquivo .env.');
        throw new ErroConfiguracaoAuth(MENSAGEM_AUTH_INDISPONIVEL);
    }
    return process.env.AUTH_SECRET!.trim();
}

// Gera hash scrypt com salt aleatorio de 16 bytes no formato scrypt$<saltHex32>$<hashHex128>
export function gerarHashSenha(senha: string): string {
    const salt = crypto.randomBytes(TAMANHO_SALT_BYTES).toString('hex');
    const hash = crypto.scryptSync(senha, salt, TAMANHO_CHAVE_SCRYPT).toString('hex');
    return `${PREFIXO_HASH_SCRYPT}$${salt}$${hash}`;
}

// Verifica senha informada contra hash scrypt armazenado usando comparacao em tempo constante
export function verificarSenha(senhaInformada: string, senhaArmazenada: string): boolean {
    if (typeof senhaInformada !== 'string' || typeof senhaArmazenada !== 'string') {
        return false;
    }

    const partes = senhaArmazenada.split('$');
    if (partes.length !== 3) {
        return false;
    }

    const [algoritmo, salt, hashHex] = partes;
    if (
        algoritmo !== PREFIXO_HASH_SCRYPT ||
        !REGEX_SALT_HEX.test(salt) ||
        !REGEX_HASH_HEX.test(hashHex)
    ) {
        return false;
    }

    try {
        const hashCalculado = crypto.scryptSync(senhaInformada, salt, TAMANHO_CHAVE_SCRYPT);
        const hashEsperado = Buffer.from(hashHex, 'hex');
        if (hashCalculado.length !== hashEsperado.length) {
            return false;
        }
        return crypto.timingSafeEqual(hashCalculado, hashEsperado);
    } catch {
        return false;
    }
}

function assinar(dadosBase64: string): string {
    return crypto
        .createHmac('sha256', obterSegredoAuth())
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

// Valida assinatura HMAC, estrutura estrita do payload e expiracao do token
export function validarToken(token: string): UsuarioPublico | null {
    // Garante erro explicito de configuracao mesmo antes de inspecionar o formato do token
    obterSegredoAuth();

    const partes = token.split('.');
    if (partes.length !== 2) {
        return null;
    }

    const [corpo, assinaturaRecebida] = partes;
    if (!corpo || !assinaturaRecebida) {
        return null;
    }

    const assinaturaEsperada = assinar(corpo);
    const bufRecebida = Buffer.from(assinaturaRecebida);
    const bufEsperada = Buffer.from(assinaturaEsperada);
    if (bufRecebida.length !== bufEsperada.length || !crypto.timingSafeEqual(bufRecebida, bufEsperada)) {
        return null;
    }

    try {
        const json = Buffer.from(corpo, 'base64url').toString('utf8');
        const payload = JSON.parse(json) as Partial<TokenPayload> | null;

        if (!payload || typeof payload !== 'object') {
            return null;
        }

        if (
            typeof payload.id !== 'number' ||
            !Number.isInteger(payload.id) ||
            payload.id <= 0
        ) {
            return null;
        }

        if (typeof payload.nome !== 'string' || payload.nome.trim().length === 0) {
            return null;
        }

        if (typeof payload.email !== 'string' || payload.email.trim().length === 0) {
            return null;
        }

        if (
            typeof payload.perfil !== 'string' ||
            !PERFIS_VALIDOS.includes(payload.perfil as PerfilUsuario)
        ) {
            return null;
        }

        if (
            typeof payload.exp !== 'number' ||
            !Number.isFinite(payload.exp) ||
            payload.exp <= Date.now()
        ) {
            return null;
        }

        return {
            id: payload.id,
            nome: payload.nome,
            email: payload.email,
            perfil: payload.perfil as PerfilUsuario
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
            mensagem: 'Autenticação obrigatória. Faça login para continuar.'
        });
        return;
    }

    const token = authHeader.slice(7).trim();
    let usuario: UsuarioPublico | null;

    try {
        usuario = validarToken(token);
    } catch (erro) {
        if (erro instanceof ErroConfiguracaoAuth) {
            console.error('Falha ao validar token por configuracao ausente:', erro.message);
            res.status(503).json({
                erro: true,
                mensagem: MENSAGEM_AUTH_INDISPONIVEL
            });
            return;
        }
        throw erro;
    }

    if (!usuario) {
        res.status(401).json({
            erro: true,
            mensagem: 'Sessão inválida ou expirada. Faça login novamente.'
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
                mensagem: 'Usuário não autenticado.'
            });
            return;
        }

        if (!perfisPermitidos.includes(req.usuario.perfil)) {
            res.status(403).json({
                erro: true,
                mensagem: 'Seu perfil não possui permissão para realizar esta ação.'
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
