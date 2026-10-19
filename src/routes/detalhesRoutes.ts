// Feito por: Vinicius de Morais Borges de oliveira
// Rotas da tela de Detalhes da Demanda (Reunião 4):
//   GET  /demandas/:id               -> dados completos de uma demanda
//   GET  /demandas/:id/comentarios   -> comentários dessa demanda
//   POST /demandas/:id/comentarios   -> registra um novo comentário

import { Router, Request, Response } from 'express';
import { demandas, comentarios, usuarios, projetos, Comentario } from '../dados/dadosDeTeste';

const router = Router();

// Procura a demanda pelo id que veio na URL. Devolve undefined se não achar.
function buscarDemanda(idDaUrl: string) {
    // só aceita números inteiros (ex.: "2"); algo como "abc" cai direto no "não encontrada"
    if (!/^\d+$/.test(idDaUrl)) {
        return undefined;
    }
    return demandas.find((demanda) => demanda.id === Number(idDaUrl));
}

// GET /demandas/:id
router.get('/:id', (req: Request, res: Response) => {
    const demanda = buscarDemanda(String(req.params.id));

    if (!demanda) {
        res.status(404).json({ erro: 'Demanda não encontrada.' });
        return;
    }

    // Além dos campos da demanda, devolvemos os nomes para a tela não precisar procurar
    const projeto = projetos.find((p) => p.id === demanda.projetoId);
    const responsavel = usuarios.find((u) => u.id === demanda.responsavelId);

    res.status(200).json({
        ...demanda,
        projetoNome: projeto ? projeto.nome : null,
        responsavelNome: responsavel ? responsavel.nome : null,
    });
});

// GET /demandas/:id/comentarios
router.get('/:id/comentarios', (req: Request, res: Response) => {
    const demanda = buscarDemanda(String(req.params.id));

    if (!demanda) {
        res.status(404).json({ erro: 'Demanda não encontrada.' });
        return;
    }

    // Pega só os comentários desta demanda e coloca o nome de quem comentou
    const doDemanda = comentarios
        .filter((comentario) => comentario.demandaId === demanda.id)
        .map((comentario) => {
            const autor = usuarios.find((u) => u.id === comentario.usuarioId);
            return { ...comentario, usuarioNome: autor ? autor.nome : null };
        });

    // Se ainda não tiver comentários, a resposta é uma lista vazia (e não um erro)
    res.status(200).json(doDemanda);
});

// POST /demandas/:id/comentarios
// Corpo esperado (JSON): { "usuarioId": 3, "texto": "Meu comentário" }
router.post('/:id/comentarios', (req: Request, res: Response) => {
    const demanda = buscarDemanda(String(req.params.id));

    if (!demanda) {
        res.status(404).json({ erro: 'Demanda não encontrada.' });
        return;
    }

    // Se a requisição vier sem corpo, usamos um objeto vazio para não dar erro
    const corpo = req.body || {};

    // Texto: precisa ser um texto e não pode ser só espaços
    const texto = typeof corpo.texto === 'string' ? corpo.texto.trim() : '';
    if (texto === '') {
        res.status(400).json({ erro: 'O texto do comentário não pode ficar vazio.' });
        return;
    }

    // Usuário: o comentário precisa ser de alguém que existe
    if (typeof corpo.usuarioId !== 'number') {
        res.status(400).json({ erro: 'Informe o usuarioId (número) de quem está comentando.' });
        return;
    }
    const usuario = usuarios.find((u) => u.id === corpo.usuarioId);
    if (!usuario) {
        res.status(400).json({ erro: 'O usuário informado não existe.' });
        return;
    }

    // Id novo = maior id existente + 1. Data e hora são do servidor, não do cliente.
    const proximoId = comentarios.length > 0 ? Math.max(...comentarios.map((c) => c.id)) + 1 : 1;
    const novoComentario: Comentario = {
        id: proximoId,
        demandaId: demanda.id,
        usuarioId: usuario.id,
        texto: texto,
        dataHora: new Date().toISOString(),
    };
    comentarios.push(novoComentario);

    res.status(201).json({ ...novoComentario, usuarioNome: usuario.nome });
});

export default router;
