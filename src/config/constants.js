'use strict';

const COLORS = Object.freeze({
  GOLD: 0xE5B000,
  GREEN: 0x2ECC71,
  RED: 0xE74C3C,
  ORANGE: 0xF39C12,
  DARK: 0x111111
});

const ROLE_NAMES = Object.freeze({
  FOUNDER: '👑 Fundador VGS',
  LEADER: '🛡️ Líder VGS',
  SUB: '⚔️ Sub-Líder',
  RECRUITER: '🔨 Recrutador',
  VETERAN: '💎 Veterano',
  MEMBER: '✅ Membro VGS',
  EVALUATION: '🟡 Em Avaliação',
  VISITOR: '👤 Visitante',
  BOT: '🤖 Bots'
});

const STAFF_ROLE_NAMES = Object.freeze([ROLE_NAMES.FOUNDER, ROLE_NAMES.LEADER]);
const MEMBER_ROLE_NAMES = Object.freeze([
  ROLE_NAMES.MEMBER,
  ROLE_NAMES.VETERAN,
  ROLE_NAMES.RECRUITER,
  ROLE_NAMES.SUB,
  ROLE_NAMES.LEADER,
  ROLE_NAMES.FOUNDER
]);

const ASSETS = Object.freeze({
  logo: 'assets/logo-vgs.png',
  welcome: 'assets/boas-vindas-vgs.png',
  rules: 'assets/regras-vgs.png',
  recruitment: 'assets/recrutamento-vgs.png',
  objectives: 'assets/objetivos-vgs.png',
  hierarchy: 'assets/hierarquia-vgs.png',
  rankings: 'assets/rankings-vgs.png',
  mining: 'assets/mineracao-vgs.png',
  goals: 'assets/metas-vgs.png'
});

module.exports = { COLORS, ROLE_NAMES, STAFF_ROLE_NAMES, MEMBER_ROLE_NAMES, ASSETS };
