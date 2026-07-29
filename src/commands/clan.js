'use strict';

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('Mostra informações e objetivos do VGS.'),

  async execute(interaction) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.GOLD)
          .setTitle('👑 VIGARISTAS • VGS')
          .setDescription([
            'Clã de Minecraft RankUp focado em união, organização e evolução.',
            '',
            '🏆 Objetivos: Top 1 Money, Top 1 Tokens e Top 1 Clã.',
            '',
            '**Foco • Disciplina • União • Constância**'
          ].join('\n'))
      ]
    });
  }
};
