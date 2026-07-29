'use strict';

const {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { AppError } = require('../errors/AppError');
const { COLORS, ROLE_NAMES, STAFF_ROLE_NAMES } = require('../config/constants');
const { correlationId } = require('../observability/logger');
const { renderRecruitReview } = require('../panels/dynamicPanels');
const { safeImageFilename } = require('../utils/validation');

function ticketName(username, recruitId) {
  const safe = String(username || 'candidato')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
  return `inscricao-${safe || 'candidato'}-${recruitId}`.slice(0, 95);
}

class RecruitService {
  constructor(options) {
    this.recruitRepository = options.recruitRepository;
    this.guildRepository = options.guildRepository;
    this.memberRepository = options.memberRepository;
    this.logRepository = options.logRepository;
    this.logger = options.logger;
  }

  async getActive(guildId, userId) {
    return this.recruitRepository.findActiveByUser(guildId, userId);
  }

  async createApplication(guild, user, fields) {
    await this.guildRepository.ensure(guild.id);
    const recruit = await this.recruitRepository.create({
      guildId: guild.id,
      userId: user.id,
      ...fields
    });

    let channel = null;
    try {
      const config = await this.guildRepository.getConfigs(guild.id);
      const category = guild.channels.cache.get(config['category:recruitment']);
      if (!category || category.type !== ChannelType.GuildCategory) {
        throw new AppError(
          'RECRUITMENT_CATEGORY_MISSING',
          'A categoria de recrutamento não existe. Execute `/setup` primeiro.'
        );
      }

      const permissionOverwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }
      ];
      for (const roleName of STAFF_ROLE_NAMES) {
        const key = roleName === ROLE_NAMES.FOUNDER ? 'founder' : 'leader';
        const role = guild.roles.cache.get(config[`role:${key}`])
          || guild.roles.cache.find((item) => item.name === roleName);
        if (role) {
          permissionOverwrites.push({
            id: role.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          });
        }
      }

      channel = await guild.channels.create({
        name: ticketName(user.username, recruit.id),
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `VGS_RECRUIT:${recruit.id}:${user.id}`,
        permissionOverwrites,
        reason: `Inscrição VGS #${recruit.id}`
      });
      await this.recruitRepository.setChannel(recruit.id, channel.id);

      await channel.send({
        content: `${user}`,
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.GOLD)
            .setTitle('📸 Última etapa')
            .setDescription([
              'Envie **uma imagem da sua picareta** neste canal.',
              'A imagem será encaminhada aos líderes para avaliação.',
              '',
              'Ao continuar, você confirma que usa apenas uma conta para mineração, que não transfere Money ou Tokens sem autorização do Fundador ou Líder e que está ciente de que o foco principal é a conta de mineração e o crescimento do clã.'
            ].join('\n'))
        ]
      });
      return { ...recruit, channel_id: channel.id };
    } catch (error) {
      await this.recruitRepository.markFailed(recruit.id, error.code || 'channel_creation_failed');
      if (channel) await channel.delete(`Falha ao iniciar inscrição VGS #${recruit.id}`).catch(() => {});
      throw error;
    }
  }

  async submitPhoto(message, image) {
    const recruit = await this.recruitRepository.findAwaitingByChannel(
      message.guild.id,
      message.author.id,
      message.channel.id
    );
    if (!recruit) return null;

    await this.recruitRepository.savePrimaryImage(recruit.id, image);
    const config = await this.guildRepository.getConfigs(message.guild.id);
    const inbox = message.guild.channels.cache.get(config['channel:recruitment-inbox']);
    if (!inbox?.isTextBased()) {
      throw new AppError(
        'RECRUITMENT_INBOX_MISSING',
        'O canal de inscrições não foi encontrado. Peça para um Fundador executar `/setup`.'
      );
    }

    const mirroredFilename = safeImageFilename(`recruit-${recruit.id}`, image);
    const reviewPayload = renderRecruitReview(recruit, `attachment://${mirroredFilename}`);
    reviewPayload.files = [{ attachment: image.url, name: mirroredFilename }];
    const reviewMessage = await inbox.send(reviewPayload);
    const mirroredImage = reviewMessage.attachments.first();
    if (mirroredImage) {
      await this.recruitRepository.savePrimaryImage(recruit.id, mirroredImage);
    }
    const pending = await this.recruitRepository.markPending(recruit.id, reviewMessage.id);
    if (!pending) {
      await reviewMessage.delete().catch(() => {});
      throw new AppError('RECRUIT_STATE_CHANGED', 'Esta inscrição já foi processada.');
    }
    return pending;
  }

  async decide(guild, recruitId, approved, reviewer) {
    const operationId = correlationId();
    const decision = approved ? 'approved' : 'rejected';
    const result = await this.recruitRepository.decide(guild.id, recruitId, decision, reviewer.id);
    const recruit = result.recruit;

    if (!recruit) throw new AppError('RECRUIT_NOT_FOUND', 'Inscrição não encontrada.');
    if (!result.changed && recruit.status !== decision) {
      throw new AppError(
        'RECRUIT_ALREADY_DECIDED',
        `Esta inscrição já foi ${recruit.status === 'approved' ? 'aprovada' : 'reprovada'}.`
      );
    }

    const member = await guild.members.fetch(recruit.user_id).catch(() => null);
    const config = await this.guildRepository.getConfigs(guild.id);
    const syncErrors = [];

    if (approved) {
      if (!member) {
        syncErrors.push('O candidato não está mais no servidor.');
      } else {
        const visitorRole = guild.roles.cache.get(config['role:visitor']);
        const evaluationRole = guild.roles.cache.get(config['role:evaluation']);
        const memberRole = guild.roles.cache.get(config['role:member']);
        if (!memberRole) {
          syncErrors.push('O cargo de membro não foi encontrado.');
        } else {
          if (visitorRole) await member.roles.remove(visitorRole, `Inscrição VGS #${recruit.id}`).catch((error) => syncErrors.push(error.message));
          if (evaluationRole) await member.roles.remove(evaluationRole, `Inscrição VGS #${recruit.id}`).catch((error) => syncErrors.push(error.message));
          await member.roles.add(memberRole, `Inscrição VGS #${recruit.id}`).catch((error) => syncErrors.push(error.message));
          try {
            await member.setNickname(
              `[VGS] ${recruit.nick}`.slice(0, 32),
              `Inscrição VGS #${recruit.id}`
            );
          } catch (error) {
            const message = error?.message || 'Erro desconhecido ao alterar nickname.';
            this.logger.error(`❌ Falha ao alterar nickname da inscrição #${recruit.id}.`, error);
            syncErrors.push(`Nickname: ${message}`);
          }
          await this.memberRepository.upsert(guild.id, member.id, {
            gameNick: recruit.nick,
            status: 'member',
            joinedAt: member.joinedAt
          });
        }
        await member.send('✅ Você foi aprovado no VIGARISTAS (VGS)! Os canais do clã já foram liberados.').catch(() => {});
      }
    } else if (member) {
      await member.send('❌ Sua inscrição no VIGARISTAS (VGS) foi reprovada. Procure a liderança para mais informações.').catch(() => {});
    }

    if (!syncErrors.length) await this.recruitRepository.markDiscordSynced(recruit.id);

    const resultChannel = guild.channels.cache.get(config['channel:recruitment-results']);
    if (result.changed && resultChannel?.isTextBased()) {
      await resultChannel.send(
        `${approved ? '✅ APROVADO' : '❌ REPROVADO'} — <@${recruit.user_id}> por ${reviewer}`
      ).catch((error) => syncErrors.push(error.message));
    }

    const logChannel = guild.channels.cache.get(config['channel:recruitment-logs']);
    if (result.changed && logChannel?.isTextBased()) {
      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(approved ? COLORS.GREEN : COLORS.RED)
            .setTitle(approved ? '✅ Inscrição aprovada' : '❌ Inscrição reprovada')
            .addFields(
              { name: 'Candidato', value: `<@${recruit.user_id}>`, inline: true },
              { name: 'Revisor', value: `${reviewer}`, inline: true },
              { name: 'Nick', value: recruit.nick },
              {
                name: 'Foco da conta e do clã',
                value: recruit.focus_acknowledged ? '✅ Ciente e de acordo' : '⚠️ Não confirmado'
              },
              { name: 'Sincronização', value: syncErrors.length ? `⚠️ ${syncErrors.join(' | ').slice(0, 1000)}` : '✅ Concluída' }
            )
            .setTimestamp()
        ]
      }).catch((error) => syncErrors.push(error.message));
    }

    await this.logRepository.record({
      guildId: guild.id,
      eventType: `recruit.${decision}`,
      actorUserId: reviewer.id,
      targetUserId: recruit.user_id,
      entityType: 'recruit',
      entityId: recruit.id,
      message: syncErrors.length
        ? `Decisão salva com pendências de sincronização: ${syncErrors.join(' | ').slice(0, 1500)}`
        : 'Decisão e sincronização concluídas.',
      correlationId: operationId
    });

    const ticket = guild.channels.cache.get(recruit.channel_id);
    if (ticket) {
      await ticket.send(`Inscrição ${approved ? 'aprovada' : 'reprovada'}. Este canal será fechado.`).catch(() => {});
      setTimeout(async () => {
        try {
          await ticket.delete(`Inscrição VGS #${recruit.id} finalizada`);
          await this.recruitRepository.markChannelClosed(recruit.id);
        } catch (error) {
          this.logger.error(`❌ Falha ao fechar o canal da inscrição #${recruit.id}.`, error);
        }
      }, 5_000);
    }

    return { recruit, changed: result.changed, syncErrors };
  }
}

module.exports = { RecruitService, ticketName };
