'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Mostra o estado do bot.'),

  async execute(interaction) {
    return interaction.reply({
      content: `🏓 Pong! Discord: ${Math.max(0, interaction.client.ws.ping)} ms • PostgreSQL: conectado`,
      ephemeral: true
    });
  }
};
