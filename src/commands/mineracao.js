'use strict';

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');
const { formatDuration } = require('../services/MiningService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mineracao')
    .setDescription('Controla sua sessão de mineração.')
    .addSubcommand((subcommand) =>
      subcommand.setName('iniciar').setDescription('Inicia uma sessão de mineração.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('finalizar').setDescription('Finaliza sua sessão de mineração.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Mostra o estado e seu histórico de mineração.')),

  async execute(interaction, context) {
    const action = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    if (action === 'iniciar') {
      const session = await context.services.mining.start(
        interaction.guild,
        interaction.user,
        interaction.channelId
      );
      return interaction.editReply(`✅ Mineração iniciada. Sessão **#${session.id}**. Quando terminar, use \`/mineracao finalizar\`.`);
    }

    if (action === 'finalizar') {
      const session = await context.services.mining.finish(
        interaction.guild,
        interaction.user,
        interaction.channelId
      );
      return interaction.editReply(`✅ Mineração finalizada. Duração: **${formatDuration(session.duration_seconds)}**.`);
    }

    const { active, summary } = await context.services.mining.status(
      interaction.guildId,
      interaction.user.id
    );
    const description = active
      ? `🟢 Você está minerando desde <t:${Math.floor(new Date(active.started_at).getTime() / 1000)}:R>.`
      : '⚪ Você não possui uma mineração em andamento.';
    const embed = new EmbedBuilder()
      .setColor(active ? COLORS.GREEN : COLORS.GOLD)
      .setTitle('⛏️ Status de mineração')
      .setDescription(description)
      .addFields(
        { name: 'Sessões finalizadas', value: String(summary.finished_count || 0), inline: true },
        { name: 'Tempo total', value: formatDuration(summary.total_seconds || 0), inline: true },
        { name: 'Maior sessão', value: formatDuration(summary.longest_seconds || 0), inline: true }
      )
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }
};
