# VIGARISTAS VGS BOT — V5.2.0

Bot Discord do clã VGS com PostgreSQL e sincronização automática dos comandos.

## Sistemas

- `/setup` inteligente e resiliente
- Recrutamento com formulário, foto, aprovação e nickname
- Metas de Money/Tokens com comprovantes
- Ranking, perfil e histórico
- Controle de mineração com início, término, duração e console
- PostgreSQL com migrações automáticas
- Sincronização automática de todos os comandos ao iniciar

## Comandos

### Membros
- `/perfil`
- `/metas`
- `/ranking`
- `/historico`
- `/registrar-meta`
- `/mineracao iniciar`
- `/mineracao finalizar`
- `/mineracao status`
- `/regras`
- `/clan`
- `/ping`
- `/ajuda`
- `/comandos`

### Liderança
- `/criar-meta`
- `/editar-meta`
- `/encerrar-meta`
- `/atualizar-paineis`
- `/status`

### Administração
- `/setup`

## Variáveis do Railway

```env
TOKEN=
CLIENT_ID=
GUILD_ID=
DATABASE_URL=
```

## Railway

Start Command:

```text
npm start
```

Ao iniciar, o bot registra automaticamente os comandos no servidor configurado por `GUILD_ID`.
