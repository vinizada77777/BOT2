'use strict';

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');
const { formatNumber } = require('../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Mostra o ranking da meta atual.'),

  async execute(interaction, context) {
    const goal = await context.repositories.goals.getActiveGoal(interaction.guildId);
    if (!goal) return interaction.reply({ content: 'Nenhuma meta ativa.', ephemeral: true });
    const ranking = await context.repositories.goals.getRanking(goal.id, 10);
    const text = ranking.length
      ? ranking.map((entry, index) => `${index + 1}º <@${entry.user_id}> — **${formatNumber(entry.total)}**`).join('\n')
      : 'Nenhuma contribuição aprovada.';
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.GOLD)
          .setTitle('🏆 Ranking de Contribuições')
          .setDescription(text)
          .setFooter({ text: goal.name })
      ]
    });
  }
};
