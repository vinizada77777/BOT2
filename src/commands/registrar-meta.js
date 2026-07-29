'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { isImageAttachment, positiveAmount, requiredText } = require('../utils/validation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('registrar-meta')
    .setDescription('Registra uma contribuição para aprovação.')
    .addNumberOption((option) =>
      option.setName('quantidade').setDescription('Quantidade contribuída').setRequired(true).setMinValue(1))
    .addAttachmentOption((option) =>
      option.setName('comprovante').setDescription('Imagem do comprovante').setRequired(true))
    .addStringOption((option) =>
      option.setName('observacao').setDescription('Observação')),

  async execute(interaction, context) {
    const proof = interaction.options.getAttachment('comprovante');
    if (!isImageAttachment(proof)) {
      return interaction.reply({
        content: '❌ O comprovante precisa ser uma imagem PNG, JPG, JPEG, WEBP ou GIF de até 10 MB.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });
    await context.services.goals.submitContribution(interaction.guild, interaction.user, {
      amount: positiveAmount(interaction.options.getNumber('quantidade')),
      proofUrl: proof.url,
      proofFilename: proof.name,
      proofContentType: proof.contentType,
      observation: interaction.options.getString('observacao')
        ? requiredText(interaction.options.getString('observacao'), 'Observação', 1000)
        : null
    });
    await interaction.editReply('✅ Contribuição enviada para aprovação.');
  }
};
