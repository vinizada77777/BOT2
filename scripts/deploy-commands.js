'use strict';

require('dotenv').config({ quiet: true });

const { REST, Routes } = require('discord.js');
const { loadDeployConfig } = require('../src/config/environment');
const { loadCommands } = require('../src/discord/loaders');
const { createLogger } = require('../src/observability/logger');

async function deployCommands() {
  const logger = createLogger();
  const config = loadDeployConfig();
  const body = loadCommands().map((command) => command.data.toJSON());
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);
  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(route, { body });
  logger.info(`✅ ${body.length} comandos registrados ${config.guildId ? 'no servidor configurado' : 'globalmente'}.`);
}

deployCommands().catch((error) => {
  const logger = createLogger();
  logger.error('❌ Falha ao registrar comandos.', error);
  process.exitCode = 1;
});

module.exports = { deployCommands };
