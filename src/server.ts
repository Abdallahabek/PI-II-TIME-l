// Autor: Abdallah Ali Borges El Khatib
// Ponto de entrada do servidor Express com integracao Oracle

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import {
    closePool,
    ehErroConexaoOracle,
    ErroBancoNaoConfigurado,
    initPool,
    MENSAGEM_BANCO_INDISPONIVEL,
    poolAtivo
} from './config/database';
import {
    authSecretConfigurado,
    ErroConfiguracaoAuth,
    MENSAGEM_AUTH_INDISPONIVEL
} from './middlewares/auth';
import authRoutes from './routes/auth.routes';
import projetosRoutes from './routes/projetos.routes';
import cadastroDemandasRoutes from './routes/cadastroDemandas.routes';
import dashboardRoutes from './routes/dashboard.routes';
import listagemDemandasRoutes from './routes/listagemDemandas.routes';
import detalhesRoutes from './routes/detalhesRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

// Restringe origens CORS quando CORS_ORIGIN estiver definido; em desenvolvimento aceita origens locais
const origensPermitidas = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origem => origem.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (origensPermitidas.length === 0) {
                callback(null, true);
                return;
            }
            if (!origin || origensPermitidas.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(null, false);
        }
    })
);

app.use(express.json());

// Endpoint de verificacao de disponibilidade sem expor credenciais ou variaveis de ambiente
app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
        projeto: 'Sistema de Acompanhamento de Demandas de Desenvolvimento',
        status: 'Online',
        bancoConectado: poolAtivo(),
        authConfigurado: authSecretConfigurado()
    });
});

// Rotas principais registradas na API
app.use('/', authRoutes);
app.use('/projetos', projetosRoutes);
app.use('/demandas', cadastroDemandasRoutes);
app.use('/demandas', listagemDemandasRoutes);
app.use('/demandas', detalhesRoutes);
app.use('/dashboard', dashboardRoutes);

app.use((req: Request, res: Response) => {
    res.status(404).json({
        erro: true,
        mensagem: `Rota não encontrada: ${req.method} ${req.originalUrl}`
    });
});

// Middleware global para tratar JSON malformado, payload excedido e falhas de infraestrutura
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const erroHttp = err as Error & { status?: number; statusCode?: number; type?: string };

    if (
        erroHttp.type === 'entity.parse.failed' ||
        (err instanceof SyntaxError && (erroHttp.status === 400 || erroHttp.statusCode === 400))
    ) {
        res.status(400).json({
            erro: true,
            mensagem: 'Corpo da requisição em JSON inválido.'
        });
        return;
    }

    if (erroHttp.type === 'entity.too.large' || erroHttp.status === 413 || erroHttp.statusCode === 413) {
        res.status(413).json({
            erro: true,
            mensagem: 'O corpo da requisição excede o limite permitido.'
        });
        return;
    }

    if (err instanceof ErroConfiguracaoAuth) {
        console.error('Erro de configuracao de autenticacao:', err.message);
        res.status(503).json({
            erro: true,
            mensagem: MENSAGEM_AUTH_INDISPONIVEL
        });
        return;
    }

    if (err instanceof ErroBancoNaoConfigurado || ehErroConexaoOracle(err)) {
        console.error('Erro de disponibilidade do banco Oracle:', err);
        res.status(503).json({
            erro: true,
            mensagem: MENSAGEM_BANCO_INDISPONIVEL
        });
        return;
    }

    console.error('Erro nao tratado no servidor:', err);
    res.status(500).json({
        erro: true,
        mensagem: 'Erro interno no servidor.'
    });
});

async function iniciarServidor() {
    if (!authSecretConfigurado()) {
        console.warn('Aviso: AUTH_SECRET nao configurada no .env. Rotas autenticadas retornarao 503.');
    }

    try {
        await initPool();
        console.log('Pool de conexoes Oracle inicializado.');
    } catch (erro) {
        const msg = erro instanceof Error ? erro.message : String(erro);
        console.warn('Aviso: servidor iniciado sem conexao Oracle ativa -', msg);
    }

    const server = app.listen(PORT, () => {
        console.log(`Servidor rodando em http://localhost:${PORT}`);
    });

    // Encerramento gracioso para SIGINT e SIGTERM aguardando requisicoes ativas antes de fechar o pool
    let encerrando = false;
    const encerrarGraciosamente = async (sinal: string) => {
        if (encerrando) {
            return;
        }
        encerrando = true;
        console.log(`Sinal ${sinal} recebido. Encerrando servidor...`);

        await new Promise<void>(resolve => {
            server.close(() => resolve());
        });

        try {
            await closePool();
        } catch (erro) {
            console.error('Erro ao fechar pool Oracle:', erro);
        }

        process.exit(0);
    };

    process.on('SIGINT', () => {
        void encerrarGraciosamente('SIGINT');
    });

    process.on('SIGTERM', () => {
        void encerrarGraciosamente('SIGTERM');
    });
}

iniciarServidor();

export default app;
