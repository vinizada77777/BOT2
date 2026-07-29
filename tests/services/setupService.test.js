'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ChannelType, Collection } = require('discord.js');
const { SetupService } = require('../../src/services/SetupService');

function permissionOverwrites() {
  return { async edit() {} };
}

function createFakeGuild() {
  let roleSequence = 0;
  let channelSequence = 0;
  const roleCache = new Collection();
  const channelCache = new Collection();
  const memberRoleCache = new Collection();

  const roles = {
    cache: roleCache,
    everyone: { id: 'everyone', name: '@everyone' },
    async fetch() {
      return roleCache;
    },
    async create(definition) {
      const role = {
        id: `role-${++roleSequence}`,
        managed: false,
        ...definition,
        async edit(changes) {
          Object.assign(this, changes);
          return this;
        }
      };
      roleCache.set(role.id, role);
      return role;
    }
  };
  const channels = {
    cache: channelCache,
    async fetch() {
      return channelCache;
    },
    async create(definition) {
      const channel = {
        id: `channel-${++channelSequence}`,
        name: definition.name,
        type: definition.type,
        parentId: definition.parent || null,
        permissionOverwrites: permissionOverwrites(),
        async edit(changes) {
          if (changes.parent) this.parentId = changes.parent;
          Object.assign(this, changes);
          return this;
        },
        isTextBased() {
          return this.type === ChannelType.GuildText;
        }
      };
      channelCache.set(channel.id, channel);
      return channel;
    }
  };

  return {
    id: 'guild-id',
    roles,
    channels,
    members: {
      me: {
        roles: {
          cache: memberRoleCache,
          async add(role) {
            memberRoleCache.set(role.id, role);
          }
        }
      }
    }
  };
}

function createDependencies() {
  const configs = new Map();
  let setupVersion = 0;
  const panelMessages = new Map();
  const guildRepository = {
    async ensure() {},
    async getConfigs() {
      return Object.fromEntries(configs);
    },
    async setConfig(_guildId, key, value) {
      configs.set(key, value);
    },
    async incrementSetupVersion() {
      setupVersion += 1;
      return setupVersion;
    }
  };
  return {
    configs,
    panelMessages,
    guildRepository,
    panelService: {
      async upsert(_guild, panelKey, channelId) {
        panelMessages.set(panelKey, channelId);
      }
    },
    logRepository: { async record() {} },
    logger: { warn() {}, error() {} }
  };
}

test('/setup é idempotente para cargos, categorias, canais e painéis', async () => {
  const guild = createFakeGuild();
  const dependencies = createDependencies();
  const service = new SetupService(dependencies);

  const first = await service.reconcile(guild, 'owner');
  const firstRoleIds = [...guild.roles.cache.keys()];
  const firstChannelIds = [...guild.channels.cache.keys()];
  const firstPanels = Object.fromEntries(dependencies.panelMessages);

  const second = await service.reconcile(guild, 'owner');
  assert.deepEqual([...guild.roles.cache.keys()], firstRoleIds);
  assert.deepEqual([...guild.channels.cache.keys()], firstChannelIds);
  assert.deepEqual(Object.fromEntries(dependencies.panelMessages), firstPanels);
  assert.equal(first.conflicts.length, 0);
  assert.equal(second.conflicts.length, 0);
  assert.equal(first.setupVersion, 1);
  assert.equal(second.setupVersion, 2);
});

test('/setup reutiliza o ID persistido mesmo quando o recurso foi renomeado', async () => {
  const guild = createFakeGuild();
  const dependencies = createDependencies();
  const service = new SetupService(dependencies);
  await service.reconcile(guild, 'owner');

  const founderId = dependencies.configs.get('role:founder');
  guild.roles.cache.get(founderId).name = 'Nome alterado';
  const countBefore = guild.roles.cache.size;
  await service.reconcile(guild, 'owner');

  assert.equal(guild.roles.cache.size, countBefore);
  assert.equal(dependencies.configs.get('role:founder'), founderId);
});
