'use strict';

const { ChannelType } = require('discord.js');
const { ROLE_NAMES } = require('../config/constants');

const ROLE_DEFINITIONS = Object.freeze([
  { key: 'founder', name: ROLE_NAMES.FOUNDER, color: 0xD4AF37, hoist: true },
  { key: 'leader', name: ROLE_NAMES.LEADER, color: 0xE74C3C, hoist: true },
  { key: 'sub', name: ROLE_NAMES.SUB, color: 0xE67E22, hoist: true },
  { key: 'recruiter', name: ROLE_NAMES.RECRUITER, color: 0x9B59B6, hoist: true },
  { key: 'veteran', name: ROLE_NAMES.VETERAN, color: 0x3498DB, hoist: true },
  { key: 'member', name: ROLE_NAMES.MEMBER, color: 0x2ECC71, hoist: true },
  { key: 'evaluation', name: ROLE_NAMES.EVALUATION, color: 0xF1C40F, hoist: false },
  { key: 'visitor', name: ROLE_NAMES.VISITOR, color: 0x95A5A6, hoist: false },
  { key: 'bot', name: ROLE_NAMES.BOT, color: 0x00BCD4, hoist: false }
]);

const CATEGORY_DEFINITIONS = Object.freeze([
  {
    key: 'information',
    name: '📌・INFORMAÇÕES',
    access: 'visitor',
    channels: [
      { key: 'welcome', name: '👋・boas-vindas', type: ChannelType.GuildText, readOnly: true },
      { key: 'rules', name: '📜・regras', type: ChannelType.GuildText, readOnly: true },
      { key: 'announcements', name: '📢・anúncios', type: ChannelType.GuildText, readOnly: true },
      { key: 'objectives', name: '🎯・objetivos-do-clã', type: ChannelType.GuildText, readOnly: true },
      { key: 'hierarchy', name: '🏛️・hierarquia', type: ChannelType.GuildText, readOnly: true }
    ]
  },
  {
    key: 'recruitment',
    name: '📝・RECRUTAMENTO',
    access: 'recruitment',
    channels: [
      { key: 'recruitment-panel', name: '📋・recrutamento', type: ChannelType.GuildText, readOnly: true },
      { key: 'recruitment-results', name: '📊・resultado-recrutamento', type: ChannelType.GuildText, readOnly: true },
      { key: 'recruitment-inbox', name: '📥・inscrições-vgs', type: ChannelType.GuildText, readOnly: true },
      { key: 'recruitment-logs', name: '🧾・logs-recrutamento', type: ChannelType.GuildText, readOnly: true },
      { key: 'recruitment-voice', name: '🔊・Recrutamento', type: ChannelType.GuildVoice, readOnly: false }
    ]
  },
  {
    key: 'progress',
    name: '💰・PROGRESSÃO',
    access: 'member',
    channels: [
      { key: 'goals', name: '🎯・metas-do-clã', type: ChannelType.GuildText, readOnly: true },
      { key: 'goal-logs', name: '📜・logs-metas', type: ChannelType.GuildText, readOnly: true },
      { key: 'money-ranking', name: '💵・ranking-money', type: ChannelType.GuildText, readOnly: false },
      { key: 'token-ranking', name: '🪙・ranking-tokens', type: ChannelType.GuildText, readOnly: false },
      { key: 'mining-control', name: '⛏️・controle-mineração', type: ChannelType.GuildText, readOnly: false },
      { key: 'proofs', name: '📸・comprovantes', type: ChannelType.GuildText, readOnly: false }
    ]
  },
  {
    key: 'community',
    name: '💬・COMUNIDADE',
    access: 'member',
    channels: [
      { key: 'general-chat', name: '💬・chat-geral', type: ChannelType.GuildText, readOnly: false },
      { key: 'media', name: '📷・prints-e-clipes', type: ChannelType.GuildText, readOnly: false },
      { key: 'questions', name: '❓・dúvidas', type: ChannelType.GuildText, readOnly: false },
      { key: 'absences', name: '📅・ausências', type: ChannelType.GuildText, readOnly: false },
      { key: 'help', name: '❓・ajuda-comandos', type: ChannelType.GuildText, readOnly: true },
      { key: 'commands', name: '🤖・comandos', type: ChannelType.GuildText, readOnly: false }
    ]
  },
  {
    key: 'voice',
    name: '🔊・CANAIS DE VOZ',
    access: 'member',
    channels: [
      { key: 'voice-lobby', name: '🔊・Lobby VGS', type: ChannelType.GuildVoice, readOnly: false },
      { key: 'voice-mining-1', name: '⛏️・Mineração 01', type: ChannelType.GuildVoice, readOnly: false },
      { key: 'voice-mining-2', name: '⛏️・Mineração 02', type: ChannelType.GuildVoice, readOnly: false },
      { key: 'voice-social', name: '💬・Resenha', type: ChannelType.GuildVoice, readOnly: false },
      { key: 'voice-afk', name: '💤・AFK', type: ChannelType.GuildVoice, readOnly: false }
    ]
  },
  {
    key: 'administration',
    name: '👑・ADMINISTRAÇÃO',
    access: 'staff',
    channels: [
      { key: 'leadership', name: '👑・liderança', type: ChannelType.GuildText, readOnly: false },
      { key: 'admin-logs', name: '📜・logs-admin', type: ChannelType.GuildText, readOnly: true },
      { key: 'bot-configuration', name: '⚙️・configuração-bot', type: ChannelType.GuildText, readOnly: false },
      { key: 'leadership-voice', name: '🔊・Liderança', type: ChannelType.GuildVoice, readOnly: false }
    ]
  }
]);

module.exports = { ROLE_DEFINITIONS, CATEGORY_DEFINITIONS };
