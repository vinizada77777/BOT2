'use strict';

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Verifica Discord, PostgreSQL, comandos e configuração do servidor.'),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    const started = Date.now();
    await context.pool.query('SELECT 1');
    const dbMs = Date.now() - started;
    const config = await context.repositories.guilds.getConfigs(interaction.guildId);
    const configuredChannels = Object.keys(config).filter((key) => key.startsWith('channel:')).length;
    const configuredRoles = Object.keys(config).filter((key) => key.startsWith('role:')).length;
    const embed = new EmbedBuilder()
      .setColor(COLORS.GREEN)
      .setTitle('✅ Status VGS V5.1')
      .addFields(
        { name: 'Discord', value: `${Math.max(0, interaction.client.ws.ping)} ms`, inline: true },
        { name: 'PostgreSQL', value: `Conectado • ${dbMs} ms`, inline: true },
        { name: 'Comandos carregados', value: String(context.commands.size), inline: true },
        { name: 'Canais configurados', value: String(configuredChannels), inline: true },
        { name: 'Cargos configurados', value: String(configuredRoles), inline: true },
        { name: 'Versão', value: '5.1.0', inline: true }
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }
};
