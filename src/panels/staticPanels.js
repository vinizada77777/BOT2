'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { ASSETS, COLORS, ROLE_NAMES } = require('../config/constants');

function basePanel(title, description, assetPath) {
  const filename = assetPath.split('/').pop();
  return {
    assetPath,
    filename,
    embed: new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle(title)
      .setDescription(description)
      .setImage(`attachment://${filename}`)
      .setFooter({ text: 'VIGARISTAS (VGS) • Minecraft RankUp' })
  };
}

function staticPanelDefinitions() {
  const recruitmentRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('recruit:start')
      .setLabel('Fazer inscrição')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary)
  );

  return [
    {
      panelKey: 'welcome',
      channelKey: 'welcome',
      ...basePanel(
        'Bem-vindo ao VIGARISTAS (VGS)',
        'Nosso objetivo é chegar ao topo do servidor e dominar os rankings de **Money** e **Tokens**. Leia as regras e faça sua inscrição.',
        ASSETS.welcome
      )
    },
    {
      panelKey: 'rules',
      channelKey: 'rules',
      ...basePanel(
        'Regras Oficiais',
        [
          '• Respeite todos.',
          '• Use uma única conta oficial para mineração.',
          '• Money e Tokens não podem ser transferidos sem autorização do Fundador ou Líder.',
          '• Comprovantes falsos causam expulsão.',
          '• Ao se inscrever, você aceita estas regras.'
        ].join('\n'),
        ASSETS.rules
      )
    },
    {
      panelKey: 'objectives',
      channelKey: 'objectives',
      ...basePanel(
        'Objetivos do VGS',
        '🏆 Top 1 Money\n🪙 Top 1 Tokens\n👑 Top 1 Clã\n\nFoco, disciplina, união e constância.',
        ASSETS.objectives
      )
    },
    {
      panelKey: 'hierarchy',
      channelKey: 'hierarchy',
      ...basePanel(
        'Hierarquia VGS',
        'Fundador → Líder → Sub-Líder → Recrutador → Veterano → Membro → Em Avaliação → Visitante',
        ASSETS.hierarchy
      )
    },
    {
      panelKey: 'recruitment',
      channelKey: 'recruitment-panel',
      ...basePanel(
        'Recrutamento VGS',
        'Clique no botão abaixo. Após preencher o formulário, será criado um canal privado para você enviar a foto da sua picareta.',
        ASSETS.recruitment
      ),
      components: [recruitmentRow]
    },
    {
      panelKey: 'help',
      channelKey: 'help',
      ...basePanel(
        'Central de Comandos VGS',
        [
          '**Membro ou superior**',
          '`/perfil` — perfil e contribuição',
          '`/metas` — progresso da meta ativa',
          '`/ranking` — ranking de contribuições',
          '`/historico` — histórico pessoal',
          '`/registrar-meta` — enviar contribuição com comprovante',
          '`/regras` — regras do clã',
          '`/clan` — informações do VGS',
          '`/ping` — status do bot',
          '',
          '**Líder e Fundador**',
          '`/criar-meta` — criar ou substituir meta',
          '',
          '**Somente Fundador**',
          '`/setup` — reconciliar o servidor',
          '',
          `Cargos reconhecidos: ${[
            ROLE_NAMES.MEMBER,
            ROLE_NAMES.VETERAN,
            ROLE_NAMES.RECRUITER,
            ROLE_NAMES.SUB,
            ROLE_NAMES.LEADER,
            ROLE_NAMES.FOUNDER
          ].join(', ')}`
        ].join('\n'),
        ASSETS.logo
      )
    }
  ];
}

module.exports = { staticPanelDefinitions, basePanel };
