# VIGARISTAS (VGS) Bot V4 — Especificação de reconstrução

Data: 2026-07-28  
Status: aprovado pelo usuário
Base: V4.0.2 do ZIP `VIGARISTAS-VGS-BOT-V4.0.2-POSTGRES-CORRIGIDO.zip`

## 1. Objetivo

Reconstruir o bot VGS sobre o código real da V4.0.2, mantendo os recursos úteis e substituindo o armazenamento híbrido por PostgreSQL relacional. O bot deve iniciar no Railway somente quando configuração, banco, migrações e conexão com o Discord estiverem válidos.

A entrega cobre:

- diagnóstico seguro das variáveis de ambiente;
- inicialização e encerramento previsíveis;
- migrações automáticas de banco;
- importação idempotente dos dados antigos;
- `/setup` idempotente;
- recrutamento completo;
- metas e contribuições;
- ranking, perfil e histórico;
- logs e auditoria;
- painéis persistentes;
- documentação, testes e empacotamento para Railway/GitHub.

O bot será usado inicialmente em um único servidor Discord. Todas as entidades persistidas terão `guild_id` para evitar uma limitação estrutural futura, mas a V4 não incluirá funções administrativas para múltiplos servidores.

## 2. Decisões de arquitetura

### 2.1 Plataforma

- Node.js 20 ou superior.
- JavaScript CommonJS.
- Discord.js 14.
- PostgreSQL por meio do pacote `pg`.
- Consultas SQL parametrizadas e migrações versionadas mantidas no projeto.
- Testes com o test runner nativo do Node.

Não haverá ORM nem etapa de compilação. Essa escolha reduz os pontos de falha no Railway e mantém o funcionamento do SQL explícito.

### 2.2 Inicialização

`index.js` será apenas o ponto de composição. A ordem obrigatória será:

1. carregar `.env` somente quando disponível no ambiente local;
2. validar `TOKEN`, `CLIENT_ID`, `GUILD_ID` e `DATABASE_URL`;
3. imprimir o diagnóstico de presença das variáveis;
4. abrir o pool PostgreSQL e executar `SELECT 1`;
5. aplicar migrações pendentes;
6. importar dados antigos quando aplicável;
7. montar serviços, comandos e eventos;
8. conectar o cliente Discord.

Qualquer falha nas etapas 2 a 6 encerrará o processo com código diferente de zero. A mensagem operacional será:

```text
❌ PostgreSQL indisponível. Bot encerrado.
```

O erro técnico será registrado sem incluir credenciais ou a URL de conexão.

### 2.3 Organização

O projeto será separado por responsabilidade:

```text
src/
  config/
  db/
    migrations/
  repositories/
  services/
  commands/
  interactions/
  events/
  panels/
  discord/
  observability/
  utils/
scripts/
tests/
```

Comandos e handlers traduzirão entradas do Discord para chamadas de serviço. Serviços conterão regras de negócio. Repositórios concentrarão SQL. Painéis serão renderizadores sem acesso direto ao banco. O número final de arquivos será consequência desses limites, não uma meta artificial.

## 3. Diagnóstico e configuração

O diagnóstico trabalhará com uma lista permitida de nomes:

- `TOKEN`
- `CLIENT_ID`
- `GUILD_ID`
- `DATABASE_URL`
- `PGSSLMODE`
- variáveis PostgreSQL alternativas aceitas apenas para compatibilidade

O log mostrará `presente` ou `ausente`, nunca valores. Não será usado `Object.entries(process.env)` para despejar o ambiente inteiro. Erros do driver terão URLs e credenciais removidas antes de serem exibidos.

`DATABASE_URL` será a configuração canônica no Railway. Variáveis PostgreSQL separadas poderão formar uma URL somente quando todos os campos necessários estiverem presentes. Referências Railway não resolvidas, como `${{...}}`, serão rejeitadas.

## 4. Modelo relacional

### 4.1 Tabelas de infraestrutura

- `schema_migrations`: versão e data de cada migração aplicada.
- `legacy_imports`: origem, impressão digital, data, resultado e contagens da importação antiga.
- `guild_settings`: `guild_id`, versão do setup, fuso horário e datas.
- `configs`: `guild_id`, chave, valor textual e data. Armazena IDs de cargos, categorias e canais.
- `panels`: `guild_id`, chave do painel, `channel_id`, `message_id`, revisão e datas.
- `logs`: evento, `guild_id`, autor, alvo, entidade, identificador da entidade, mensagem segura, identificador de correlação e data.

### 4.2 Membros e recrutamento

- `members`: `guild_id`, `user_id`, nick, estado no clã, datas de entrada, atualização e saída.
- `recruits`: identificador, `guild_id`, `user_id`, respostas do formulário, canal privado, estado, avaliador e datas.
- `recruit_images`: identificador, inscrição, URL Discord, nome, tipo MIME, tamanho e data.

Uma restrição parcial permitirá no máximo uma inscrição nos estados ativos por usuário e servidor. Estados aceitos:

```text
awaiting_photo
pending
processing
approved
rejected
cancelled
failed
```

### 4.3 Metas e contribuições

- `goals`: identificador, `guild_id`, nome, tipo, objetivo, estado, criador, painel e datas.
- `contributions`: identificador, meta, `guild_id`, usuário, valor `NUMERIC`, comprovante, observação, estado, avaliador e datas.

Uma restrição parcial permitirá apenas uma meta ativa por servidor. Cada contribuição permanecerá vinculada à meta em que foi criada, e cada usuário poderá manter no máximo uma contribuição pendente por meta. A soma oficial será calculada a partir das contribuições aprovadas; não haverá um contador independente sujeito a divergência.

Estados de contribuição:

```text
pending
processing
approved
rejected
cancelled
```

## 5. Migração de dados antigos

Após criar o novo schema, o migrador verificará se a tabela antiga `bot_store` existe. Quando existir, converterá:

- `config-*` em `guild_settings`, `configs` e `panels`;
- `applications-*` em `recruits` e `recruit_images`;
- `meta-*` em `goals`;
- `pending-meta-*` em `contributions`;
- `history-meta-*` em contribuições históricas aprovadas quando ainda não representadas.

A importação ocorrerá em transação, terá impressão digital e será idempotente. Registros inválidos serão contabilizados e registrados sem expor dados sensíveis. Uma falha estrutural interromperá a inicialização; registros individuais incompatíveis serão enviados para um relatório de migração e não serão inventados.

Arquivos em `data/*.json` não serão lidos na inicialização normal. O projeto terá um comando separado, executado conscientemente, para importar arquivos locais antigos. A aplicação em produção nunca usará JSON como fallback ou fonte de verdade.

## 6. `/setup` idempotente

O setup seguirá esta ordem:

1. obter recurso pelo ID salvo;
2. se o ID não for válido, procurar por nome normalizado e tipo;
3. criar somente quando não existir candidato seguro;
4. corrigir propriedades administradas pelo bot;
5. salvar o ID imediatamente;
6. atualizar o painel conhecido com `message.edit`;
7. criar uma mensagem somente quando a anterior não existir;
8. registrar o resultado e incrementar a versão do setup.

O bot administrará cargos, categorias, canais, permissões e painéis definidos no template. Não excluirá recursos desconhecidos nem duplicatas antigas automaticamente. Conflitos serão relatados com os IDs envolvidos para revisão humana.

Executar `/setup` repetidamente deverá manter os mesmos IDs e a mesma quantidade de recursos quando nada tiver sido removido.

## 7. Recrutamento

Fluxo:

```text
botão → modal → registro SQL → canal privado → foto → painel da liderança
→ decisão → cargo/nick → membro/logs → fechamento do canal
```

Regras:

- o botão rejeita nova inscrição quando já houver uma ativa;
- o modal valida nick, idade e campos obrigatórios;
- o canal privado permite acesso apenas ao candidato e à liderança;
- somente uma imagem válida será aceita como comprovante principal;
- a decisão usa transação e bloqueio de linha;
- uma segunda decisão para a mesma inscrição retorna o resultado já existente;
- aprovação remove cargos transitórios, adiciona o cargo de membro e tenta aplicar `[VGS] <nick>`;
- falha ao enviar mensagem privada não desfaz a aprovação;
- falha essencial em cargo ou permissão deixa a inscrição recuperável, com log;
- o canal é fechado apenas após a persistência do resultado.

Como PostgreSQL e Discord não compartilham uma transação, passos externos serão idempotentes. Estados intermediários e identificadores persistidos permitirão retomar uma operação sem repetir efeitos.

## 8. Metas, ranking, perfil e histórico

`/criar-meta` criará uma meta e encerrará explicitamente a meta ativa anterior. `/registrar-meta` validará valor positivo, imagem e ausência de outra contribuição pendente do mesmo usuário na mesma meta.

A aprovação da contribuição bloqueará o registro, confirmará a meta original e mudará o estado em transação. Ranking e progresso serão agregações SQL de contribuições aprovadas.

- `/metas`: meta ativa, total, percentual e contribuição do usuário.
- `/ranking`: maiores contribuidores da meta, com desempate determinístico.
- `/perfil`: cargo Discord, vínculo VGS, meta atual e totais.
- `/historico`: últimas contribuições aprovadas do usuário.

Painéis de meta serão atualizados depois do commit. Se o Discord estiver temporariamente indisponível, o banco continuará correto e a próxima atualização reconstruirá o painel.

## 9. Painéis e interações persistentes

Cada painel terá uma chave estável em `panels`. O conteúdo será gerado por renderizadores puros. Botões usarão identificadores estáveis e handlers registrados no início, portanto continuarão funcionando depois de reinicializações.

Atualizações seguirão:

1. buscar o painel persistido;
2. buscar a mensagem Discord;
3. editar a mensagem;
4. se ela não existir, criar uma única substituta e trocar o ID em transação.

## 10. Segurança, erros e observabilidade

- Consultas sempre parametrizadas.
- Validação de IDs, limites de texto, valores e anexos.
- Permissão verificada na entrada e no serviço.
- Resposta rápida ou `deferReply`/`deferUpdate` para toda interação demorada.
- Mensagens públicas sem stack trace ou detalhes internos.
- Logs com identificador de correlação.
- Eventos de auditoria para setup, recrutamento, metas, decisões e falhas.
- Tratamento de `SIGTERM` e `SIGINT` para fechar Discord e pool.
- Nenhum segredo em README, fixtures, logs ou ZIP.

## 11. Testes e validação

### 11.1 Automatizados

- validação e diagnóstico do ambiente;
- resolução da configuração PostgreSQL;
- migrações em banco descartável;
- importação antiga e repetição idempotente;
- repositórios e restrições de concorrência;
- transições de estado;
- permissões;
- renderização de painéis;
- setup executado duas vezes sem criar recursos;
- aprovação concorrente de recrutamento e contribuição;
- comandos com Discord simulado.

### 11.2 Verificações de entrega

- `npm run check`: sintaxe e estrutura.
- `npm test`: testes que não exigem serviços externos.
- `npm run test:integration`: PostgreSQL de teste.
- `npm audit --omit=dev`: relatório de dependências.
- teste de boot com variáveis ausentes e banco indisponível;
- teste de encerramento controlado;
- inspeção do ZIP para impedir `.env`, `node_modules`, `.git` e dados locais.

A conexão final ao Railway e ao servidor Discord depende das credenciais e permissões do proprietário. A documentação fornecerá um checklist objetivo, e a entrega não afirmará que essa etapa ocorreu sem evidência.

## 12. Entregáveis

- código V4 completo;
- migrações SQL automáticas;
- importador legado;
- testes;
- `.env.example`;
- `README.md`;
- `CHANGELOG.md`;
- guia de Railway e solução de problemas;
- ZIP limpo;
- repositório local organizado e pronto para publicação no GitHub.

## 13. Critérios de aceitação

1. Sem `DATABASE_URL`, o bot não conecta ao Discord e encerra com erro.
2. O diagnóstico nunca revela valores.
3. Não existe fallback operacional em JSON.
4. Uma instalação vazia cria todas as tabelas automaticamente.
5. A importação antiga pode ser repetida sem duplicar dados.
6. Duas execuções de `/setup` preservam IDs e quantidades.
7. Um usuário não mantém duas inscrições ativas.
8. Uma inscrição ou contribuição não pode receber duas decisões.
9. Ranking, perfil e histórico refletem exclusivamente dados SQL aprovados.
10. Reiniciar o bot preserva painéis e botões.
11. Falhas parciais do Discord ficam auditáveis e recuperáveis.
12. O ZIP final não contém segredos, dependências instaladas ou dados locais.

## 14. Fora do escopo

- painel web;
- armazenamento próprio das imagens fora do Discord;
- administração de múltiplos servidores na interface;
- exclusão automática de canais, cargos ou mensagens duplicados preexistentes;
- publicação automática no GitHub ou deploy no Railway sem autorização e credenciais.
