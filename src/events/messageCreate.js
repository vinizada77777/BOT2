'use strict';

const { Events } = require('discord.js');
const { isImageAttachment } = require('../utils/validation');

module.exports = {
  name: Events.MessageCreate,

  async execute(message, context) {
    if (message.author.bot || !message.guild || !message.channel.topic?.startsWith('VGS_RECRUIT:')) return;
    const topicParts = message.channel.topic.split(':');
    const isLegacyTopic = topicParts.length === 2;
    const recruitId = isLegacyTopic ? null : topicParts[1];
    const userId = isLegacyTopic ? topicParts[1] : topicParts[2];
    if (message.author.id !== userId || !message.attachments.size) return;

    const active = await context.services.recruits.getActive(message.guild.id, message.author.id);
    if (!active || (recruitId && String(active.id) !== recruitId)) {
      await message.reply('❌ Esta inscrição não está mais ativa. Use o painel de recrutamento novamente.').catch(() => {});
      return;
    }
    if (active.status === 'pending' || active.status === 'processing') {
      await message.reply('⚠️ Sua foto já foi recebida e aguarda avaliação.').catch(() => {});
      return;
    }

    const image = message.attachments.find(isImageAttachment);
    if (!image) {
      await message.reply('❌ Envie uma imagem PNG, JPG, JPEG, WEBP ou GIF de até 10 MB.').catch(() => {});
      return;
    }

    try {
      const pending = await context.services.recruits.submitPhoto(message, image);
      if (pending) {
        await message.channel.send('✅ Foto recebida! Sua inscrição foi encaminhada aos líderes.').catch(() => {});
      }
    } catch (error) {
      context.logger.error(`❌ Erro na foto da inscrição #${recruitId}.`, error);
      const publicMessage = error.publicMessage || 'Não foi possível encaminhar sua inscrição. Tente novamente.';
      await message.reply(`❌ ${publicMessage}`).catch(() => {});
    }
  }
};
