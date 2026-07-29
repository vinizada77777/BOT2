'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('encerrar-meta')
    .setDescription('Encerra a meta ativa e preserva todo o histórico.')
    .addStringOption((option) =>
      option.setName('motivo').setDescription('Motivo do encerramento').setMaxLength(500)),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    const goal = await context.services.goals.closeActiveGoal(
      interaction.guild,
      interaction.user,
      interaction.options.getString('motivo') || 'Encerrada pela liderança.'
    );
    await interaction.editReply(`✅ Meta **${goal.name}** encerrada. O histórico foi preservado.`);
  }
};
