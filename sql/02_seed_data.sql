-- Autor: Abdallah Ali Borges El Khatib
-- Carga inicial de usuarios (senhas com hash scrypt), projetos, vinculos, demandas, comentarios e historico

-- Usuarios cobrindo os tres perfis exigidos (senhas armazenadas em hash scrypt$<salt>$<hash>)
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (1, 'Carlos Santos', 'admin@puc.br', 'scrypt$f91b2d18169dca3dee5f5c813d8b38dc$1c07c630a19eb765145a188ac4c9a9f24360b14074e2ddc35e445f307784494151807712c05d99f36ef28d94ad10ee0ffffa35dc79e02e9aa1ef43caee303470', 'Administrador');
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (2, 'Mariana Silva', 'lider@puc.br', 'scrypt$4b8526b1948aab3f246f7b01de7dcd93$a7e92778e0b16a3cfe1e595852367f41135bedc160f9e6e26df8c9ae908b454a9e465926a3dff13392c9e1d653c8dae7650c97f84f3893a992a69e503e0bd597', 'Líder de Projeto');
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (3, 'Abdallah Khatib', 'abdallah@puc.br', 'scrypt$b0193539962ec48960ca09ff44956511$13ad111e0c5a05d405ac1dc1edfff0402095afcb88214dee4f21b93b73dc63240ca74d4da6a7326d219603e427001316a42cd33257036f192216e71662da0c8b', 'Membro da Equipe');
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (4, 'Vinicius Morais', 'vinicius@puc.br', 'scrypt$2657d6be18484d3ef8599169d25c46aa$b63641da4fc88b0f5350809ece82c00960993e06ab2c586e006e7ff17a30f2d07ba98d031934bf670c38505cea084cf1b2a8b7fbd8a9a7ffb217497724a610f9', 'Membro da Equipe');
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (5, 'Enrico Pacheco', 'enrico@puc.br', 'scrypt$fdfdeb809cdc0c552a483ab4ee50c965$9edf4db2ae3d558967639964e23be659cffd053d229a14aecc43e11f204efa9eef4c74ac7ebd278762089625c10e046c1676d876ab390a2e94153633858ec330', 'Membro da Equipe');
INSERT INTO usuarios (id, nome, email, senha, perfil) VALUES (6, 'Lucas Ruman', 'lucas@puc.br', 'scrypt$88cc9e65a3ef9e20e047bff6acffb2d8$a4b42f83cd0880ce8bf1caddd27ead1ef6eedcd4619cc9015f13e976025a01dc9b0cf4a046a29b54a0c322772f941a99e7f88f41232547815393d1add471cbe2', 'Membro da Equipe');

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

-- Demandas de demonstracao com tipos, prioridades, status e prazos variados (em UTC)
INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (1, 'Falha critica de autenticacao no portal', 'Usuarios nao conseguem logar com caracteres especiais no e-mail.', 'Defeito', 'Crítica', 'Aberta', 1, 5, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '5' DAY, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '1' DAY, TRUNC(SYSDATE) + 2);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (2, 'Implementar exportacao de relatorios em PDF', 'Permitir baixar faturas consolidadas do mes em formato PDF.', 'Melhoria', 'Alta', 'Em andamento', 2, 6, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '10' DAY, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '2' DAY, TRUNC(SYSDATE) + 4);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (3, 'Vazamento de memoria no servico de notas fiscais', 'Servico reinicia apos 1000 requisicoes simultaneas.', 'Defeito', 'Crítica', 'Em andamento', 2, 3, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '3' DAY, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '1' DAY, TRUNC(SYSDATE) + 3);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (4, 'Elaborar documentacao da API REST', 'Descrever rotas, codigos HTTP e exemplos de payload.', 'Documentação', 'Baixa', 'Em revisão', 1, 4, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '15' DAY, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '3' DAY, TRUNC(SYSDATE) + 20);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (5, 'Criar tela de perfil do motorista', 'Construir tela para visualizacao de rotas e dados do dia.', 'Tarefa', 'Média', 'Aberta', 3, NULL, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '2' DAY, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '2' DAY, TRUNC(SYSDATE) + 15);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (6, 'Ajuste no timeout de consulta ao GPS', 'Aumentar timeout de 3s para 8s no rastreamento.', 'Melhoria', 'Alta', 'Concluída', 3, 6, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '20' DAY, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '5' DAY, TRUNC(SYSDATE) - 6);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (7, 'Integracao legada com ERP antigo', 'Demanda cancelada apos decisao de migracao para ERP em nuvem.', 'Tarefa', 'Baixa', 'Cancelada', 2, 2, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '30' DAY, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '10' DAY, NULL);

INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (8, 'Falha na sincronizacao de notificacoes push', 'Dispositivos iOS nao recebem alertas em segundo plano.', 'Defeito', 'Crítica', 'Aberta', 3, 4, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '1' DAY, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '1' DAY, TRUNC(SYSDATE) + 1);

-- Demanda em aberto ja vencida para demonstrar alertas de atraso no Dashboard
INSERT INTO demandas (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo_finalizacao)
VALUES (9, 'Corrigir lentidao na emissao de protocolos de atendimento', 'Consulta de historico de atendimentos excede 10 segundos em horarios de pico.', 'Defeito', 'Alta', 'Em andamento', 1, 3, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '8' DAY, SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '2' DAY, TRUNC(SYSDATE) - 2);

-- Comentarios iniciais
INSERT INTO comentarios (id, demanda_id, usuario_id, texto, data_criacao)
VALUES (1, 1, 2, 'Priorizar a correcao deste defeito por impactar o acesso dos clientes.', SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '1' DAY);

INSERT INTO comentarios (id, demanda_id, usuario_id, texto, data_criacao)
VALUES (2, 1, 5, 'Validacao da expressao regular identificada, ajustando os testes.', SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '12' HOUR);

INSERT INTO comentarios (id, demanda_id, usuario_id, texto, data_criacao)
VALUES (3, 2, 6, 'Biblioteca de PDF configurada no servidor.', SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '2' DAY);

-- Historico inicial de exemplo
INSERT INTO historico_alteracoes (id, demanda_id, usuario_id, campo_alterado, valor_anterior, valor_novo, descricao, data_alteracao)
VALUES (1, 2, 6, 'status', 'Aberta', 'Em andamento', 'Lucas Ruman alterou o status da demanda de Aberta para Em andamento.', SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '2' DAY);

INSERT INTO historico_alteracoes (id, demanda_id, usuario_id, campo_alterado, valor_anterior, valor_novo, descricao, data_alteracao)
VALUES (2, 4, 4, 'status', 'Em andamento', 'Em revisão', 'Vinicius Morais alterou o status da demanda de Em andamento para Em revisão.', SYS_EXTRACT_UTC(SYSTIMESTAMP) - INTERVAL '3' DAY);

COMMIT;
