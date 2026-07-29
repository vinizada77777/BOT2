'use strict';

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { COLORS, MEMBER_ROLE_NAMES } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Mostra os comandos e seus níveis de acesso.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle('❓ Central de Comandos VGS')
      .setDescription('Cada comando possui uma permissão específica.')
      .addFields(
        {
          name: '👤 Membro ou superior',
          value: '`/perfil`, `/metas`, `/ranking`, `/historico`, `/registrar-meta`, `/regras`, `/clan`, `/ping`'
        },
        { name: '🛡️ Líder e Fundador', value: '`/criar-meta`' },
        { name: '👑 Apenas Fundador', value: '`/setup`' },
        { name: '🔐 Cargos reconhecidos', value: MEMBER_ROLE_NAMES.map((name) => `• ${name}`).join('\n') }
      )
      .setFooter({ text: 'VIGARISTAS (VGS) • Minecraft RankUp' });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
