'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { requiredText, positiveAmount } = require('../utils/validation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editar-meta')
    .setDescription('Edita a meta ativa do clã.')
    .addStringOption((option) =>
      option.setName('nome').setDescription('Novo nome da meta'))
    .addNumberOption((option) =>
      option.setName('objetivo').setDescription('Novo valor objetivo').setMinValue(1))
    .addStringOption((option) =>
      option.setName('tipo').setDescription('Novo tipo da meta').addChoices(
        { name: 'Money', value: 'money' },
        { name: 'Tokens', value: 'tokens' }
      )),

  async execute(interaction, context) {
    const nameValue = interaction.options.getString('nome');
    const targetValue = interaction.options.getNumber('objetivo');
    const typeValue = interaction.options.getString('tipo');
    if (!nameValue && targetValue === null && !typeValue) {
      return interaction.reply({ content: '❌ Informe pelo menos um campo para editar.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const goal = await context.services.goals.updateActiveGoal(interaction.guild, interaction.user, {
      name: nameValue ? requiredText(nameValue, 'Nome', 200) : null,
      target: targetValue === null ? null : positiveAmount(targetValue),
      goalType: typeValue || null
    });
    await interaction.editReply(`✅ Meta atualizada: **${goal.name}** — objetivo **${goal.target}**.`);
  }
};
