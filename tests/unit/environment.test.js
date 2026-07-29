'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanEnvironmentValue,
  environmentDiagnostic,
  loadRuntimeConfig,
  validateDatabaseUrl
} = require('../../src/config/environment');

test('cleanEnvironmentValue removes aspas externas e espaços', () => {
  assert.equal(cleanEnvironmentValue('  "abc"  '), 'abc');
  assert.equal(cleanEnvironmentValue(" 'abc' "), 'abc');
});

test('environmentDiagnostic retorna somente nomes permitidos', () => {
  const diagnostic = environmentDiagnostic({
    TOKEN: 'segredo',
    CLIENT_ID: '123',
    GUILD_ID: '456',
    DATABASE_URL: 'postgresql://secret@host/db',
    INTERNAL_SECRET: 'não pode aparecer'
  });
  assert.deepEqual(diagnostic.missing, []);
  assert.deepEqual(diagnostic.present, ['TOKEN', 'CLIENT_ID', 'GUILD_ID', 'DATABASE_URL']);
  assert.equal(JSON.stringify(diagnostic).includes('segredo'), false);
  assert.equal(JSON.stringify(diagnostic).includes('INTERNAL_SECRET'), false);
});

test('loadRuntimeConfig falha sem DATABASE_URL', () => {
  assert.throws(
    () => loadRuntimeConfig({ TOKEN: 'a', CLIENT_ID: 'b', GUILD_ID: 'c' }),
    (error) => error.code === 'DATABASE_URL_MISSING'
  );
});

test('validateDatabaseUrl rejeita referência Railway não resolvida', () => {
  assert.throws(
    () => validateDatabaseUrl('${{Postgres.DATABASE_URL}}'),
    (error) => error.code === 'DATABASE_URL_UNRESOLVED'
  );
});

test('loadRuntimeConfig desativa SSL para host interno do Railway', () => {
  const config = loadRuntimeConfig({
    TOKEN: 'token',
    CLIENT_ID: 'client',
    GUILD_ID: 'guild',
    DATABASE_URL: 'postgresql://user:pass@postgres.railway.internal:5432/railway'
  });
  assert.equal(config.database.ssl, false);
  assert.equal(config.database.maxConnections, 5);
});
