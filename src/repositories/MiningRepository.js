'use strict';

const { AppError } = require('../errors/AppError');
const { withTransaction } = require('../db/transaction');

class MiningRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async startSession(values) {
    return withTransaction(this.pool, async (client) => {
      const active = await client.query(
        `SELECT * FROM mining_sessions
         WHERE guild_id = $1 AND user_id = $2 AND status = 'active'
         FOR UPDATE`,
        [values.guildId, values.userId]
      );
      if (active.rows[0]) {
        throw new AppError('MINING_ALREADY_ACTIVE', 'Você já possui uma mineração em andamento. Use `/mineracao finalizar`.');
      }

      const result = await client.query(
        `INSERT INTO mining_sessions (guild_id, user_id, start_channel_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [values.guildId, values.userId, values.channelId || null]
      );
      return result.rows[0];
    });
  }

  async finishSession(values) {
    return withTransaction(this.pool, async (client) => {
      const active = await client.query(
        `SELECT * FROM mining_sessions
         WHERE guild_id = $1 AND user_id = $2 AND status = 'active'
         FOR UPDATE`,
        [values.guildId, values.userId]
      );
      const session = active.rows[0];
      if (!session) {
        throw new AppError('MINING_NOT_ACTIVE', 'Você não possui uma mineração em andamento. Use `/mineracao iniciar`.');
      }

      const result = await client.query(
        `UPDATE mining_sessions
         SET status = 'finished',
             finished_at = NOW(),
             duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::BIGINT),
             finish_channel_id = $3,
             updated_at = NOW()
         WHERE id = $1 AND guild_id = $2
         RETURNING *`,
        [session.id, values.guildId, values.channelId || null]
      );
      return result.rows[0];
    });
  }

  async getActive(guildId, userId) {
    const result = await this.pool.query(
      `SELECT * FROM mining_sessions
       WHERE guild_id = $1 AND user_id = $2 AND status = 'active'
       ORDER BY started_at DESC
       LIMIT 1`,
      [guildId, userId]
    );
    return result.rows[0] || null;
  }

  async getUserSummary(guildId, userId) {
    const result = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'finished')::INTEGER AS finished_count,
         COALESCE(SUM(duration_seconds) FILTER (WHERE status = 'finished'), 0)::BIGINT AS total_seconds,
         COALESCE(MAX(duration_seconds) FILTER (WHERE status = 'finished'), 0)::BIGINT AS longest_seconds
       FROM mining_sessions
       WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    return result.rows[0];
  }

  async getRecent(guildId, limit = 10) {
    const result = await this.pool.query(
      `SELECT * FROM mining_sessions
       WHERE guild_id = $1 AND status = 'finished'
       ORDER BY finished_at DESC
       LIMIT $2`,
      [guildId, limit]
    );
    return result.rows;
  }
}

module.exports = { MiningRepository };
