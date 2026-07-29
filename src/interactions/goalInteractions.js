'use strict';

const { AppError } = require('../errors/AppError');
const { renderReviewedMessage } = require('../panels/dynamicPanels');

async function handleGoalInteraction(interaction, context) {
  const match = interaction.isButton()
    && interaction.customId.match(/^(?:goal|meta):(approve|reject):(.+)$/);
  if (!match) return false;
  if (!context.permissions.isLeadership(interaction.member)) {
    throw new AppError('LEADERSHIP_REQUIRED', 'Apenas Fundador ou Líder pode avaliar contribuições.');
  }

  await interaction.deferUpdate();
  const approved = match[1] === 'approve';
  let contributionId = match[2];
  if (interaction.customId.startsWith('meta:')) {
    const legacy = await context.repositories.goals.findContributionByLegacyIdentifier(
      interaction.guildId,
      contributionId
    );
    if (legacy) contributionId = legacy.id;
  }
  const result = await context.services.goals.decideContribution(
    interaction.guild,
    contributionId,
    approved,
    interaction.user
  );
  const reviewedEmbed = renderReviewedMessage(
    interaction.message.embeds[0],
    approved,
    interaction.user.tag
  );
  await interaction.editReply({ embeds: [reviewedEmbed], components: [] });
  if (result.changed) {
    await context.services.goals.sendDecisionLog(
      interaction.guild,
      result.contribution,
      approved,
      interaction.user
    );
  }
  return true;
}

module.exports = { handleGoalInteraction };
