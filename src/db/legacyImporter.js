'use strict';

const crypto = require('node:crypto');
const { withTransaction } = require('./transaction');
const { ROLE_DEFINITIONS, CATEGORY_DEFINITIONS } = require('../discord/template');

function normalizeName(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
}

const ROLE_KEY_BY_NAME = new Map(ROLE_DEFINITIONS.map((role) => [normalizeName(role.name), role.key]));
const CHANNEL_KEY_BY_NAME = new Map(
  CATEGORY_DEFINITIONS.flatMap((category) =>
    category.channels.map((channel) => [normalizeName(channel.name), channel.key])
  )
);
const PANEL_KEY_BY_CHANNEL_KEY = new Map([
  ['welcome', 'welcome'],
  ['rules', 'rules'],
  ['objectives', 'objectives'],
  ['hierarchy', 'hierarchy'],
  ['recruitment-panel', 'recruitment'],
  ['help', 'help'],
  ['goals', 'active-goal']
]);

function stableFingerprint(rows) {
  const stable = [...rows]
    .map((row) => ({ key: row.key, value: row.value }))
    .sort((left, right) => left.key.localeCompare(right.key));
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

function timestamp(value) {
  const date = new Date(Number(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function recruitStatus(value) {
  return {
    awaiting_photo: 'awaiting_photo',
    sending: 'awaiting_photo',
    pending: 'pending',
    processing: 'pending',
    approved: 'approved',
    rejected: 'rejected'
  }[value] || 'cancelled';
}

function contributionStatus(value) {
  return {
    pending: 'pending',
    processing: 'pending',
    approved: 'approved',
    rejected: 'rejected'
  }[value] || 'cancelled';
}

class LegacyImporter {
  constructor(options) {
    this.pool = options.pool;
    this.logger = options.logger;
  }

  async importBotStore() {
    const exists = await this.pool.query("SELECT to_regclass('bot_store') AS table_name");
    if (!exists.rows[0]?.table_name) return { imported: false, reason: 'table_missing' };
    const result = await this.pool.query('SELECT key, value FROM bot_store ORDER BY key');
    if (!result.rowCount) return { imported: false, reason: 'empty' };
    return this.importRows('bot_store', result.rows);
  }

  async importRows(source, rows) {
    const fingerprint = stableFingerprint(rows);
    const existing = await this.pool.query(
      'SELECT * FROM legacy_imports WHERE source = $1 AND fingerprint = $2',
      [source, fingerprint]
    );
    if (existing.rowCount) {
      return { imported: false, reason: 'already_imported', record: existing.rows[0] };
    }

    const values = new Map(rows.map((row) => [row.key, row.value]));
    const guildIds = new Set();
    for (const key of values.keys()) {
      const separator = key.indexOf('-');
      if (separator >= 0) {
        const candidate = key.replace(/^(config|applications|meta|pending-meta|history-meta)-/, '');
        if (/^\d{10,30}$/.test(candidate)) guildIds.add(candidate);
      }
    }

    let importedCount = 0;
    let skippedCount = 0;
    const warnings = [];

    await withTransaction(this.pool, async (client) => {
      for (const guildId of guildIds) {
        await client.query(
          `INSERT INTO guild_settings (guild_id)
           VALUES ($1)
           ON CONFLICT (guild_id) DO NOTHING`,
          [guildId]
        );
      }

      const safe = async (label, work) => {
        const savepoint = `legacy_${importedCount + skippedCount + 1}`;
        await client.query(`SAVEPOINT ${savepoint}`);
        try {
          const count = Number(await work()) || 0;
          importedCount += count;
          await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        } catch (error) {
          skippedCount += 1;
          warnings.push(`${label}: ${error.message}`.slice(0, 500));
          await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        }
      };

      for (const guildId of guildIds) {
        await safe(`config-${guildId}`, () => this.importConfig(client, guildId, values.get(`config-${guildId}`)));
        await safe(`meta-${guildId}`, () => this.importCurrentGoal(client, guildId, values.get(`meta-${guildId}`)));
        await safe(`applications-${guildId}`, () => this.importRecruits(client, guildId, values.get(`applications-${guildId}`)));
        await safe(`pending-meta-${guildId}`, () => this.importPendingContributions(client, guildId, values.get(`pending-meta-${guildId}`)));
        await safe(`history-meta-${guildId}`, () => this.importHistory(client, guildId, values.get(`history-meta-${guildId}`)));
        await safe(`contributors-${guildId}`, () => this.importContributorAdjustments(client, guildId, values.get(`meta-${guildId}`)));
      }

      await client.query(
        `INSERT INTO legacy_imports (
           source, fingerprint, imported_count, skipped_count, status
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [
          source,
          fingerprint,
          importedCount,
          skippedCount,
          skippedCount ? 'completed_with_warnings' : 'completed'
        ]
      );
    });

    if (warnings.length) {
      this.logger.warn('⚠️ Importação antiga concluída com avisos.', {
        skippedCount,
        warnings: warnings.slice(0, 10)
      });
    } else {
      this.logger.info(`✅ Importação antiga concluída: ${importedCount} registros.`);
    }
    return { imported: true, importedCount, skippedCount, warnings };
  }

  async upsertConfig(client, guildId, key, value) {
    if (!value) return 0;
    await client.query(
      `INSERT INTO configs (guild_id, config_key, config_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, config_key) DO NOTHING`,
      [guildId, key, String(value)]
    );
    return 1;
  }

  async importConfig(client, guildId, config) {
    if (!config || typeof config !== 'object') return 0;
    let count = 0;
    for (const [name, id] of Object.entries(config.roles || {})) {
      const key = ROLE_KEY_BY_NAME.get(normalizeName(name));
      if (key) count += await this.upsertConfig(client, guildId, `role:${key}`, id);
    }
    for (const [name, id] of Object.entries(config.channels || {})) {
      const key = CHANNEL_KEY_BY_NAME.get(normalizeName(name));
      if (key) count += await this.upsertConfig(client, guildId, `channel:${key}`, id);
    }
    for (const [name, messageId] of Object.entries(config.messages || {})) {
      const channelKey = CHANNEL_KEY_BY_NAME.get(normalizeName(name));
      const channelId = channelKey && config.channels?.[name];
      if (!channelKey || !channelId || !messageId) continue;
      const panelKey = PANEL_KEY_BY_CHANNEL_KEY.get(channelKey);
      if (!panelKey) continue;
      await client.query(
        `INSERT INTO panels (guild_id, panel_key, channel_id, message_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id, panel_key) DO NOTHING`,
        [guildId, panelKey, String(channelId), String(messageId)]
      );
      count += 1;
    }
    return count;
  }

  async ensureLegacyGoal(client, guildId, legacyMetaId, values = {}) {
    const legacyKey = `goal:${guildId}:${legacyMetaId || values.name || 'unknown'}`;
    const existing = await client.query('SELECT id FROM goals WHERE legacy_key = $1', [legacyKey]);
    if (existing.rowCount) return existing.rows[0].id;

    const hasActive = await client.query(
      "SELECT 1 FROM goals WHERE guild_id = $1 AND status = 'active'",
      [guildId]
    );
    const status = values.active && !hasActive.rowCount ? 'active' : 'closed';
    const target = Number(values.target);
    const result = await client.query(
      `INSERT INTO goals (
         legacy_key, guild_id, name, goal_type, target, status,
         created_by, created_at, closed_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()), $9)
       ON CONFLICT (legacy_key)
       DO UPDATE SET legacy_key = EXCLUDED.legacy_key
       RETURNING id`,
      [
        legacyKey,
        guildId,
        String(values.name || 'Meta importada').slice(0, 500),
        values.type === 'tokens' ? 'tokens' : 'money',
        Number.isFinite(target) && target > 0 ? target : 1,
        status,
        String(values.createdBy || 'legacy-import'),
        timestamp(values.createdAt),
        status === 'closed' ? new Date() : null
      ]
    );
    return result.rows[0].id;
  }

  async importCurrentGoal(client, guildId, meta) {
    if (!meta || typeof meta !== 'object') return 0;
    await this.ensureLegacyGoal(client, guildId, meta.id, {
      ...meta,
      active: true
    });
    return 1;
  }

  async importRecruits(client, guildId, applications) {
    if (!applications || typeof applications !== 'object') return 0;
    let count = 0;
    for (const [userId, application] of Object.entries(applications)) {
      if (!application || typeof application !== 'object') continue;
      const result = await client.query(
        `INSERT INTO recruits (
           legacy_key, guild_id, user_id, nick, age_text, availability,
           cash_items, balances_text, channel_id, review_message_id,
           status, reviewed_by, created_at, photo_received_at, reviewed_at
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, COALESCE($13, NOW()), $14, $15
         )
         ON CONFLICT (legacy_key)
         DO UPDATE SET legacy_key = EXCLUDED.legacy_key
         RETURNING id`,
        [
          `recruit:${guildId}:${userId}:${application.createdAt || 'legacy'}`,
          guildId,
          userId,
          String(application.nick || 'Não informado'),
          String(application.age || 'Não informado'),
          String(application.time || 'Não informado'),
          String(application.cash || 'Não informado'),
          String(application.balances || 'Não informado'),
          application.channelId ? String(application.channelId) : null,
          application.approvalMessageId ? String(application.approvalMessageId) : null,
          recruitStatus(application.status),
          application.reviewedBy ? String(application.reviewedBy) : null,
          timestamp(application.createdAt),
          timestamp(application.submittedAt),
          timestamp(application.reviewedAt)
        ]
      );
      const recruitId = result.rows[0].id;
      if (application.photo) {
        await client.query(
          `INSERT INTO recruit_images (recruit_id, discord_url, is_primary)
           VALUES ($1, $2, TRUE)
           ON CONFLICT (recruit_id) WHERE is_primary DO NOTHING`,
          [recruitId, String(application.photo)]
        );
      }
      count += 1;
    }
    return count;
  }

  async importPendingContributions(client, guildId, pending) {
    if (!pending || typeof pending !== 'object') return 0;
    let count = 0;
    for (const [entryId, contribution] of Object.entries(pending)) {
      if (!contribution || typeof contribution !== 'object' || Number(contribution.amount) <= 0) continue;
      const goalId = await this.ensureLegacyGoal(client, guildId, contribution.metaId, {
        name: contribution.metaName,
        type: contribution.metaType,
        target: contribution.amount,
        active: false
      });
      await client.query(
        `INSERT INTO contributions (
           legacy_key, goal_id, guild_id, user_id, amount, proof_url,
           observation, review_message_id, status, reviewed_by,
           created_at, reviewed_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, NOW()), $12)
         ON CONFLICT (legacy_key) DO NOTHING`,
        [
          `contribution:${guildId}:${contribution.id || entryId}`,
          goalId,
          guildId,
          String(contribution.userId),
          Number(contribution.amount),
          contribution.proof ? String(contribution.proof) : null,
          contribution.observation ? String(contribution.observation) : null,
          contribution.messageId ? String(contribution.messageId) : null,
          contributionStatus(contribution.status),
          contribution.reviewedBy ? String(contribution.reviewedBy) : null,
          timestamp(contribution.createdAt),
          timestamp(contribution.reviewedAt)
        ]
      );
      count += 1;
    }
    return count;
  }

  async importHistory(client, guildId, history) {
    if (!history || typeof history !== 'object') return 0;
    let count = 0;
    for (const [userId, entries] of Object.entries(history)) {
      if (!Array.isArray(entries)) continue;
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (!entry || Number(entry.amount) <= 0) continue;
        const goalId = await this.ensureLegacyGoal(client, guildId, entry.metaId, {
          name: entry.metaName,
          type: entry.type,
          target: entry.amount,
          active: false
        });
        await client.query(
          `INSERT INTO contributions (
             legacy_key, goal_id, guild_id, user_id, amount,
             status, reviewed_by, created_at, reviewed_at
           )
           VALUES ($1, $2, $3, $4, $5, 'approved', $6, COALESCE($7, NOW()), COALESCE($7, NOW()))
           ON CONFLICT (legacy_key) DO NOTHING`,
          [
            `contribution:${guildId}:${entry.contributionId || `${userId}:${index}:${entry.approvedAt || 'legacy'}`}`,
            goalId,
            guildId,
            userId,
            Number(entry.amount),
            entry.approvedBy ? String(entry.approvedBy) : null,
            timestamp(entry.approvedAt)
          ]
        );
        count += 1;
      }
    }
    return count;
  }

  async importContributorAdjustments(client, guildId, meta) {
    if (!meta?.contributors || typeof meta.contributors !== 'object') return 0;
    const goal = await client.query(
      'SELECT id FROM goals WHERE legacy_key = $1',
      [`goal:${guildId}:${meta.id || meta.name || 'unknown'}`]
    );
    if (!goal.rowCount) return 0;

    let count = 0;
    for (const [userId, desiredValue] of Object.entries(meta.contributors)) {
      const desired = Number(desiredValue);
      if (!Number.isFinite(desired) || desired <= 0) continue;
      const actualResult = await client.query(
        `SELECT COALESCE(SUM(amount), 0)::TEXT AS total
         FROM contributions
         WHERE goal_id = $1 AND user_id = $2 AND status = 'approved'`,
        [goal.rows[0].id, userId]
      );
      const difference = desired - Number(actualResult.rows[0].total);
      if (difference <= 0) continue;
      await client.query(
        `INSERT INTO contributions (
           legacy_key, goal_id, guild_id, user_id, amount,
           observation, status, reviewed_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'approved', NOW())
         ON CONFLICT (legacy_key) DO NOTHING`,
        [
          `contribution-adjustment:${guildId}:${meta.id}:${userId}`,
          goal.rows[0].id,
          guildId,
          userId,
          difference,
          'Ajuste automático para preservar o total legado.'
        ]
      );
      count += 1;
    }
    return count;
  }
}

module.exports = {
  LegacyImporter,
  stableFingerprint,
  recruitStatus,
  contributionStatus
};
