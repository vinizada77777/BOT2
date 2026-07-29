'use strict';

const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client, context) {
    context.logger.info(`✅ VGS V5.2.0 online como ${client.user.tag}.`);
    const guild = client.guilds.cache.get(context.config.discord.guildId)
      || await client.guilds.fetch(context.config.discord.guildId).catch(() => null);
    if (!guild) {
      context.logger.error('❌ Servidor configurado não encontrado durante o evento ready.');
      return;
    }

    try {
      const commandBody = context.commands.map((command) => command.data.toJSON());
      const registered = await guild.commands.set(commandBody);
      context.logger.info(`✅ ${registered.size} comandos sincronizados automaticamente no servidor.`);
    } catch (error) {
      context.logger.error('❌ Não foi possível sincronizar os comandos automaticamente.', error);
    }

    await context.services.goals.refreshPanel(guild).catch((error) => {
      context.logger.error('⚠️ Não foi possível restaurar o painel da meta ativa.', error);
    });
  }
};
