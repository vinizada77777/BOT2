'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { requiredText, positiveAmount } = require('../utils/validation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('criar-meta')
    .setDescription('Cria uma meta e encerra a meta ativa anterior.')
    .addStringOption((option) =>
      option.setName('nome').setDescription('Nome da meta').setRequired(true))
    .addStringOption((option) =>
      option
        .setName('tipo')
        .setDescription('Tipo da meta')
        .setRequired(true)
        .addChoices(
          { name: 'Money', value: 'money' },
          { name: 'Tokens', value: 'tokens' }
        ))
    .addNumberOption((option) =>
      option.setName('objetivo').setDescription('Valor objetivo').setRequired(true).setMinValue(1)),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    const goal = await context.services.goals.createGoal(interaction.guild, interaction.user, {
      name: requiredText(interaction.options.getString('nome'), 'Nome', 200),
      goalType: interaction.options.getString('tipo'),
      target: positiveAmount(interaction.options.getNumber('objetivo'))
    });
    await interaction.editReply(`✅ Meta **${goal.name}** criada e painel atualizado.`);
  }
};
