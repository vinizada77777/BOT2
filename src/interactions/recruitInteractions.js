'use strict';

const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { AppError } = require('../errors/AppError');
const { requiredText } = require('../utils/validation');
const { renderReviewedMessage } = require('../panels/dynamicPanels');

function buildRecruitModal() {
  const modal = new ModalBuilder()
    .setCustomId('recruit:modal')
    .setTitle('Inscrição VIGARISTAS (VGS)');
  // O Discord aceita no máximo cinco campos por modal. Por isso, Cash,
  // Tokens e Money ficam juntos em um único campo, liberando espaço para a
  // confirmação obrigatória sobre o foco na mineração e no clã.
  const fields = [
    ['nick', 'Nome no jogo', 'Seu nick no servidor', TextInputStyle.Short],
    ['age', 'Idade', 'Ex.: 16', TextInputStyle.Short],
    ['time', 'Tempo disponível', 'Ex.: 4 horas por dia', TextInputStyle.Short],
    ['economy', 'Cash, Tokens e Money', 'Ex.: Cash: Não | Tokens: 15.000 | Money: 2.000.000', TextInputStyle.Paragraph],
    ['focus', 'Ciente do foco em mineração e clã?', 'Digite: SIM, ESTOU CIENTE E CONCORDO', TextInputStyle.Paragraph]
  ];
  modal.addComponents(
    ...fields.map(([id, label, placeholder, style]) =>
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(id)
          .setLabel(label)
          .setPlaceholder(placeholder)
          .setStyle(style)
          .setMaxLength(style === TextInputStyle.Paragraph ? 1000 : 200)
          .setRequired(true)
      ))
  );
  return modal;
}

async function handleRecruitInteraction(interaction, context) {
  if (interaction.isButton() && interaction.customId === 'recruit:start') {
    const active = await context.services.recruits.getActive(interaction.guildId, interaction.user.id);
    if (active) {
      const channel = active.channel_id && interaction.guild.channels.cache.get(active.channel_id);
      await interaction.reply({
        content: channel
          ? `❌ Você já possui uma inscrição ativa: ${channel}`
          : '❌ Você já possui uma inscrição ativa.',
        ephemeral: true
      });
      return true;
    }
    await interaction.showModal(buildRecruitModal());
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'recruit:modal') {
    await interaction.deferReply({ ephemeral: true });
    const economyText = requiredText(
      interaction.fields.getTextInputValue('economy'),
      'Cash, Tokens e Money',
      1000
    );
    const focusText = requiredText(
      interaction.fields.getTextInputValue('focus'),
      'Confirmação do foco',
      500
    );
    const normalizedFocus = focusText
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    const acceptedFocus = ['sim', 'concordo', 'estou ciente', 'sim, estou ciente e concordo']
      .some((answer) => normalizedFocus.includes(answer));
    if (!acceptedFocus) {
      throw new AppError(
        'FOCUS_ACK_REQUIRED',
        'Para concluir a inscrição, confirme que está ciente e concorda que o foco é a conta de mineração e o clã.'
      );
    }

    const recruit = await context.services.recruits.createApplication(
      interaction.guild,
      interaction.user,
      {
        nick: requiredText(interaction.fields.getTextInputValue('nick'), 'Nick', 200),
        ageText: requiredText(interaction.fields.getTextInputValue('age'), 'Idade', 50),
        availability: requiredText(interaction.fields.getTextInputValue('time'), 'Disponibilidade', 1000),
        cashItems: economyText,
        balancesText: economyText,
        focusAcknowledged: true,
        focusAcknowledgementText: focusText
      }
    );
    await interaction.editReply(`✅ Formulário salvo. Envie a foto em <#${recruit.channel_id}>.`);
    return true;
  }

  const buttonMatch = interaction.isButton()
    && interaction.customId.match(/^recruit:(approve|reject):(\d+)$/);
  if (!buttonMatch) return false;
  if (!context.permissions.isLeadership(interaction.member)) {
    throw new AppError('LEADERSHIP_REQUIRED', 'Apenas Fundador ou Líder pode avaliar inscrições.');
  }

  await interaction.deferUpdate();
  const approved = buttonMatch[1] === 'approve';
  let recruitId = buttonMatch[2];
  const byId = await context.repositories.recruits.findById(interaction.guildId, recruitId);
  if (!byId) {
    const legacyActive = await context.services.recruits.getActive(interaction.guildId, recruitId);
    if (legacyActive) recruitId = legacyActive.id;
  }
  const result = await context.services.recruits.decide(
    interaction.guild,
    recruitId,
    approved,
    interaction.user
  );
  const reviewedEmbed = renderReviewedMessage(
    interaction.message.embeds[0],
    approved,
    interaction.user.tag
  );
  await interaction.editReply({
    embeds: [reviewedEmbed],
    components: result.syncErrors.length ? interaction.message.components : []
  });
  if (result.syncErrors.length) {
    await interaction.followUp({
      content: `⚠️ Decisão salva, mas houve pendências no Discord. Consulte os logs. Código da inscrição: ${result.recruit.id}.`,
      ephemeral: true
    });
  }
  return true;
}

module.exports = { buildRecruitModal, handleRecruitInteraction };
