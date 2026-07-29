'use strict';

const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');
const { AppError } = require('../errors/AppError');

function isUnknownMessage(error) {
  return error?.code === 10008 || error?.rawError?.code === 10008;
}

class PanelService {
  constructor(options) {
    this.panelRepository = options.panelRepository;
    this.logger = options.logger;
    this.projectRoot = options.projectRoot;
  }

  async upsert(guild, panelKey, channelId, payload) {
    const channel = guild.channels.cache.get(channelId)
      || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      throw new AppError('PANEL_CHANNEL_MISSING', `Canal do painel ${panelKey} não encontrado.`);
    }

    const existing = await this.panelRepository.get(guild.id, panelKey);
    let message = null;

    if (existing?.channel_id === channel.id) {
      try {
        message = await channel.messages.fetch(existing.message_id);
      } catch (error) {
        if (!isUnknownMessage(error)) throw error;
      }
    }

    const messagePayload = { ...payload };
    if (payload.assetPath) {
      const absolutePath = path.join(this.projectRoot, payload.assetPath);
      messagePayload.files = [new AttachmentBuilder(absolutePath, { name: payload.filename })];
      delete messagePayload.assetPath;
      delete messagePayload.filename;
    }

    if (message) {
      if (messagePayload.files) messagePayload.attachments = [];
      await message.edit(messagePayload);
    } else {
      message = await channel.send(messagePayload);
    }

    await this.panelRepository.upsert(guild.id, panelKey, channel.id, message.id);
    return message;
  }
}

module.exports = { PanelService, isUnknownMessage };
