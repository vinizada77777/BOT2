'use strict';

const path = require('node:path');
const permissions = require('./discord/permissions');
const { GuildRepository } = require('./repositories/GuildRepository');
const { PanelRepository } = require('./repositories/PanelRepository');
const { MemberRepository } = require('./repositories/MemberRepository');
const { RecruitRepository } = require('./repositories/RecruitRepository');
const { GoalRepository } = require('./repositories/GoalRepository');
const { LogRepository } = require('./repositories/LogRepository');
const { MiningRepository } = require('./repositories/MiningRepository');
const { PanelService } = require('./services/PanelService');
const { SetupService } = require('./services/SetupService');
const { RecruitService } = require('./services/RecruitService');
const { GoalService } = require('./services/GoalService');
const { MiningService } = require('./services/MiningService');
const { loadCommands } = require('./discord/loaders');

function createAppContext(options) {
  const repositories = {
    guilds: new GuildRepository(options.pool),
    panels: new PanelRepository(options.pool),
    members: new MemberRepository(options.pool),
    recruits: new RecruitRepository(options.pool),
    goals: new GoalRepository(options.pool),
    logs: new LogRepository(options.pool),
    mining: new MiningRepository(options.pool)
  };

  const panelService = new PanelService({
    panelRepository: repositories.panels,
    logger: options.logger,
    projectRoot: path.join(__dirname, '..')
  });
  const services = {
    panels: panelService,
    setup: new SetupService({
      guildRepository: repositories.guilds,
      panelService,
      logRepository: repositories.logs,
      logger: options.logger
    }),
    recruits: new RecruitService({
      recruitRepository: repositories.recruits,
      guildRepository: repositories.guilds,
      memberRepository: repositories.members,
      logRepository: repositories.logs,
      logger: options.logger
    }),
    goals: new GoalService({
      goalRepository: repositories.goals,
      guildRepository: repositories.guilds,
      panelService,
      logRepository: repositories.logs
    }),
    mining: new MiningService({
      miningRepository: repositories.mining,
      guildRepository: repositories.guilds,
      logRepository: repositories.logs,
      logger: options.logger
    })
  };

  return {
    config: options.config,
    pool: options.pool,
    logger: options.logger,
    commands: loadCommands(),
    repositories,
    services,
    permissions
  };
}

module.exports = { createAppContext };
