'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { COLORS } = require('../config/constants');
const { formatNumber, progressBar, truncate } = require('../utils/format');

function renderGoalPanel(goal, ranking = []) {
  const unit = goal.goal_type === 'money' ? 'Money' : 'Tokens';
  const top = ranking.length
    ? ranking.map((entry, index) => `${index + 1}º <@${entry.user_id}> — ${formatNumber(entry.total)}`).join('\n')
    : 'Nenhuma contribuição aprovada.';

  return new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`🎯 ${truncate(goal.name, 200)}`)
    .setDescription([
      progressBar(goal.current, goal.target),
      '',
      `**${formatNumber(goal.current)} / ${formatNumber(goal.target)} ${unit}**`,
      '',
      `🏆 **Top contribuidores**\n${top}`,
      '',
      'Use `/registrar-meta` com um comprovante.'
    ].join('\n'))
    .setTimestamp();
}

function renderRecruitReview(recruit, imageUrl) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.ORANGE)
    .setTitle('📥 Nova inscrição VGS')
    .addFields(
      { name: 'Jogador', value: `<@${recruit.user_id}>`, inline: true },
      { name: 'Nick', value: truncate(recruit.nick, 100), inline: true },
      { name: 'Idade', value: truncate(recruit.age_text, 50), inline: true },
      { name: 'Disponibilidade', value: truncate(recruit.availability, 1000) },
      { name: 'Cash, Tokens e Money', value: truncate(recruit.balances_text || recruit.cash_items, 1000) },
      {
        name: 'Foco da conta e do clã',
        value: recruit.focus_acknowledged
          ? `✅ Ciente e de acordo${recruit.focus_acknowledgement_text ? ` — ${truncate(recruit.focus_acknowledgement_text, 300)}` : ''}`
          : '⚠️ Confirmação não registrada'
      },
      { name: 'Regras', value: '✅ Declarou estar de acordo' }
    )
    .setImage(imageUrl)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`recruit:approve:${recruit.id}`)
      .setLabel('Aprovar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`recruit:reject:${recruit.id}`)
      .setLabel('Reprovar')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

function renderContributionReview(contribution, goal) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.ORANGE)
    .setTitle('📥 Nova contribuição pendente')
    .addFields(
      { name: 'Jogador', value: `<@${contribution.user_id}>`, inline: true },
      { name: 'Quantidade', value: formatNumber(contribution.amount), inline: true },
      { name: 'Meta', value: truncate(goal.name, 1000) },
      { name: 'Observação', value: truncate(contribution.observation, 1000, 'Nenhuma') }
    )
    .setImage(contribution.proof_url)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`goal:approve:${contribution.id}`)
      .setLabel('Aprovar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`goal:reject:${contribution.id}`)
      .setLabel('Reprovar')
      .setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row] };
}

function renderReviewedMessage(sourceEmbed, approved, reviewerTag) {
  return sourceEmbed
    ? EmbedBuilder.from(sourceEmbed)
      .setColor(approved ? COLORS.GREEN : COLORS.RED)
      .setFooter({ text: `${approved ? 'Aprovado' : 'Reprovado'} por ${reviewerTag}` })
    : new EmbedBuilder()
      .setColor(approved ? COLORS.GREEN : COLORS.RED)
      .setDescription(approved ? '✅ Aprovado.' : '❌ Reprovado.');
}

module.exports = {
  renderGoalPanel,
  renderRecruitReview,
  renderContributionReview,
  renderReviewedMessage
};
