'use strict';

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');
const { formatNumber, progressBar } = require('../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('metas')
    .setDescription('Mostra a meta ativa e seu progresso.'),

  async execute(interaction, context) {
    const goal = await context.repositories.goals.getActiveGoal(interaction.guildId);
    if (!goal) {
      return interaction.reply({ content: 'Nenhuma meta ativa.', ephemeral: true });
    }
    const summary = await context.repositories.goals.getUserSummary(interaction.guildId, interaction.user.id);
    const own = summary.active_total;
    const percentage = Number(goal.target) > 0 ? (Number(own) / Number(goal.target)) * 100 : 0;
    const unit = goal.goal_type === 'money' ? 'Money' : 'Tokens';
    const embed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle(`🎯 ${goal.name}`)
      .setDescription([
        progressBar(goal.current, goal.target),
        '',
        `**${formatNumber(goal.current)} / ${formatNumber(goal.target)} ${unit}**`,
        '',
        `Sua contribuição: **${formatNumber(own)}** (${percentage.toFixed(2)}% da meta)`
      ].join('\n'))
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
