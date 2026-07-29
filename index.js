'use strict';

require('dotenv').config({ quiet: true });

const { bootstrap } = require('./src/bootstrap');

bootstrap().catch((error) => {
  const message = error?.publicMessage || 'Falha interna na inicialização. Consulte o log seguro acima.';
  console.error(`❌ ${message}`);
  process.exitCode = 1;
});
