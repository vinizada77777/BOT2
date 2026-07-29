'use strict';

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');
const { formatNumber } = require('../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('historico')
    .setDescription('Mostra suas últimas contribuições aprovadas.'),

  async execute(interaction, context) {
    const records = await context.repositories.goals.getUserHistory(
      interaction.guildId,
      interaction.user.id,
      10
    );
    const text = records.length
      ? records.map((record) => {
        const unit = record.goal_type === 'money' ? 'Money' : 'Tokens';
        const unix = Math.floor(new Date(record.reviewed_at).getTime() / 1000);
        return `• **${record.goal_name}** — ${formatNumber(record.amount)} ${unit} • <t:${unix}:d>`;
      }).join('\n')
      : 'Você ainda não possui contribuições aprovadas.';
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.GOLD)
          .setTitle('📜 Seu Histórico')
          .setDescription(text)
      ],
      ephemeral: true
    });
  }
};
