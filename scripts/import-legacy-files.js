'use strict';

require('dotenv').config({ quiet: true });

const fs = require('node:fs/promises');
const path = require('node:path');
const { loadDatabaseConfig } = require('../src/config/environment');
const { createLogger } = require('../src/observability/logger');
const { createDatabasePool, verifyDatabase } = require('../src/db/pool');
const { runMigrations } = require('../src/db/migrator');
const { LegacyImporter } = require('../src/db/legacyImporter');

async function importLegacyFiles() {
  const logger = createLogger();
  const directory = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data'));
  const filenames = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  if (!filenames.length) throw new Error(`Nenhum arquivo JSON encontrado em ${directory}.`);

  const rows = [];
  for (const filename of filenames) {
    const value = JSON.parse(await fs.readFile(path.join(directory, filename), 'utf8'));
    rows.push({ key: filename.slice(0, -5), value });
  }

  const pool = createDatabasePool(loadDatabaseConfig(), logger);
  try {
    await verifyDatabase(pool);
    await runMigrations(pool, { logger });
    const importer = new LegacyImporter({ pool, logger });
    const result = await importer.importRows(`json-files:${directory}`, rows);
    logger.info('✅ Importação de arquivos concluída.', result);
  } finally {
    await pool.end();
  }
}

importLegacyFiles().catch((error) => {
  const logger = createLogger();
  logger.error('❌ Falha na importação de arquivos antigos.', error);
  process.exitCode = 1;
});

module.exports = { importLegacyFiles };
