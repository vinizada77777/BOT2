'use strict';

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('regras')
    .setDescription('Mostra as regras oficiais do VGS.'),

  async execute(interaction) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.GOLD)
          .setTitle('📜 Regras Oficiais VGS')
          .setDescription([
            '• Respeite todos os membros.',
            '• Utilize apenas uma conta oficial para mineração.',
            '• Não transfira Money ou Tokens sem autorização.',
            '• Envie comprovantes verdadeiros.',
            '• Siga as orientações da liderança.'
          ].join('\n'))
      ],
      ephemeral: true
    });
  }
};
