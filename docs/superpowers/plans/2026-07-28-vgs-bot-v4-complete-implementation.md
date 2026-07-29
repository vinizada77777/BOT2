# Plano de implementação — VIGARISTAS Bot V4.1.0

Referência: `docs/superpowers/specs/2026-07-28-vgs-bot-v4-complete-design.md`

## Etapa 1 — Fundação

1. Atualizar metadados, scripts e exclusões do projeto.
2. Criar `src/` com composição, configuração, erros e observabilidade.
3. Manter os assets existentes e retirar o armazenamento operacional antigo.
4. Criar testes de configuração antes de ligar o Discord.

Verificação: `npm run check` e testes de ambiente.

## Etapa 2 — PostgreSQL

1. Criar pool pequeno, timeouts e encerramento limpo.
2. Criar executor transacional reutilizável.
3. Criar migrador com advisory lock e tabela `schema_migrations`.
4. Criar schema relacional, constraints e índices.
5. Criar diagnóstico sanitizado e boot fail-fast.

Verificação: testes unitários do resolvedor de ambiente e teste de migração em PostgreSQL.

## Etapa 3 — Dados e regras de negócio

1. Implementar repositórios de configurações, painéis e membros.
2. Implementar repositórios de recrutamento e imagens.
3. Implementar repositórios de metas e contribuições.
4. Implementar logs e identificadores de correlação.
5. Implementar transições e decisões atômicas.
6. Implementar importação idempotente de `bot_store`.
7. Implementar importador opcional de arquivos JSON antigos.

Verificação: testes de constraints, transações concorrentes e repetição da importação.

## Etapa 4 — Discord

1. Implementar carregadores de comandos e eventos.
2. Implementar template de cargos, categorias e canais.
3. Implementar `/setup` por reconciliação, sem exclusão automática.
4. Implementar registro e atualização de painéis.
5. Implementar o fluxo completo de recrutamento.
6. Implementar metas, contribuições, ranking, perfil e histórico.
7. Implementar entrada de membro, permissões e mensagens seguras de erro.

Verificação: Discord simulado, setup repetido e decisões repetidas.

## Etapa 5 — Operação e entrega

1. Reescrever `index.js` e `deploy.js` como entradas mínimas.
2. Atualizar `.env.example`, README e CHANGELOG.
3. Criar guia de Railway e solução de problemas.
4. Rodar sintaxe, testes, integração disponível e auditoria.
5. Inspecionar arquivos e segredos.
6. Gerar ZIP reproduzível sem `.git`, `.env`, `node_modules` ou dados locais.

Verificação final: checklist dos 12 critérios de aceitação da especificação.
