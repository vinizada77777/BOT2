# Solução de problemas

## `DATABASE_URL` não aparece

O Railway não entregou a variável ao processo do bot.

1. Abra o serviço do bot.
2. Entre em **Variables**.
3. Adicione `DATABASE_URL` como referência ao serviço PostgreSQL.
4. Salve.
5. Gere um novo deploy.

O diagnóstico mostra apenas nomes:

```text
⚠️ Variáveis obrigatórias ausentes: DATABASE_URL.
❌ PostgreSQL indisponível. Bot encerrado.
```

## PostgreSQL aparece, mas a conexão falha

Verifique:

- se a referência pertence ao mesmo ambiente Railway;
- se o serviço PostgreSQL está ativo;
- se a URL não contém aspas;
- se foi usado o endereço interno para serviços no mesmo projeto;
- se `PGSSLMODE=disable` é necessário para a URL interna.

Não cole a URL completa em tickets ou mensagens.

## O bot conecta, mas comandos não aparecem

Execute:

```text
npm run deploy
```

Confirme `CLIENT_ID` e `GUILD_ID`. O token deve pertencer à mesma aplicação.

## `This interaction failed`

Procure o identificador de correlação no log. Causas comuns:

- permissão do bot insuficiente;
- cargo do bot abaixo do cargo VGS;
- canal apagado durante a operação;
- indisponibilidade temporária do Discord.

## `/setup` encontrou duplicatas

O setup escolhe um recurso canônico e não apaga os outros. A mensagem informa a quantidade detectada. Compare os IDs no log antes de excluir qualquer recurso manualmente.

## O candidato não recebeu cargo ou nick

A decisão permanece salva no PostgreSQL. Corrija a posição do cargo do bot e pressione novamente o mesmo botão; a operação é idempotente e tentará concluir a sincronização sem criar outra decisão.

## O painel da meta sumiu

Execute `/setup` ou reinicie o bot. Se a meta estiver ativa e o canal existir, o painel é restaurado e o novo ID é salvo.

## Importação de arquivos JSON locais

Use apenas quando os dados antigos não existirem em `bot_store`:

```text
npm run import:legacy-files -- caminho/para/data
```

O diretório deve conter arquivos no formato antigo, como `config-<guild>.json` e `meta-<guild>.json`. Faça backup antes.
