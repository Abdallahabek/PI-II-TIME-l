// Feito por: Abdallah Ali Borges El Khatib
// Servidor Express com TypeScript - Reunião 4 PI2

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Rotas feitas por Abdallah
import cadastroDemandasRoutes from './routes/cadastroDemandas.routes';
import projetosRoutes from './routes/projetos.routes';
import dashboardRoutes from './routes/dashboard.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rota raiz para testar se o servidor esta rodando
app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
        projeto: 'Sistema de Acompanhamento de Demandas de Desenvolvimento',
        etapa: 'Reuniao 4',
        status: 'Online',
        responsavel: 'Abdallah Ali Borges El Khatib'
    });
});

// Rotas do backend
app.use('/demandas', cadastroDemandasRoutes);
app.use('/projetos', projetosRoutes);
app.use('/dashboard', dashboardRoutes);

// Rota 404 para endpoints que nao existem
app.use((req: Request, res: Response) => {
    res.status(404).json({
        erro: true,
        mensagem: `Rota nao encontrada: ${req.method} ${req.originalUrl}`
    });
});

// Tratamento de erro 500
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Erro no servidor:', err);
    res.status(500).json({
        erro: true,
        mensagem: 'Erro interno no servidor.'
    });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`API pronta em http://localhost:${PORT}`);
});

export default app;
