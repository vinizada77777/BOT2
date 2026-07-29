'use strict';

const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const { correlationId } = require('../observability/logger');
const { ROLE_DEFINITIONS, CATEGORY_DEFINITIONS } = require('../discord/template');
const { ROLE_NAMES, MEMBER_ROLE_NAMES, STAFF_ROLE_NAMES } = require('../config/constants');
const { staticPanelDefinitions } = require('../panels/staticPanels');

function normalizeName(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
}

function selectCandidate(collection, savedId, predicate, description, savedPredicate = predicate) {
  const saved = savedId ? collection.get(savedId) : null;
  if (saved && savedPredicate(saved)) {
    const duplicates = [...collection.filter(
      (item) => item.id !== saved.id && predicate(item)
    ).values()].sort((left, right) => left.id.localeCompare(right.id));
    return { resource: saved, duplicates, description };
  }

  const candidates = collection.filter(predicate);
  if (!candidates.size) return { resource: null, duplicates: [], description };
  const ordered = [...candidates.values()].sort((left, right) => left.id.localeCompare(right.id));
  return { resource: ordered[0], duplicates: ordered.slice(1), description };
}

function pushUnique(target, message) {
  if (message && !target.includes(message)) target.push(message);
}

class SetupService {
  constructor(options) {
    this.guildRepository = options.guildRepository;
    this.panelService = options.panelService;
    this.logRepository = options.logRepository;
    this.logger = options.logger;
  }

  async reconcile(guild, actorUserId) {
    const operationId = correlationId();
    const report = {
      created: [],
      updated: [],
      unchanged: [],
      skipped: [],
      errors: [],
      conflicts: []
    };

    await guild.roles.fetch();
    await guild.channels.fetch();
    await guild.members.fetchMe().catch(() => null);
    await this.guildRepository.ensure(guild.id);

    const config = await this.guildRepository.getConfigs(guild.id);
    const roles = {};
    const channels = {};
    const me = guild.members.me;

    if (!me) {
      throw new Error('Não foi possível carregar o membro do bot neste servidor.');
    }

    const canManageRoles = me.permissions.has(PermissionFlagsBits.ManageRoles)
      || me.permissions.has(PermissionFlagsBits.Administrator);
    const canManageChannels = me.permissions.has(PermissionFlagsBits.ManageChannels)
      || me.permissions.has(PermissionFlagsBits.Administrator);

    if (!canManageRoles) {
      pushUnique(report.errors, 'O bot não possui a permissão Gerenciar Cargos.');
    }
    if (!canManageChannels) {
      pushUnique(report.errors, 'O bot não possui a permissão Gerenciar Canais.');
    }

    for (const definition of [...ROLE_DEFINITIONS].reverse()) {
      await this.reconcileRole(guild, definition, config, roles, report, canManageRoles);
    }

    for (const categoryDefinition of CATEGORY_DEFINITIONS) {
      const category = await this.ensureCategory(
        guild,
        categoryDefinition,
        config,
        roles,
        report,
        canManageChannels
      );
      if (!category) continue;

      for (const channelDefinition of categoryDefinition.channels) {
        const channel = await this.ensureChannel(
          guild,
          category,
          categoryDefinition,
          channelDefinition,
          config,
          roles,
          report,
          canManageChannels
        );
        if (channel) channels[channelDefinition.key] = channel;
      }
    }

    const botRole = roles.bot;
    if (botRole && !me.roles.cache.has(botRole.id)) {
      if (canManageRoles && botRole.editable) {
        try {
          await me.roles.add(botRole, 'Setup VGS');
          report.updated.push(`cargo ${botRole.name} atribuído ao bot`);
        } catch (error) {
          this.recordFailure(report, `atribuir o cargo ${botRole.name} ao bot`, error);
        }
      } else {
        report.skipped.push(`cargo ${botRole.name} não foi atribuído ao bot por hierarquia/permissão`);
      }
    }

    for (const panel of staticPanelDefinitions()) {
      const channel = channels[panel.channelKey];
      if (!channel) {
        report.skipped.push(`painel ${panel.panelKey}: canal não disponível`);
        continue;
      }
      try {
        await this.panelService.upsert(guild, panel.panelKey, channel.id, {
          embeds: [panel.embed],
          components: panel.components || [],
          assetPath: panel.assetPath,
          filename: panel.filename
        });
        report.updated.push(`painel ${panel.panelKey}`);
      } catch (error) {
        this.recordFailure(report, `atualizar o painel ${panel.panelKey}`, error);
      }
    }

    const setupVersion = await this.guildRepository.incrementSetupVersion(guild.id);
    await this.logRepository.record({
      guildId: guild.id,
      eventType: 'setup.completed',
      actorUserId,
      entityType: 'guild',
      entityId: guild.id,
      message: [
        `Setup VGS reconciliado na versão ${setupVersion}.`,
        `Criados: ${report.created.length}.`,
        `Atualizados: ${report.updated.length}.`,
        `Ignorados: ${report.skipped.length}.`,
        `Erros: ${report.errors.length}.`,
        `Conflitos: ${report.conflicts.length}.`
      ].join(' '),
      correlationId: operationId
    });

    return { setupVersion, roles, channels, ...report };
  }

  async reconcileRole(guild, definition, config, roles, report, canManageRoles) {
    const result = selectCandidate(
      guild.roles.cache,
      config[`role:${definition.key}`],
      (role) => normalizeName(role.name) === normalizeName(definition.name),
      `cargo ${definition.name}`,
      (role) => !role.managed && role.id !== guild.roles.everyone.id
    );

    if (result.duplicates.length) {
      report.conflicts.push(
        `${result.description}: ${result.duplicates.map((item) => item.id).join(', ')}`
      );
    }

    let role = result.resource;

    if (!role) {
      if (!canManageRoles) {
        report.skipped.push(`criação do cargo ${definition.name}: falta Gerenciar Cargos`);
        return;
      }

      try {
        role = await guild.roles.create({
          name: definition.name,
          color: definition.color,
          hoist: definition.hoist,
          mentionable: false,
          reason: 'Setup inteligente VGS'
        });
        report.created.push(`cargo ${definition.name}`);
      } catch (error) {
        this.recordFailure(report, `criar o cargo ${definition.name}`, error);
        return;
      }
    } else {
      const desiredChanges = {};
      if (role.name !== definition.name) desiredChanges.name = definition.name;
      if (role.color !== definition.color) desiredChanges.color = definition.color;
      if (role.hoist !== definition.hoist) desiredChanges.hoist = definition.hoist;
      if (role.mentionable) desiredChanges.mentionable = false;

      if (Object.keys(desiredChanges).length === 0) {
        report.unchanged.push(`cargo ${definition.name}`);
      } else if (!canManageRoles || !role.editable || role.managed || role.id === guild.roles.everyone.id) {
        report.skipped.push(
          `cargo ${definition.name}: não editável; coloque o cargo do bot acima dele ou ajuste a permissão Gerenciar Cargos`
        );
      } else {
        try {
          await role.edit({ ...desiredChanges, reason: 'Reconciliação inteligente VGS' });
          report.updated.push(`cargo ${definition.name}`);
        } catch (error) {
          this.recordFailure(report, `editar o cargo ${definition.name}`, error);
        }
      }
    }

    if (role) {
      roles[definition.key] = role;
      await this.guildRepository.setConfig(guild.id, `role:${definition.key}`, role.id);
    }
  }

  async ensureCategory(guild, definition, config, roles, report, canManageChannels) {
    const result = selectCandidate(
      guild.channels.cache,
      config[`category:${definition.key}`],
      (channel) => channel.type === ChannelType.GuildCategory
        && normalizeName(channel.name) === normalizeName(definition.name),
      `categoria ${definition.name}`,
      (channel) => channel.type === ChannelType.GuildCategory
    );

    if (result.duplicates.length) {
      report.conflicts.push(
        `${result.description}: ${result.duplicates.map((item) => item.id).join(', ')}`
      );
    }

    let category = result.resource;
    if (!category) {
      if (!canManageChannels) {
        report.skipped.push(`criação da categoria ${definition.name}: falta Gerenciar Canais`);
        return null;
      }
      try {
        category = await guild.channels.create({
          name: definition.name,
          type: ChannelType.GuildCategory,
          reason: 'Setup inteligente VGS'
        });
        report.created.push(`categoria ${definition.name}`);
      } catch (error) {
        this.recordFailure(report, `criar a categoria ${definition.name}`, error);
        return null;
      }
    } else if (category.name !== definition.name) {
      if (!canManageChannels || !category.manageable) {
        report.skipped.push(`categoria ${definition.name}: não editável pelo bot`);
      } else {
        try {
          await category.edit({ name: definition.name, reason: 'Reconciliação inteligente VGS' });
          report.updated.push(`categoria ${definition.name}`);
        } catch (error) {
          this.recordFailure(report, `editar a categoria ${definition.name}`, error);
        }
      }
    } else {
      report.unchanged.push(`categoria ${definition.name}`);
    }

    await this.safeApplyPermissions(guild, category, definition.access, null, roles, report);
    await this.guildRepository.setConfig(guild.id, `category:${definition.key}`, category.id);
    return category;
  }

  async ensureChannel(guild, category, categoryDefinition, definition, config, roles, report, canManageChannels) {
    const expectedName = normalizeName(definition.name);
    const sameNameWrongType = guild.channels.cache.find(
      (channel) => normalizeName(channel.name) === expectedName && channel.type !== definition.type
    );

    const result = selectCandidate(
      guild.channels.cache,
      config[`channel:${definition.key}`],
      (channel) => channel.type === definition.type && normalizeName(channel.name) === expectedName,
      `canal ${definition.name}`,
      (channel) => channel.type === definition.type
    );

    if (result.duplicates.length) {
      report.conflicts.push(
        `${result.description}: ${result.duplicates.map((item) => item.id).join(', ')}`
      );
    }

    let channel = result.resource;
    if (!channel && sameNameWrongType) {
      report.conflicts.push(
        `canal ${definition.name}: existe um canal com o mesmo nome e tipo incompatível (${sameNameWrongType.id})`
      );
      return null;
    }

    if (!channel) {
      if (!canManageChannels) {
        report.skipped.push(`criação do canal ${definition.name}: falta Gerenciar Canais`);
        return null;
      }
      try {
        channel = await guild.channels.create({
          name: definition.name,
          type: definition.type,
          parent: category.id,
          reason: 'Setup inteligente VGS'
        });
        report.created.push(`canal ${definition.name}`);
      } catch (error) {
        this.recordFailure(report, `criar o canal ${definition.name}`, error);
        return null;
      }
    } else {
      const changes = {};
      if (channel.name !== definition.name) changes.name = definition.name;
      if (channel.parentId !== category.id) changes.parent = category.id;

      if (Object.keys(changes).length === 0) {
        report.unchanged.push(`canal ${definition.name}`);
      } else if (!canManageChannels || !channel.manageable) {
        report.skipped.push(`canal ${definition.name}: não editável pelo bot`);
      } else {
        try {
          await channel.edit({ ...changes, reason: 'Reconciliação inteligente VGS' });
          report.updated.push(`canal ${definition.name}`);
        } catch (error) {
          this.recordFailure(report, `editar o canal ${definition.name}`, error);
        }
      }
    }

    await this.safeApplyPermissions(
      guild,
      channel,
      categoryDefinition.access,
      definition,
      roles,
      report
    );
    await this.guildRepository.setConfig(guild.id, `channel:${definition.key}`, channel.id);
    return channel;
  }

  allowedRoleNames(access, channelDefinition) {
    if (access === 'staff') return STAFF_ROLE_NAMES;
    if (access === 'member') return MEMBER_ROLE_NAMES;
    if (access === 'visitor') return [ROLE_NAMES.VISITOR, ...MEMBER_ROLE_NAMES];
    if (access === 'recruitment') {
      if (['recruitment-inbox', 'recruitment-logs'].includes(channelDefinition?.key)) {
        return STAFF_ROLE_NAMES;
      }
      return [ROLE_NAMES.VISITOR, ...MEMBER_ROLE_NAMES];
    }
    return [];
  }

  async safeApplyPermissions(guild, resource, access, channelDefinition, roles, report) {
    if (!resource?.permissionOverwrites) return;

    try {
      await this.applyPermissions(guild, resource, access, channelDefinition, roles);
    } catch (error) {
      this.recordFailure(report, `aplicar permissões em ${resource.name}`, error);
    }
  }

  async applyPermissions(guild, resource, access, channelDefinition, roles) {
    const allowedNames = new Set(this.allowedRoleNames(access, channelDefinition));

    await resource.permissionOverwrites.edit(guild.roles.everyone, {
      ViewChannel: false
    }, { reason: 'Permissões VGS' });

    for (const role of Object.values(roles)) {
      if (!role || role.managed) continue;

      const isBotRole = role.name === ROLE_NAMES.BOT;
      const allowed = isBotRole || allowedNames.has(role.name);
      const permissions = { ViewChannel: allowed };

      if (channelDefinition && allowed) {
        permissions.ReadMessageHistory = true;
        if (channelDefinition.type === ChannelType.GuildVoice) {
          permissions.Connect = true;
          permissions.Speak = true;
        } else {
          permissions.SendMessages = !channelDefinition.readOnly || isBotRole;
          if (isBotRole) {
            permissions.ManageMessages = true;
            permissions.AttachFiles = true;
            permissions.EmbedLinks = true;
          }
        }
      }

      await resource.permissionOverwrites.edit(role, permissions, { reason: 'Permissões VGS' });
    }
  }

  recordFailure(report, action, error) {
    const message = `${action}: ${error?.message || 'erro desconhecido'}`;
    report.errors.push(message);
    this.logger.error(`❌ Falha ao ${action}.`, {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
  }
}

module.exports = { SetupService, normalizeName, selectCandidate };
