'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const { normalizeName, selectCandidate } = require('../../src/services/SetupService');

test('normalizeName compara nomes Unicode de forma estável', () => {
  assert.equal(normalizeName('  📝・RECRUTAMENTO '), normalizeName('📝・recrutamento'));
});

test('selectCandidate prioriza o ID persistido', () => {
  const collection = new Collection([
    ['1', { id: '1', name: 'painel' }],
    ['2', { id: '2', name: 'painel' }]
  ]);
  const selected = selectCandidate(
    collection,
    '2',
    (item) => item.name === 'painel',
    'painel',
    () => true
  );
  assert.equal(selected.resource.id, '2');
  assert.deepEqual(selected.duplicates.map((item) => item.id), ['1']);
});

test('selectCandidate retorna candidato canônico e duplicatas sem apagar nada', () => {
  const collection = new Collection([
    ['2', { id: '2', name: 'painel' }],
    ['1', { id: '1', name: 'painel' }]
  ]);
  const selected = selectCandidate(collection, null, (item) => item.name === 'painel', 'painel');
  assert.equal(selected.resource.id, '1');
  assert.deepEqual(selected.duplicates.map((item) => item.id), ['2']);
});
