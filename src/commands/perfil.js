'use strict';

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');
const { formatNumber, progressBar } = require('../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Mostra seu perfil, meta atual e contribuição.'),

  async execute(interaction, context) {
    const [goal, summary, storedMember] = await Promise.all([
      context.repositories.goals.getActiveGoal(interaction.guildId),
      context.repositories.goals.getUserSummary(interaction.guildId, interaction.user.id),
      context.repositories.members.find(interaction.guildId, interaction.user.id)
    ]);
    const highestRole = interaction.member.roles.highest?.name || 'Sem cargo';
    const embed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setAuthor({
        name: `Perfil VGS • ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '👤 Cargo atual', value: highestRole, inline: true },
        {
          name: '🎮 Nick VGS',
          value: storedMember?.game_nick || 'Não registrado',
          inline: true
        },
        {
          name: '✅ Contribuições aprovadas',
          value: String(summary.approved_count || 0),
          inline: true
        }
      );

    if (goal) {
      const own = Number(summary.active_total || 0);
      const collectedShare = Number(goal.current) > 0 ? (own / Number(goal.current)) * 100 : 0;
      const targetShare = Number(goal.target) > 0 ? (own / Number(goal.target)) * 100 : 0;
      const unit = goal.goal_type === 'money' ? 'Money' : 'Tokens';
      embed.addFields(
        {
          name: '🎯 Meta atual',
          value: `**${goal.name}**\n${formatNumber(goal.current)} / ${formatNumber(goal.target)} ${unit}`
        },
        { name: '📊 Progresso geral', value: progressBar(goal.current, goal.target) },
        {
          name: '💰 Sua contribuição',
          value: `**${formatNumber(own)} ${unit}**\n${progressBar(own, goal.target)}\n${targetShare.toFixed(2)}% da meta total.`
        },
        {
          name: '🤝 Participação no arrecadado',
          value: `${collectedShare.toFixed(2)}% do valor já aprovado.`
        }
      );
    } else {
      embed.addFields({ name: '🎯 Meta atual', value: 'Nenhuma meta está ativa.' });
    }
    embed
      .addFields({
        name: '📜 Total histórico contribuído',
        value: formatNumber(summary.historical_total),
        inline: true
      })
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
