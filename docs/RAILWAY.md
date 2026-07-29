# Deploy no Railway

## 1. Serviços

Crie no mesmo projeto Railway:

1. um serviço PostgreSQL;
2. um serviço para o bot conectado ao repositório GitHub.

## 2. Variáveis do serviço do bot

Configure:

```text
TOKEN
CLIENT_ID
GUILD_ID
DATABASE_URL
```

Em `DATABASE_URL`, use a referência oferecida pelo serviço PostgreSQL. A variável precisa aparecer na aba **Variables do serviço do bot**.

Não coloque aspas, espaços extras nem o texto literal de uma referência que o Railway não resolveu.

## 3. Build e início

O projeto já fornece:

```text
npm start
```

Não é necessária etapa de compilação. O Railway instala as dependências a partir de `package-lock.json`.

## 4. Primeiro deploy

Nos logs, confirme nesta ordem:

```text
🔎 Variáveis presentes: TOKEN, CLIENT_ID, GUILD_ID, DATABASE_URL.
✅ PostgreSQL conectado.
✅ Migração aplicada: 001_initial_schema.sql
✅ VGS V4.1.0 online
```

Em uma atualização, migrações já aplicadas não serão repetidas.

## 5. Registrar comandos

Execute uma vez:

```text
npm run deploy
```

Com `GUILD_ID`, os comandos são registrados diretamente no servidor e costumam aparecer rapidamente.

## 6. Discord

1. Ative Server Members Intent.
2. Ative Message Content Intent.
3. Convide o bot com Administrador.
4. Coloque o cargo do bot acima dos cargos VGS.
5. Execute `/setup`.
6. Execute `/setup` novamente para confirmar que nada foi duplicado.

## 7. Migração da versão antiga

Faça backup do PostgreSQL antes do deploy. Se `bot_store` existir, a importação ocorrerá automaticamente. Procure no log:

```text
✅ Importação antiga concluída
```

ou:

```text
⚠️ Importação antiga concluída com avisos
```

Os detalhes seguros ficam no log, e a tabela antiga não é excluída.

## 8. Rollback

Em caso de falha:

1. não apague tabelas;
2. preserve o log do deploy;
3. volte temporariamente para o deploy anterior;
4. corrija a causa antes de gerar outro deploy.

Migrações aplicadas não devem ser editadas. Mudanças futuras precisam de um novo arquivo numerado.
