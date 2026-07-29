'use strict';

const { EmbedBuilder } = require('discord.js');
const { AppError } = require('../errors/AppError');
const { COLORS } = require('../config/constants');
const { correlationId } = require('../observability/logger');
const {
  renderContributionReview,
  renderGoalPanel
} = require('../panels/dynamicPanels');
const { safeImageFilename } = require('../utils/validation');

class GoalService {
  constructor(options) {
    this.goalRepository = options.goalRepository;
    this.guildRepository = options.guildRepository;
    this.panelService = options.panelService;
    this.logRepository = options.logRepository;
  }

  async createGoal(guild, actor, values) {
    await this.guildRepository.ensure(guild.id);
    const config = await this.guildRepository.getConfigs(guild.id);
    const goalChannel = guild.channels.cache.get(config['channel:goals']);
    if (!goalChannel?.isTextBased()) {
      throw new AppError('GOAL_CHANNEL_MISSING', 'Canal de metas não encontrado. Execute `/setup`.');
    }
    const goal = await this.goalRepository.createGoal({
      guildId: guild.id,
      createdBy: actor.id,
      ...values
    });
    await this.refreshPanel(guild, goal.id);
    await this.logRepository.record({
      guildId: guild.id,
      eventType: 'goal.created',
      actorUserId: actor.id,
      entityType: 'goal',
      entityId: goal.id,
      message: `Meta criada: ${goal.name}.`,
      correlationId: correlationId()
    });
    return goal;
  }


  async updateActiveGoal(guild, actor, values) {
    const goal = await this.goalRepository.updateActiveGoal(guild.id, values);
    await this.refreshPanel(guild, goal.id);
    await this.logRepository.record({
      guildId: guild.id,
      eventType: 'goal.updated',
      actorUserId: actor.id,
      entityType: 'goal',
      entityId: goal.id,
      message: `Meta atualizada: ${goal.name}.`,
      correlationId: correlationId()
    });
    return goal;
  }

  async closeActiveGoal(guild, actor, reason) {
    const goal = await this.goalRepository.closeActiveGoal(guild.id);
    await this.logRepository.record({
      guildId: guild.id,
      eventType: 'goal.closed',
      actorUserId: actor.id,
      entityType: 'goal',
      entityId: goal.id,
      message: `Meta encerrada: ${goal.name}. Motivo: ${reason}`,
      correlationId: correlationId()
    });
    return goal;
  }

  async refreshPanel(guild, goalId = null) {
    const goal = goalId
      ? await this.goalRepository.getGoalById(guild.id, goalId)
      : await this.goalRepository.getActiveGoal(guild.id);
    if (!goal || goal.status !== 'active') return null;

    const config = await this.guildRepository.getConfigs(guild.id);
    const channelId = config['channel:goals'];
    if (!channelId) {
      throw new AppError('GOAL_CHANNEL_MISSING', 'Canal de metas não encontrado. Execute `/setup`.');
    }
    const ranking = await this.goalRepository.getRanking(goal.id, 5);
    return this.panelService.upsert(guild, 'active-goal', channelId, {
      embeds: [renderGoalPanel(goal, ranking)],
      components: []
    });
  }

  async submitContribution(guild, user, values) {
    await this.guildRepository.ensure(guild.id);
    const { goal, contribution } = await this.goalRepository.createContribution({
      guildId: guild.id,
      userId: user.id,
      ...values
    });

    const config = await this.guildRepository.getConfigs(guild.id);
    const logChannel = guild.channels.cache.get(config['channel:goal-logs']);
    if (!logChannel?.isTextBased()) {
      await this.goalRepository.cancelContribution(contribution.id);
      throw new AppError(
        'GOAL_LOG_CHANNEL_MISSING',
        'Canal de análise das metas não encontrado. Execute `/setup`.'
      );
    }

    try {
      const mirroredFilename = safeImageFilename(`contribution-${contribution.id}`, {
        name: contribution.proof_filename,
        contentType: contribution.proof_content_type
      });
      const reviewPayload = renderContributionReview(
        { ...contribution, proof_url: `attachment://${mirroredFilename}` },
        goal
      );
      reviewPayload.files = [{ attachment: contribution.proof_url, name: mirroredFilename }];
      const message = await logChannel.send(reviewPayload);
      const mirroredProof = message.attachments.first() || null;
      await this.goalRepository.setContributionReviewMessage(
        contribution.id,
        message.id,
        mirroredProof
      );
      return {
        goal,
        contribution: {
          ...contribution,
          proof_url: mirroredProof?.url || contribution.proof_url,
          review_message_id: message.id
        }
      };
    } catch (error) {
      await this.goalRepository.cancelContribution(contribution.id);
      throw error;
    }
  }

  async decideContribution(guild, contributionId, approved, reviewer) {
    const decision = approved ? 'approved' : 'rejected';
    const result = await this.goalRepository.decideContribution(
      guild.id,
      contributionId,
      decision,
      reviewer.id
    );
    const contribution = result.contribution;
    if (!contribution) throw new AppError('CONTRIBUTION_NOT_FOUND', 'Contribuição não encontrada.');
    if (!result.changed && contribution.status !== decision) {
      throw new AppError(
        'CONTRIBUTION_ALREADY_DECIDED',
        'Esta contribuição já recebeu uma decisão diferente.'
      );
    }

    const goal = await this.goalRepository.getGoalById(guild.id, contribution.goal_id);
    if (goal?.status === 'active') await this.refreshPanel(guild, goal.id);

    await this.logRepository.record({
      guildId: guild.id,
      eventType: `contribution.${decision}`,
      actorUserId: reviewer.id,
      targetUserId: contribution.user_id,
      entityType: 'contribution',
      entityId: contribution.id,
      message: result.changed ? 'Decisão registrada.' : 'Decisão já registrada; operação repetida com segurança.',
      correlationId: correlationId()
    });

    return { contribution, goal, changed: result.changed };
  }

  async sendDecisionLog(guild, contribution, approved, reviewer) {
    const config = await this.guildRepository.getConfigs(guild.id);
    const channel = guild.channels.cache.get(config['channel:goal-logs']);
    if (!channel?.isTextBased()) return;
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(approved ? COLORS.GREEN : COLORS.RED)
          .setTitle(approved ? '✅ Contribuição aprovada' : '❌ Contribuição reprovada')
          .addFields(
            { name: 'Jogador', value: `<@${contribution.user_id}>`, inline: true },
            { name: 'Revisor', value: `${reviewer}`, inline: true },
            { name: 'Valor', value: String(contribution.amount), inline: true }
          )
          .setTimestamp()
      ]
    }).catch(() => {});
  }
}

module.exports = { GoalService };
