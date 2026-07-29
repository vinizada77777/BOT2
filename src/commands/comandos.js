'use strict';

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('comandos')
    .setDescription('Lista todos os comandos disponíveis no bot VGS.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle('🤖 Comandos VGS V5')
      .setDescription([
        '**Membros**',
        '`/perfil` `/metas` `/ranking` `/historico`',
        '`/registrar-meta` `/mineracao` `/regras` `/clan` `/ping` `/ajuda`',
        '',
        '**Liderança**',
        '`/criar-meta` `/editar-meta` `/encerrar-meta`',
        '`/atualizar-paineis`',
        '',
        '**Administração**',
        '`/setup`',
        '',
        'Os comandos aparecem de acordo com os seus cargos e permissões.'
      ].join('\n'))
      .setFooter({ text: 'VIGARISTAS VGS • V5.2.0' });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
