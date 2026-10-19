// Feito por: Abdallah Ali Borges El Khatib
// Rota de Projetos - Reuniao 4 PI2

import { Router, Request, Response } from 'express';
import { projetos } from '../data/mockData';

const router = Router();

// GET /projetos - lista os projetos pre-cadastrados
router.get('/', (_req: Request, res: Response) => {
    return res.status(200).json({
        total: projetos.length,
        projetos: projetos
    });
});

export default router;
