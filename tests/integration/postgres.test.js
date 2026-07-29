'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const { runMigrations } = require('../../src/db/migrator');
const { GuildRepository } = require('../../src/repositories/GuildRepository');
const { RecruitRepository } = require('../../src/repositories/RecruitRepository');
const { GoalRepository } = require('../../src/repositories/GoalRepository');
const { LegacyImporter } = require('../../src/db/legacyImporter');
const { bootstrap } = require('../../src/bootstrap');

const databaseUrl = process.env.DATABASE_TEST_URL;
const enabled = Boolean(databaseUrl && process.env.ALLOW_DATABASE_TESTS === 'true');

test('migrações e restrições funcionam em PostgreSQL real', { skip: !enabled }, async () => {
  const schemaName = `vgs_test_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
  assert.match(schemaName, /^vgs_test_[a-z0-9_]+$/);
  const admin = new Pool({ connectionString: databaseUrl, max: 1 });
  await admin.query(`CREATE SCHEMA "${schemaName}"`);
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    options: `-c search_path=${schemaName},public`
  });

  try {
    await runMigrations(pool, { logger: { info() {} } });
    await runMigrations(pool, { logger: { info() {} } });
    const migrationCount = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM schema_migrations');
    assert.equal(migrationCount.rows[0].count, 1);

    const tables = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1`,
      [schemaName]
    );
    assert.ok(tables.rows.some((row) => row.table_name === 'recruits'));
    assert.ok(tables.rows.some((row) => row.table_name === 'contributions'));

    await pool.query("INSERT INTO guild_settings (guild_id) VALUES ('guild')");
    await pool.query(
      `INSERT INTO recruits (
         guild_id, user_id, nick, age_text, availability, cash_items, balances_text, status
       ) VALUES ('guild', 'user', 'Nick', '18', 'Sempre', 'Não', '0', 'awaiting_photo')`
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO recruits (
           guild_id, user_id, nick, age_text, availability, cash_items, balances_text, status
         ) VALUES ('guild', 'user', 'Nick2', '18', 'Sempre', 'Não', '0', 'pending')`
      ),
      (error) => error.code === '23505'
    );

    const guilds = new GuildRepository(pool);
    const recruits = new RecruitRepository(pool);
    const goals = new GoalRepository(pool);
    await guilds.ensure('repository-guild');

    const recruit = await recruits.create({
      guildId: 'repository-guild',
      userId: 'candidate',
      nick: 'Nick',
      ageText: '18',
      availability: 'Sempre',
      cashItems: 'Não',
      balancesText: '0'
    });
    await assert.rejects(
      recruits.create({
        guildId: 'repository-guild',
        userId: 'candidate',
        nick: 'Outro',
        ageText: '18',
        availability: 'Sempre',
        cashItems: 'Não',
        balancesText: '0'
      }),
      (error) => error.code === 'ACTIVE_RECRUIT_EXISTS'
    );
    await pool.query("UPDATE recruits SET status = 'pending' WHERE id = $1", [recruit.id]);
    const firstDecision = await recruits.decide('repository-guild', recruit.id, 'approved', 'leader');
    const repeatedDecision = await recruits.decide('repository-guild', recruit.id, 'approved', 'leader');
    assert.equal(firstDecision.changed, true);
    assert.equal(repeatedDecision.changed, false);
    assert.equal(repeatedDecision.recruit.status, 'approved');

    const firstGoal = await goals.createGoal({
      guildId: 'repository-guild',
      name: 'Meta 1',
      goalType: 'money',
      target: 1000,
      createdBy: 'leader'
    });
    const secondGoal = await goals.createGoal({
      guildId: 'repository-guild',
      name: 'Meta 2',
      goalType: 'tokens',
      target: 2000,
      createdBy: 'leader'
    });
    const closedGoal = await goals.getGoalById('repository-guild', firstGoal.id);
    assert.equal(closedGoal.status, 'closed');
    const activeGoal = await goals.getActiveGoal('repository-guild');
    assert.equal(activeGoal.id, secondGoal.id);

    const createdContribution = await goals.createContribution({
      guildId: 'repository-guild',
      userId: 'member',
      amount: 250,
      proofUrl: 'https://cdn.example/proof.png'
    });
    await assert.rejects(
      goals.createContribution({
        guildId: 'repository-guild',
        userId: 'member',
        amount: 50,
        proofUrl: 'https://cdn.example/proof-2.png'
      }),
      (error) => error.code === 'PENDING_CONTRIBUTION_EXISTS'
    );
    const contributionId = createdContribution.contribution.id;
    const approved = await goals.decideContribution('repository-guild', contributionId, 'approved', 'leader');
    const approvedAgain = await goals.decideContribution('repository-guild', contributionId, 'approved', 'leader');
    assert.equal(approved.changed, true);
    assert.equal(approvedAgain.changed, false);
    const ranking = await goals.getRanking(secondGoal.id);
    assert.equal(ranking[0].total, '250.00');

    const importer = new LegacyImporter({
      pool,
      logger: { info() {}, warn() {} }
    });
    const legacyRows = [
      {
        key: 'meta-123456789012345678',
        value: {
          id: 'legacy-goal',
          name: 'Meta antiga',
          type: 'money',
          target: 1000,
          contributors: { '999': 100 },
          createdBy: '888'
        }
      },
      {
        key: 'history-meta-123456789012345678',
        value: {
          '999': [
            {
              contributionId: 'legacy-contribution',
              metaId: 'legacy-goal',
              metaName: 'Meta antiga',
              type: 'money',
              amount: 100,
              approvedAt: Date.now(),
              approvedBy: '888'
            }
          ]
        }
      }
    ];
    const imported = await importer.importRows('integration-fixture', legacyRows);
    const repeatedImport = await importer.importRows('integration-fixture', legacyRows);
    assert.equal(imported.imported, true);
    assert.equal(repeatedImport.imported, false);
    const importedTotals = await pool.query(
      `SELECT COALESCE(SUM(c.amount), 0)::TEXT AS total
       FROM contributions c
       JOIN goals g ON g.id = c.goal_id
       WHERE g.guild_id = '123456789012345678' AND c.status = 'approved'`
    );
    assert.equal(importedTotals.rows[0].total, '100.00');

    const registeredEvents = [];
    let loginToken = null;
    let destroyed = false;
    const fakeClient = {
      once(name) {
        registeredEvents.push(name);
      },
      on(name) {
        registeredEvents.push(name);
      },
      async login(token) {
        loginToken = token;
      },
      guilds: {
        async fetch(guildId) {
          return guildId === '123456789012345678' ? { id: guildId } : null;
        }
      },
      destroy() {
        destroyed = true;
      }
    };
    const bootPool = new Pool({
      connectionString: databaseUrl,
      max: 2,
      options: `-c search_path=${schemaName},public`
    });
    const boot = await bootstrap({
      pool: bootPool,
      client: fakeClient,
      environment: {
        TOKEN: 'test-token',
        CLIENT_ID: '123456789012345678',
        GUILD_ID: '123456789012345678',
        DATABASE_URL: databaseUrl,
        PGSSLMODE: 'disable'
      },
      logger: { info() {}, warn() {}, error() {} }
    });
    assert.equal(loginToken, 'test-token');
    assert.ok(registeredEvents.length >= 3);
    await boot.shutdown('integration-test');
    assert.equal(destroyed, true);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await admin.end();
  }
});
