'use strict';

const { Pool } = require('pg');
const { AppError } = require('../errors/AppError');

function createDatabasePool(databaseConfig, logger) {
  const pool = new Pool({
    connectionString: databaseConfig.url,
    ssl: databaseConfig.ssl,
    max: databaseConfig.maxConnections,
    idleTimeoutMillis: databaseConfig.idleTimeoutMs,
    connectionTimeoutMillis: databaseConfig.connectionTimeoutMs,
    keepAlive: true,
    application_name: 'vgs-bot-v4'
  });

  pool.on('error', (error) => {
    logger.error('❌ Erro inesperado no pool PostgreSQL.', error);
  });

  return pool;
}

async function verifyDatabase(pool) {
  let client;
  try {
    client = await pool.connect();
    await client.query("SET statement_timeout = '15s'");
    await client.query("SET idle_in_transaction_session_timeout = '10s'");
    await client.query('SELECT 1');
  } catch (cause) {
    throw new AppError(
      'DATABASE_UNAVAILABLE',
      'PostgreSQL indisponível. Bot encerrado.',
      { internalMessage: 'Não foi possível validar a conexão PostgreSQL.', cause }
    );
  } finally {
    client?.release();
  }
}

module.exports = { createDatabasePool, verifyDatabase };
