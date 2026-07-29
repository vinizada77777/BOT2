'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  stableFingerprint,
  recruitStatus,
  contributionStatus
} = require('../../src/db/legacyImporter');

test('stableFingerprint independe da ordem das linhas', () => {
  const first = stableFingerprint([
    { key: 'b', value: { value: 2 } },
    { key: 'a', value: { value: 1 } }
  ]);
  const second = stableFingerprint([
    { key: 'a', value: { value: 1 } },
    { key: 'b', value: { value: 2 } }
  ]);
  assert.equal(first, second);
});

test('estados legados intermediários são convertidos para estados recuperáveis', () => {
  assert.equal(recruitStatus('sending'), 'awaiting_photo');
  assert.equal(recruitStatus('processing'), 'pending');
  assert.equal(contributionStatus('processing'), 'pending');
  assert.equal(contributionStatus('desconhecido'), 'cancelled');
});
