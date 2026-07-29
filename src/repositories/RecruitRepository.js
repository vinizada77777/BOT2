'use strict';

const { AppError } = require('../errors/AppError');
const { withTransaction } = require('../db/transaction');

class RecruitRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findActiveByUser(guildId, userId) {
    const result = await this.pool.query(
      `SELECT *
       FROM recruits
       WHERE guild_id = $1
         AND user_id = $2
         AND status IN ('awaiting_photo', 'pending', 'processing')
       ORDER BY created_at DESC
       LIMIT 1`,
      [guildId, userId]
    );
    return result.rows[0] || null;
  }

  async findById(guildId, recruitId) {
    const result = await this.pool.query(
      `SELECT r.*, ri.discord_url AS photo_url, ri.filename AS photo_filename,
              ri.content_type AS photo_content_type
       FROM recruits r
       LEFT JOIN recruit_images ri ON ri.recruit_id = r.id AND ri.is_primary
       WHERE r.guild_id = $1 AND r.id = $2`,
      [guildId, recruitId]
    );
    return result.rows[0] || null;
  }

  async findAwaitingByChannel(guildId, userId, channelId) {
    const result = await this.pool.query(
      `SELECT *
       FROM recruits
       WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3
         AND status = 'awaiting_photo'
       ORDER BY created_at DESC
       LIMIT 1`,
      [guildId, userId, channelId]
    );
    return result.rows[0] || null;
  }

  async create(values) {
    try {
      const result = await this.pool.query(
        `INSERT INTO recruits (
           guild_id, user_id, nick, age_text, availability,
           cash_items, balances_text, focus_acknowledged,
           focus_acknowledgement_text, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'awaiting_photo')
         RETURNING *`,
        [
          values.guildId,
          values.userId,
          values.nick,
          values.ageText,
          values.availability,
          values.cashItems,
          values.balancesText,
          Boolean(values.focusAcknowledged),
          values.focusAcknowledgementText || null
        ]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new AppError(
          'ACTIVE_RECRUIT_EXISTS',
          'Você já possui uma inscrição ativa.',
          { cause: error }
        );
      }
      throw error;
    }
  }

  async setChannel(recruitId, channelId) {
    const result = await this.pool.query(
      `UPDATE recruits
       SET channel_id = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'awaiting_photo'
       RETURNING *`,
      [recruitId, channelId]
    );
    return result.rows[0] || null;
  }

  async markFailed(recruitId, reason) {
    await this.pool.query(
      `UPDATE recruits
       SET status = 'failed', decision_note = $2, updated_at = NOW()
       WHERE id = $1 AND status IN ('awaiting_photo', 'pending', 'processing')`,
      [recruitId, reason]
    );
  }

  async savePrimaryImage(recruitId, image) {
    return withTransaction(this.pool, async (client) => {
      const recruit = await client.query(
        `SELECT id, status
         FROM recruits
         WHERE id = $1
         FOR UPDATE`,
        [recruitId]
      );
      if (!recruit.rowCount || recruit.rows[0].status !== 'awaiting_photo') return null;

      const result = await client.query(
        `INSERT INTO recruit_images (
           recruit_id, discord_url, filename, content_type, size_bytes, is_primary
         )
         VALUES ($1, $2, $3, $4, $5, TRUE)
         ON CONFLICT (recruit_id) WHERE is_primary
         DO UPDATE SET
           discord_url = EXCLUDED.discord_url,
           filename = EXCLUDED.filename,
           content_type = EXCLUDED.content_type,
           size_bytes = EXCLUDED.size_bytes,
           created_at = NOW()
         RETURNING *`,
        [
          recruitId,
          image.url,
          image.name || null,
          image.contentType || null,
          image.size || null
        ]
      );
      return result.rows[0];
    });
  }

  async markPending(recruitId, reviewMessageId) {
    const result = await this.pool.query(
      `UPDATE recruits
       SET status = 'pending',
           review_message_id = $2,
           photo_received_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND status = 'awaiting_photo'
       RETURNING *`,
      [recruitId, reviewMessageId]
    );
    return result.rows[0] || null;
  }

  async decide(guildId, recruitId, decision, reviewerId) {
    if (!['approved', 'rejected'].includes(decision)) throw new Error('Decisão inválida.');

    return withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `UPDATE recruits
         SET status = $3,
             reviewed_by = $4,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE guild_id = $1 AND id = $2 AND status IN ('pending', 'processing')
         RETURNING *`,
        [guildId, recruitId, decision, reviewerId]
      );

      if (result.rowCount) return { recruit: result.rows[0], changed: true };

      const existing = await client.query(
        'SELECT * FROM recruits WHERE guild_id = $1 AND id = $2',
        [guildId, recruitId]
      );
      return { recruit: existing.rows[0] || null, changed: false };
    });
  }

  async markDiscordSynced(recruitId) {
    await this.pool.query(
      'UPDATE recruits SET discord_synced_at = NOW(), updated_at = NOW() WHERE id = $1',
      [recruitId]
    );
  }

  async markChannelClosed(recruitId) {
    await this.pool.query(
      'UPDATE recruits SET channel_closed_at = NOW(), updated_at = NOW() WHERE id = $1',
      [recruitId]
    );
  }
}

module.exports = { RecruitRepository };
