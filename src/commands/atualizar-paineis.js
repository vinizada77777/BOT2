'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('atualizar-paineis')
    .setDescription('Atualiza os painéis do servidor e o painel da meta ativa.'),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    const result = await context.services.setup.reconcile(interaction.guild, interaction.user.id);
    await context.services.goals.refreshPanel(interaction.guild).catch(() => null);
    await interaction.editReply(`✅ Painéis atualizados. Versão do setup: ${result.setupVersion}.`);
  }
};
