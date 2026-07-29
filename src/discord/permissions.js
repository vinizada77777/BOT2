'use strict';

const { PermissionFlagsBits } = require('discord.js');
const {
  ROLE_NAMES,
  STAFF_ROLE_NAMES,
  MEMBER_ROLE_NAMES
} = require('../config/constants');

const COMMAND_ACCESS = Object.freeze({
  setup: [ROLE_NAMES.FOUNDER],
  'criar-meta': STAFF_ROLE_NAMES,
  'editar-meta': STAFF_ROLE_NAMES,
  'encerrar-meta': STAFF_ROLE_NAMES,
  'atualizar-paineis': STAFF_ROLE_NAMES,
  'registrar-meta': MEMBER_ROLE_NAMES,
  mineracao: MEMBER_ROLE_NAMES,
  perfil: MEMBER_ROLE_NAMES,
  ajuda: MEMBER_ROLE_NAMES,
  metas: MEMBER_ROLE_NAMES,
  ranking: MEMBER_ROLE_NAMES,
  historico: MEMBER_ROLE_NAMES,
  regras: MEMBER_ROLE_NAMES,
  clan: MEMBER_ROLE_NAMES,
  ping: MEMBER_ROLE_NAMES,
  comandos: MEMBER_ROLE_NAMES,
  status: STAFF_ROLE_NAMES
});

function hasNamedRole(member, names) {
  if (!member?.roles?.cache) return false;
  const expected = new Set(names);
  return member.roles.cache.some((role) => expected.has(role.name));
}

function hasCommandAccess(member, commandName) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const allowed = COMMAND_ACCESS[commandName];
  return !allowed || hasNamedRole(member, allowed);
}

function isLeadership(member) {
  return Boolean(
    member?.permissions?.has(PermissionFlagsBits.Administrator)
    || hasNamedRole(member, STAFF_ROLE_NAMES)
  );
}

function accessLabel(commandName) {
  return (COMMAND_ACCESS[commandName] || []).map((name) => `@${name}`).join(', ') || 'Todos';
}

module.exports = {
  COMMAND_ACCESS,
  hasNamedRole,
  hasCommandAccess,
  isLeadership,
  accessLabel
};
