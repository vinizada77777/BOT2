'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { progressBar, truncate } = require('../../src/utils/format');
const {
  isImageAttachment,
  positiveAmount,
  requiredText,
  safeImageFilename
} = require('../../src/utils/validation');
const { ticketName } = require('../../src/services/RecruitService');

test('progressBar limita progresso visual a 100%', () => {
  assert.equal(progressBar(200, 100, 10), '██████████ 100.0%');
  assert.equal(progressBar(0, 100, 10), '░░░░░░░░░░ 0.0%');
});

test('truncate e requiredText respeitam limites', () => {
  assert.equal(truncate('abcdef', 5), 'abcd…');
  assert.equal(requiredText(' valor ', 'Campo', 10), 'valor');
  assert.throws(() => requiredText('', 'Campo', 10), /obrigatório/);
});

test('isImageAttachment valida tipo, extensão e tamanho', () => {
  assert.equal(isImageAttachment({ name: 'foto.png', size: 100 }), true);
  assert.equal(isImageAttachment({ name: 'foto.exe', contentType: 'application/octet-stream', size: 100 }), false);
  assert.equal(isImageAttachment({ name: 'foto.jpg', size: 11 * 1024 * 1024 }), false);
});

test('positiveAmount rejeita zero, negativos e infinito', () => {
  assert.equal(positiveAmount(1.5), 1.5);
  assert.throws(() => positiveAmount(0));
  assert.throws(() => positiveAmount(Infinity));
});

test('ticketName gera nome Discord estável e seguro', () => {
  assert.equal(ticketName('João da Silva!', 42), 'inscricao-joao-da-silva-42');
  assert.ok(ticketName('x'.repeat(200), 1).length <= 95);
});

test('safeImageFilename preserva somente extensões de imagem aceitas', () => {
  assert.equal(safeImageFilename('recruit-1', { name: 'foto.JPEG' }), 'recruit-1.jpg');
  assert.equal(safeImageFilename('contribution 2', { name: 'arquivo.exe' }), 'contribution-2.png');
});
