'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { withTransaction } = require('../../src/db/transaction');

function fakePool(script) {
  const queries = [];
  let connections = 0;
  return {
    queries,
    async connect() {
      connections += 1;
      return {
        async query(sql) {
          queries.push(sql);
          return script(sql, connections);
        },
        release() {
          queries.push('RELEASE');
        }
      };
    }
  };
}

test('withTransaction confirma e libera a conexão', async () => {
  const pool = fakePool(async () => ({ rows: [] }));
  const value = await withTransaction(pool, async () => 42);
  assert.equal(value, 42);
  assert.ok(pool.queries.includes('COMMIT'));
  assert.equal(pool.queries.at(-1), 'RELEASE');
});

test('withTransaction desfaz falha e tenta novamente em deadlock', async () => {
  let workCalls = 0;
  const pool = fakePool(async () => ({ rows: [] }));
  const value = await withTransaction(pool, async () => {
    workCalls += 1;
    if (workCalls === 1) {
      const error = new Error('deadlock');
      error.code = '40P01';
      throw error;
    }
    return 'ok';
  });
  assert.equal(value, 'ok');
  assert.equal(workCalls, 2);
  assert.ok(pool.queries.includes('ROLLBACK'));
});
