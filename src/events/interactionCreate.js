'use strict';

const { Events } = require('discord.js');
const { AppError } = require('../errors/AppError');
const { correlationId } = require('../observability/logger');
const { handleRecruitInteraction } = require('../interactions/recruitInteractions');
const { handleGoalInteraction } = require('../interactions/goalInteractions');

async function replyWithError(interaction, context, error) {
  const operationId = correlationId();
  context.logger.error(`❌ Erro em interação ${operationId}.`, error, {
    command: interaction.commandName || null,
    customId: interaction.customId || null,
    guildId: interaction.guildId || null,
    userId: interaction.user?.id || null
  });
  const message = error instanceof AppError
    ? error.publicMessage
    : `Ocorreu um erro interno. Informe o código ${operationId} à liderança.`;
  const payload = { content: `❌ ${message}`, ephemeral: true };
  if (!interaction.isRepliable()) return;
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction, context) {
    try {
      if (!interaction.guild) {
        if (interaction.isRepliable()) {
          await interaction.reply({ content: '❌ Este bot funciona apenas no servidor VGS.', ephemeral: true });
        }
        return;
      }

      if (interaction.isChatInputCommand()) {
        const command = context.commands.get(interaction.commandName);
        if (!command) return;
        if (!context.permissions.hasCommandAccess(interaction.member, interaction.commandName)) {
          throw new AppError(
            'COMMAND_ACCESS_DENIED',
            `Você não possui o cargo necessário. Permitido para: ${context.permissions.accessLabel(interaction.commandName)}.`
          );
        }
        await command.execute(interaction, context);
        return;
      }

      if (await handleRecruitInteraction(interaction, context)) return;
      await handleGoalInteraction(interaction, context);
    } catch (error) {
      await replyWithError(interaction, context, error);
    }
  }
};

module.exports.replyWithError = replyWithError;
