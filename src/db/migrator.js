'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { AppError } = require('../errors/AppError');

const MIGRATION_LOCK_NAME = 'vgs-bot-v4-schema-migrations';

async function listMigrationFiles(directory) {
  return (await fs.readdir(directory))
    .filter((name) => /^\d+_.+\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right, 'en'));
}

function checksum(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

async function runMigrations(pool, options = {}) {
  const directory = options.directory || path.join(__dirname, 'migrations');
  const logger = options.logger || console;
  const files = await listMigrationFiles(directory);
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK_NAME]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const sql = await fs.readFile(path.join(directory, file), 'utf8');
      const digest = checksum(sql);
      const existing = await client.query(
        'SELECT checksum FROM schema_migrations WHERE version = $1',
        [file]
      );

      if (existing.rowCount) {
        if (existing.rows[0].checksum !== digest) {
          throw new AppError(
            'MIGRATION_CHANGED',
            'Migração de banco inválida. Bot encerrado.',
            { internalMessage: `A migração já aplicada ${file} foi alterada.` }
          );
        }
        continue;
      }

      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL statement_timeout = '30s'");
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [file, digest]
        );
        await client.query('COMMIT');
        logger.info(`✅ Migração aplicada: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      }
    }
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw new AppError(
      'MIGRATION_FAILED',
      'Migração do PostgreSQL falhou. Bot encerrado.',
      { internalMessage: 'Falha ao aplicar migrações do PostgreSQL.', cause }
    );
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK_NAME]).catch(() => {});
    client.release();
  }
}

module.exports = { runMigrations, listMigrationFiles, checksum, MIGRATION_LOCK_NAME };
