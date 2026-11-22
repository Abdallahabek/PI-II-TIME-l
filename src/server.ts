// Autor: Abdallah Ali Borges El Khatib
// Ponto de entrada do servidor Express com integracao Oracle

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { closePool, initPool } from './config/database';
import authRoutes from './routes/auth.routes';
import projetosRoutes from './routes/projetos.routes';
import cadastroDemandasRoutes from './routes/cadastroDemandas.routes';
import dashboardRoutes from './routes/dashboard.routes';
import listagemDemandasRoutes from './routes/listagemDemandas.routes';
import detalhesRoutes from './routes/detalhesRoutes';

import { registrarSwagger } from './openapi';

const app = express();
registrarSwagger(app);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
        projeto: 'Sistema de Acompanhamento de Demandas de Desenvolvimento',
        status: 'Online'
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
        mensagem: `Rota nao encontrada: ${req.method} ${req.originalUrl}`
    });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Erro nao tratado no servidor:', err);
    res.status(500).json({
        erro: true,
        mensagem: 'Erro interno no servidor.'
    });
});

async function iniciarServidor() {
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

    process.on('SIGINT', async () => {
        server.close();
        await closePool();
        process.exit(0);
    });
}

if (require.main === module) iniciarServidor();

export default app;

