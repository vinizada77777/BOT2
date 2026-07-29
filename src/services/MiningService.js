'use strict';

const { EmbedBuilder } = require('discord.js');
const { AppError } = require('../errors/AppError');
const { COLORS } = require('../config/constants');
const { correlationId } = require('../observability/logger');

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}min`);
  parts.push(`${remaining}s`);
  return parts.join(' ');
}

class MiningService {
  constructor(options) {
    this.miningRepository = options.miningRepository;
    this.guildRepository = options.guildRepository;
    this.logRepository = options.logRepository;
    this.logger = options.logger;
  }

  async getConsoleChannel(guild) {
    const config = await this.guildRepository.getConfigs(guild.id);
    const channel = guild.channels.cache.get(config['channel:mining-control']);
    if (!channel?.isTextBased()) {
      throw new AppError('MINING_CHANNEL_MISSING', 'Canal de controle de mineração não encontrado. Execute `/setup`.');
    }
    return channel;
  }

  async start(guild, user, sourceChannelId) {
    await this.guildRepository.ensure(guild.id);
    const session = await this.miningRepository.startSession({
      guildId: guild.id,
      userId: user.id,
      channelId: sourceChannelId
    });
    const consoleChannel = await this.getConsoleChannel(guild);
    await consoleChannel.send({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.GREEN)
        .setTitle('⛏️ Mineração iniciada')
        .setDescription(`${user} iniciou uma sessão de mineração.`)
        .addFields(
          { name: 'Jogador', value: `${user}`, inline: true },
          { name: 'Início', value: `<t:${Math.floor(new Date(session.started_at).getTime() / 1000)}:F>`, inline: true },
          { name: 'Sessão', value: `#${session.id}`, inline: true }
        )
        .setFooter({ text: 'Use /mineracao finalizar quando terminar.' })
        .setTimestamp()]
    });
    await this.logRepository.record({
      guildId: guild.id,
      eventType: 'mining.started',
      actorUserId: user.id,
      targetUserId: user.id,
      entityType: 'mining_session',
      entityId: session.id,
      message: 'Sessão de mineração iniciada.',
      correlationId: correlationId()
    });
    return session;
  }

  async finish(guild, user, sourceChannelId) {
    const session = await this.miningRepository.finishSession({
      guildId: guild.id,
      userId: user.id,
      channelId: sourceChannelId
    });
    const consoleChannel = await this.getConsoleChannel(guild);
    await consoleChannel.send({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle('✅ Mineração finalizada')
        .setDescription(`${user} finalizou a sessão de mineração.`)
        .addFields(
          { name: 'Jogador', value: `${user}`, inline: true },
          { name: 'Duração', value: `**${formatDuration(session.duration_seconds)}**`, inline: true },
          { name: 'Sessão', value: `#${session.id}`, inline: true },
          { name: 'Início', value: `<t:${Math.floor(new Date(session.started_at).getTime() / 1000)}:R>`, inline: true },
          { name: 'Final', value: `<t:${Math.floor(new Date(session.finished_at).getTime() / 1000)}:F>`, inline: true }
        )
        .setTimestamp()]
    });
    await this.logRepository.record({
      guildId: guild.id,
      eventType: 'mining.finished',
      actorUserId: user.id,
      targetUserId: user.id,
      entityType: 'mining_session',
      entityId: session.id,
      message: `Sessão de mineração finalizada em ${formatDuration(session.duration_seconds)}.`,
      correlationId: correlationId()
    });
    return session;
  }

  async status(guildId, userId) {
    const active = await this.miningRepository.getActive(guildId, userId);
    const summary = await this.miningRepository.getUserSummary(guildId, userId);
    return { active, summary };
  }
}

module.exports = { MiningService, formatDuration };
