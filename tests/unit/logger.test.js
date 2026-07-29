'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLogger, redact } = require('../../src/observability/logger');

test('redact oculta URLs PostgreSQL', () => {
  const result = redact('erro em postgresql://user:password@host:5432/database');
  assert.equal(result.includes('password'), false);
  assert.match(result, /\[REDACTED\]/);
});

test('logger não escreve segredo contido em erro', () => {
  const output = [];
  const sink = {
    log: (value) => output.push(value),
    warn: (value) => output.push(value),
    error: (value) => output.push(value)
  };
  const logger = createLogger(sink);
  logger.error('Falha', new Error('postgres://user:secret@localhost/db'));
  assert.equal(output.join('\n').includes('secret'), false);
});
