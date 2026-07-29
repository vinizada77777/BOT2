'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules']);

function collectJavaScriptFiles(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectJavaScriptFiles(fullPath, result);
    else if (entry.isFile() && entry.name.endsWith('.js')) result.push(fullPath);
  }
  return result;
}

function run() {
  const files = collectJavaScriptFiles(PROJECT_ROOT);
  const failures = [];
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) failures.push({ file, output: result.stderr || result.stdout });
  }
  if (failures.length) {
    for (const failure of failures) {
      console.error(`❌ ${path.relative(PROJECT_ROOT, failure.file)}\n${failure.output}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`✅ Sintaxe validada em ${files.length} arquivos JavaScript.`);
}

if (require.main === module) run();

module.exports = { collectJavaScriptFiles, run };
