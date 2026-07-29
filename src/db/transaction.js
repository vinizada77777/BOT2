'use strict';

const RETRYABLE_CODES = new Set(['40001', '40P01']);

async function withTransaction(pool, work, options = {}) {
  const attempts = Math.max(1, options.attempts || 2);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout = '10s'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout = '5s'");
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (!RETRYABLE_CODES.has(error.code) || attempt === attempts) throw error;
    } finally {
      client.release();
    }
  }

  throw new Error('Transação encerrada sem resultado.');
}

module.exports = { withTransaction, RETRYABLE_CODES };
