'use strict';

const { EmbedBuilder, Events } = require('discord.js');
const { COLORS } = require('../config/constants');

module.exports = {
  name: Events.GuildMemberAdd,

  async execute(member, context) {
    await context.repositories.guilds.ensure(member.guild.id);
    const config = await context.repositories.guilds.getConfigs(member.guild.id);
    const visitorRole = member.guild.roles.cache.get(config['role:visitor']);
    if (visitorRole) await member.roles.add(visitorRole, 'Entrada no servidor VGS').catch(() => {});
    await context.repositories.members.upsert(member.guild.id, member.id, {
      status: 'visitor',
      joinedAt: member.joinedAt
    });

    const channel = member.guild.channels.cache.get(config['channel:welcome']);
    if (channel?.isTextBased()) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.GOLD)
            .setDescription(`👋 Bem-vindo, ${member}! Leia as regras e faça sua inscrição para entrar no **VGS**.`)
        ]
      }).catch(() => {});
    }
  }
};
