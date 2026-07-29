'use strict';

class PanelRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async get(guildId, panelKey) {
    const result = await this.pool.query(
      'SELECT * FROM panels WHERE guild_id = $1 AND panel_key = $2',
      [guildId, panelKey]
    );
    return result.rows[0] || null;
  }

  async upsert(guildId, panelKey, channelId, messageId) {
    const result = await this.pool.query(
      `INSERT INTO panels (guild_id, panel_key, channel_id, message_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guild_id, panel_key)
       DO UPDATE SET
         channel_id = EXCLUDED.channel_id,
         message_id = EXCLUDED.message_id,
         revision = panels.revision + 1,
         updated_at = NOW()
       RETURNING *`,
      [guildId, panelKey, channelId, messageId]
    );
    return result.rows[0];
  }
}

module.exports = { PanelRepository };
