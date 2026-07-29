'use strict';

const {
  Client,
  GatewayIntentBits
} = require('discord.js');
const { environmentDiagnostic, loadRuntimeConfig } = require('./config/environment');
const { createLogger } = require('./observability/logger');
const { createDatabasePool, verifyDatabase } = require('./db/pool');
const { runMigrations } = require('./db/migrator');
const { LegacyImporter } = require('./db/legacyImporter');
const { createAppContext } = require('./appContext');
const { registerEvents } = require('./discord/loaders');
const { AppError } = require('./errors/AppError');

function createDiscordClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
}

async function bootstrap(options = {}) {
  const logger = options.logger || createLogger();
  const source = options.environment || process.env;
  const diagnostic = environmentDiagnostic(source);
  logger.info(`🔎 Variáveis presentes: ${diagnostic.present.length ? diagnostic.present.join(', ') : 'NENHUMA'}.`);
  if (diagnostic.missing.length) {
    logger.warn(`⚠️ Variáveis obrigatórias ausentes: ${diagnostic.missing.join(', ')}.`);
  }

  const config = loadRuntimeConfig(source);
  const pool = options.pool || createDatabasePool(config.database, logger);
  let client = null;

  try {
    await verifyDatabase(pool);
    logger.info('✅ PostgreSQL conectado.');
    await runMigrations(pool, { logger });
    const importer = new LegacyImporter({ pool, logger });
    await importer.importBotStore();

    const context = createAppContext({ config, pool, logger });
    client = options.client || createDiscordClient();
    registerEvents(client, context);
    await client.login(config.discord.token);

    const guild = await client.guilds.fetch(config.discord.guildId).catch(() => null);
    if (!guild) {
      throw new AppError(
        'GUILD_NOT_ACCESSIBLE',
        'O servidor configurado em GUILD_ID não está acessível ao bot.'
      );
    }

    let stopping = false;
    const shutdown = async (signal) => {
      if (stopping) return;
      stopping = true;
      logger.info(`🛑 Encerrando por ${signal}.`);
      client.destroy();
      await pool.end().catch((error) => logger.error('Falha ao fechar PostgreSQL.', error));
      logger.info('✅ Encerramento concluído.');
    };
    process.once('SIGTERM', () => void shutdown('SIGTERM'));
    process.once('SIGINT', () => void shutdown('SIGINT'));

    return { client, context, shutdown };
  } catch (error) {
    client?.destroy();
    await pool.end().catch(() => {});
    logger.error('❌ Falha na inicialização.', error);
    throw error;
  }
}

module.exports = { bootstrap, createDiscordClient };
