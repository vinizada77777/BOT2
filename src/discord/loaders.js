'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');

function javascriptFiles(directory) {
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.js'))
    .sort();
}

function loadCommands(directory = path.join(__dirname, '..', 'commands')) {
  const commands = new Collection();
  for (const filename of javascriptFiles(directory)) {
    const command = require(path.join(directory, filename));
    if (!command.data?.name || typeof command.execute !== 'function') {
      throw new Error(`Comando inválido: ${filename}`);
    }
    if (commands.has(command.data.name)) {
      throw new Error(`Comando duplicado: ${command.data.name}`);
    }
    commands.set(command.data.name, command);
  }
  return commands;
}

function registerEvents(client, context, directory = path.join(__dirname, '..', 'events')) {
  for (const filename of javascriptFiles(directory)) {
    const event = require(path.join(directory, filename));
    if (!event.name || typeof event.execute !== 'function') {
      throw new Error(`Evento inválido: ${filename}`);
    }
    const handler = (...args) => event.execute(...args, context);
    if (event.once) client.once(event.name, handler);
    else client.on(event.name, handler);
  }
}

module.exports = { javascriptFiles, loadCommands, registerEvents };
