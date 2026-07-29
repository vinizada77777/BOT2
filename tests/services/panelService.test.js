'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const { PanelService } = require('../../src/services/PanelService');

test('PanelService edita a mensagem persistida em vez de criar outra', async () => {
  let edits = 0;
  let sends = 0;
  const message = { id: 'message', async edit() { edits += 1; } };
  const channel = {
    id: 'channel',
    isTextBased: () => true,
    messages: { async fetch() { return message; } },
    async send() {
      sends += 1;
      return { id: 'new-message' };
    }
  };
  const upserts = [];
  const service = new PanelService({
    panelRepository: {
      async get() {
        return { channel_id: 'channel', message_id: 'message' };
      },
      async upsert(...args) {
        upserts.push(args);
      }
    },
    logger: { error() {} },
    projectRoot: process.cwd()
  });
  const guild = {
    id: 'guild',
    channels: {
      cache: new Collection([['channel', channel]]),
      async fetch() {
        return channel;
      }
    }
  };

  await service.upsert(guild, 'panel', 'channel', { content: 'atualizado' });
  assert.equal(edits, 1);
  assert.equal(sends, 0);
  assert.equal(upserts.length, 1);
});

test('PanelService cria uma única substituta quando a mensagem foi apagada', async () => {
  let sends = 0;
  const channel = {
    id: 'channel',
    isTextBased: () => true,
    messages: {
      async fetch() {
        const error = new Error('Unknown Message');
        error.code = 10008;
        throw error;
      }
    },
    async send() {
      sends += 1;
      return { id: 'replacement' };
    }
  };
  let storedMessageId = null;
  const service = new PanelService({
    panelRepository: {
      async get() {
        return { channel_id: 'channel', message_id: 'missing' };
      },
      async upsert(_guildId, _panelKey, _channelId, messageId) {
        storedMessageId = messageId;
      }
    },
    logger: { error() {} },
    projectRoot: process.cwd()
  });
  const guild = {
    id: 'guild',
    channels: { cache: new Collection([['channel', channel]]) }
  };

  await service.upsert(guild, 'panel', 'channel', { content: 'novo' });
  assert.equal(sends, 1);
  assert.equal(storedMessageId, 'replacement');
});
