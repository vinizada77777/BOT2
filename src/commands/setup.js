'use strict';

const {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require('discord.js');
const { COLORS } = require('../config/constants');

function summarize(items, limit = 6) {
  if (!items.length) return 'Nenhum';
  const visible = items.slice(0, limit).map((item) => `• ${item}`).join('\n');
  const remaining = items.length - limit;
  return remaining > 0 ? `${visible}\n• ... e mais ${remaining}` : visible;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Cria, verifica e atualiza a estrutura VGS sem interromper por recursos protegidos.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await context.services.setup.reconcile(interaction.guild, interaction.user.id);

    const hasProblems = result.errors.length || result.skipped.length || result.conflicts.length;
    const embed = new EmbedBuilder()
      .setColor(hasProblems ? COLORS.YELLOW : COLORS.GREEN)
      .setTitle(hasProblems ? '⚠️ Setup VGS concluído com avisos' : '✅ Setup VGS concluído')
      .setDescription(
        'O setup verificou os recursos existentes, criou apenas o que faltava e ignorou com segurança o que o bot não pode editar.'
      )
      .addFields(
        { name: 'Versão do setup', value: String(result.setupVersion), inline: true },
        { name: 'Criados', value: String(result.created.length), inline: true },
        { name: 'Atualizados', value: String(result.updated.length), inline: true },
        { name: 'Sem alterações', value: String(result.unchanged.length), inline: true },
        { name: 'Ignorados', value: String(result.skipped.length), inline: true },
        { name: 'Erros', value: String(result.errors.length), inline: true }
      )
      .setTimestamp();

    if (result.skipped.length) {
      embed.addFields({ name: 'Recursos ignorados', value: summarize(result.skipped) });
    }
    if (result.errors.length) {
      embed.addFields({ name: 'Falhas encontradas', value: summarize(result.errors) });
    }
    if (result.conflicts.length) {
      embed.addFields({ name: 'Duplicidades/conflitos antigos', value: summarize(result.conflicts) });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
