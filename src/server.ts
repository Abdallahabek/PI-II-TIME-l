// Feito por Abdallah
import express, { Request, Response } from 'express';
import detalhesRoutes from './routes/detalhesRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Rotas da tela de detalhes da demanda
app.use('/demandas', detalhesRoutes);

// Rota simples para demonstrar o funcionamento do servidor
app.get('/', (req: Request, res: Response) => {
    res.send('Servidor do Sistema de Acompanhamento de Demandas de Desenvolvimento está funcionando corretamente!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT} 🚀`);
});
