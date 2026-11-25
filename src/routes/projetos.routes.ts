// Autor: Abdallah Ali Borges El Khatib
// Rota GET /projetos filtrada pelo perfil do usuario autenticado

import { Router, Request, Response } from 'express';
import {
    ehErroConexaoOracle,
    executarQuery,
    MENSAGEM_BANCO_INDISPONIVEL
} from '../config/database';
import { autenticarToken } from '../middlewares/auth';
import { Projeto } from '../types';

const router = Router();

// Administrador enxerga todos os projetos; demais perfis veem apenas os vinculados
router.get('/', autenticarToken, async (req: Request, res: Response) => {
    try {
        const usuario = req.usuario!;

        const sql =
            usuario.perfil === 'Administrador'
                ? `SELECT id AS "id",
                          nome AS "nome",
                          descricao AS "descricao",
                          TO_CHAR(data_criacao, 'YYYY-MM-DD') AS "dataCriacao"
                     FROM projetos
                    ORDER BY id`
                : `SELECT p.id AS "id",
                          p.nome AS "nome",
                          p.descricao AS "descricao",
                          TO_CHAR(p.data_criacao, 'YYYY-MM-DD') AS "dataCriacao"
                     FROM projetos p
                    INNER JOIN usuario_projeto up ON up.projeto_id = p.id
                    WHERE up.usuario_id = :usuarioId
                    ORDER BY p.id`;

        const binds = usuario.perfil === 'Administrador' ? {} : { usuarioId: usuario.id };
        const resultado = await executarQuery<Projeto>(sql, binds);

        const projetos = (resultado.rows ?? []).map(p => ({
            ...p,
            id: Number(p.id)
        }));

        res.status(200).json({
            total: projetos.length,
            projetos
        });
    } catch (erro) {
        if (ehErroConexaoOracle(erro)) {
            console.error('Erro de conexao Oracle ao listar projetos:', erro);
            res.status(503).json({ erro: true, mensagem: MENSAGEM_BANCO_INDISPONIVEL });
            return;
        }
        console.error('Erro ao listar projetos:', erro);
        res.status(500).json({ erro: true, mensagem: 'Erro interno ao consultar projetos.' });
    }
});

export default router;
