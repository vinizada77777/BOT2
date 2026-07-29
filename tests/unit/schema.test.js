'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schema = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'db', 'migrations', '001_initial_schema.sql'),
  'utf8'
);

test('schema contém todas as tabelas profissionais', () => {
  for (const table of [
    'guild_settings',
    'configs',
    'panels',
    'members',
    'recruits',
    'recruit_images',
    'goals',
    'contributions',
    'logs',
    'legacy_imports'
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE ${table}\\b`));
  }
});

test('schema aplica índices parciais para operações ativas', () => {
  assert.match(schema, /recruits_one_active_per_user_idx[\s\S]+WHERE status IN/);
  assert.match(schema, /goals_one_active_per_guild_idx[\s\S]+WHERE status = 'active'/);
  assert.match(schema, /contributions_one_pending_per_user_goal_idx[\s\S]+WHERE status IN/);
});

test('schema indexa as principais chaves estrangeiras', () => {
  assert.match(schema, /recruit_images_recruit_id_idx/);
  assert.match(schema, /contributions_goal_id_idx/);
});
