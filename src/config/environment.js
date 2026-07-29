'use strict';

const { AppError } = require('../errors/AppError');

const REQUIRED_RUNTIME_VARIABLES = ['TOKEN', 'CLIENT_ID', 'GUILD_ID', 'DATABASE_URL'];
const DIAGNOSTIC_VARIABLES = [...REQUIRED_RUNTIME_VARIABLES, 'PGSSLMODE'];

function cleanEnvironmentValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
}

function normalizedEnvironment(source = process.env) {
  const normalized = new Map();
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = rawKey.trim().toUpperCase();
    if (key) normalized.set(key, cleanEnvironmentValue(rawValue));
  }
  return normalized;
}

function isUnresolvedRailwayReference(value) {
  return value.includes('${{') || value.includes('}}');
}

function environmentDiagnostic(source = process.env) {
  const env = normalizedEnvironment(source);
  const present = DIAGNOSTIC_VARIABLES.filter((name) => Boolean(env.get(name)));
  const missing = REQUIRED_RUNTIME_VARIABLES.filter((name) => !env.get(name));
  return { present, missing };
}

function validateDatabaseUrl(value) {
  if (!value) {
    throw new AppError(
      'DATABASE_URL_MISSING',
      'PostgreSQL indisponível. Bot encerrado.',
      { internalMessage: 'DATABASE_URL não está disponível no processo.' }
    );
  }
  if (isUnresolvedRailwayReference(value)) {
    throw new AppError(
      'DATABASE_URL_UNRESOLVED',
      'PostgreSQL indisponível. Bot encerrado.',
      { internalMessage: 'DATABASE_URL contém uma referência Railway não resolvida.' }
    );
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch (cause) {
    throw new AppError(
      'DATABASE_URL_INVALID',
      'PostgreSQL indisponível. Bot encerrado.',
      { internalMessage: 'DATABASE_URL não é uma URL válida.', cause }
    );
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.pathname.slice(1)) {
    throw new AppError(
      'DATABASE_URL_INVALID',
      'PostgreSQL indisponível. Bot encerrado.',
      { internalMessage: 'DATABASE_URL precisa apontar para um banco PostgreSQL completo.' }
    );
  }

  return value;
}

function loadDatabaseConfig(source = process.env) {
  const env = normalizedEnvironment(source);
  const databaseUrl = validateDatabaseUrl(env.get('DATABASE_URL'));
  const sslMode = (env.get('PGSSLMODE') || '').toLowerCase();
  const internalRailway = databaseUrl.includes('.railway.internal');
  return Object.freeze({
    url: databaseUrl,
    ssl: sslMode === 'disable' || internalRailway ? false : { rejectUnauthorized: false },
    maxConnections: 5,
    idleTimeoutMs: 30_000,
    connectionTimeoutMs: 15_000
  });
}

function loadRuntimeConfig(source = process.env) {
  const env = normalizedEnvironment(source);
  const missingDiscord = ['TOKEN', 'CLIENT_ID', 'GUILD_ID'].filter((name) => !env.get(name));
  if (missingDiscord.length) {
    throw new AppError(
      'DISCORD_CONFIG_MISSING',
      `Configuração ausente: ${missingDiscord.join(', ')}.`,
      { details: { missing: missingDiscord } }
    );
  }

  return Object.freeze({
    discord: Object.freeze({
      token: env.get('TOKEN'),
      clientId: env.get('CLIENT_ID'),
      guildId: env.get('GUILD_ID')
    }),
    database: loadDatabaseConfig(source)
  });
}

function loadDeployConfig(source = process.env) {
  const env = normalizedEnvironment(source);
  const missing = ['TOKEN', 'CLIENT_ID'].filter((name) => !env.get(name));
  if (missing.length) {
    throw new AppError(
      'DEPLOY_CONFIG_MISSING',
      `Configuração ausente para registrar comandos: ${missing.join(', ')}.`
    );
  }
  return Object.freeze({
    token: env.get('TOKEN'),
    clientId: env.get('CLIENT_ID'),
    guildId: env.get('GUILD_ID') || ''
  });
}

module.exports = {
  REQUIRED_RUNTIME_VARIABLES,
  DIAGNOSTIC_VARIABLES,
  cleanEnvironmentValue,
  normalizedEnvironment,
  environmentDiagnostic,
  validateDatabaseUrl,
  loadDatabaseConfig,
  loadRuntimeConfig,
  loadDeployConfig,
  isUnresolvedRailwayReference
};
