'use strict';

class MemberRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async upsert(guildId, userId, values = {}) {
    const result = await this.pool.query(
      `INSERT INTO members (guild_id, user_id, game_nick, status, joined_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET
         game_nick = COALESCE(EXCLUDED.game_nick, members.game_nick),
         status = EXCLUDED.status,
         joined_at = COALESCE(members.joined_at, EXCLUDED.joined_at),
         left_at = NULL,
         updated_at = NOW()
       RETURNING *`,
      [
        guildId,
        userId,
        values.gameNick || null,
        values.status || 'visitor',
        values.joinedAt || null
      ]
    );
    return result.rows[0];
  }

  async find(guildId, userId) {
    const result = await this.pool.query(
      'SELECT * FROM members WHERE guild_id = $1 AND user_id = $2',
      [guildId, userId]
    );
    return result.rows[0] || null;
  }
}

module.exports = { MemberRepository };
