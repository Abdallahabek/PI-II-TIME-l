-- Autor: Abdallah Ali Borges El Khatib
-- Carga inicial de usuarios, projetos, vinculos, demandas, comentarios e historico

-- Usuarios cobrindo os tres perfis exigidos
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (1, 'Carlos Santos', 'admin@puc.br', 'Admin123', 'Administrador');
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (2, 'Mariana Silva', 'lider@puc.br', 'Lider123', 'Líder de Projeto');
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (3, 'Abdallah Khatib', 'abdallah@puc.br', 'Dev123', 'Membro da Equipe');
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (4, 'Vinicius Morais', 'vinicius@puc.br', 'Dev123', 'Membro da Equipe');
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (5, 'Enrico Pacheco', 'enrico@puc.br', 'Dev123', 'Membro da Equipe');
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (6, 'Lucas Ruman', 'lucas@puc.br', 'Dev123', 'Membro da Equipe');

-- Projetos pre-cadastrados
INSERT INTO projetos (id, nome, descricao, data_criacao) VALUES (1, 'Portal de Atendimento ao Cliente', 'Plataforma web para autoatendimento e abertura de chamados.', DATE '2026-01-15');
INSERT INTO projetos (id, nome, descricao, data_criacao) VALUES (2, 'Sistema de Faturamento Automatico', 'Modulo backend para emissao e conciliacao de faturas fiscais.', DATE '2026-02-01');
INSERT INTO projetos (id, nome, descricao, data_criacao) VALUES (3, 'App Mobile de Logistica e Entregas', 'Aplicativo para rastreamento de entregas em tempo real.', DATE '2026-03-10');

-- Vinculos de usuarios aos projetos
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (2, 1);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (2, 2);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (3, 1);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (3, 2);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (4, 1);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (4, 3);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (5, 1);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (6, 2);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (6, 3);

-- Demandas de demonstracao com tipos, prioridades, status e prazos variados
INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (1, 'Falha critica de autenticacao no portal', 'Usuarios nao conseguem logar com caracteres especiais no e-mail.', 'Defeito', 'Crítica', 'Aberta', 1, 5, SYSTIMESTAMP - 5, SYSTIMESTAMP - 1, TRUNC(SYSDATE) + 2);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (2, 'Implementar exportacao de relatorios em PDF', 'Permitir baixar faturas consolidadas do mes em formato PDF.', 'Melhoria', 'Alta', 'Em andamento', 2, 6, SYSTIMESTAMP - 10, SYSTIMESTAMP - 2, TRUNC(SYSDATE) + 4);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (3, 'Vazamento de memoria no servico de notas fiscais', 'Servico reinicia apos 1000 requisicoes simultaneas.', 'Defeito', 'Crítica', 'Em andamento', 2, 3, SYSTIMESTAMP - 3, SYSTIMESTAMP - 1, TRUNC(SYSDATE) + 3);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (4, 'Elaborar documentacao da API REST', 'Descrever rotas, codigos HTTP e exemplos de payload.', 'Documentação', 'Baixa', 'Em revisão', 1, 4, SYSTIMESTAMP - 15, SYSTIMESTAMP - 3, TRUNC(SYSDATE) + 20);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (5, 'Criar tela de perfil do motorista', 'Construir tela para visualizacao de rotas e dados do dia.', 'Tarefa', 'Média', 'Aberta', 3, NULL, SYSTIMESTAMP - 2, SYSTIMESTAMP - 2, TRUNC(SYSDATE) + 15);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (6, 'Ajuste no timeout de consulta ao GPS', 'Aumentar timeout de 3s para 8s no rastreamento.', 'Melhoria', 'Alta', 'Concluída', 3, 6, SYSTIMESTAMP - 20, SYSTIMESTAMP - 5, TRUNC(SYSDATE) - 6);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (7, 'Integracao legada com ERP antigo', 'Demanda cancelada apos decisao de migracao para ERP em nuvem.', 'Tarefa', 'Baixa', 'Cancelada', 2, 2, SYSTIMESTAMP - 30, SYSTIMESTAMP - 10, NULL);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (8, 'Falha na sincronizacao de notificacoes push', 'Dispositivos iOS nao recebem alertas em segundo plano.', 'Defeito', 'Crítica', 'Aberta', 3, 4, SYSTIMESTAMP - 1, SYSTIMESTAMP - 1, TRUNC(SYSDATE) + 1);

-- Comentarios iniciais
INSERT INTO comentarios (id, demanda_id, usuario_id, texto, data_criacao)
VALUES (1, 1, 2, 'Priorizar a correcao deste defeito por impactar o acesso dos clientes.', SYSTIMESTAMP - 1);

INSERT INTO comentarios (id, demanda_id, usuario_id, texto, data_criacao)
VALUES (2, 1, 5, 'Validacao da expressao regular identificada, ajustando os testes.', SYSTIMESTAMP - INTERVAL '12' HOUR);

INSERT INTO comentarios (id, demanda_id, usuario_id, texto, data_criacao)
VALUES (3, 2, 6, 'Biblioteca de PDF configurada no servidor.', SYSTIMESTAMP - 2);

-- Historico inicial de exemplo
INSERT INTO historico_alteracoes (id, demanda_id, usuario_id, campo_alterado, valor_anterior, valor_novo, descricao, data_alteracao)
VALUES (1, 2, 6, 'status', 'Aberta', 'Em andamento', 'Lucas Ruman alterou o status da demanda de Aberta para Em andamento.', SYSTIMESTAMP - 2);

INSERT INTO historico_alteracoes (id, demanda_id, usuario_id, campo_alterado, valor_anterior, valor_novo, descricao, data_alteracao)
VALUES (2, 4, 4, 'status', 'Em andamento', 'Em revisão', 'Vinicius Morais alterou o status da demanda de Em andamento para Em revisão.', SYSTIMESTAMP - 3);

COMMIT;
