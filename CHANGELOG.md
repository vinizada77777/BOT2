# Changelog

## 5.2.0

- Restaurados e verificados todos os comandos existentes, incluindo `/metas`, `/criar-meta` e `/registrar-meta`.
- Adicionada sincronização automática dos comandos no evento `ready`.
- Adicionado `/mineracao iniciar`, `/mineracao finalizar` e `/mineracao status`.
- Adicionada tabela PostgreSQL `mining_sessions`.
- Adicionado console no canal `⛏️・controle-mineração`.
- O console registra jogador, horário de início, horário de término, duração e número da sessão.
- Impede duas sessões de mineração simultâneas para o mesmo jogador.
- Atualizada a versão exibida nos logs para V5.2.0.

## 5.1.0

- Setup inteligente e resiliente a cargos não editáveis.
