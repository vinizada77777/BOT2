'use strict';

class GuildRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async ensure(guildId, queryable = this.pool) {
    await queryable.query(
      `INSERT INTO guild_settings (guild_id)
       VALUES ($1)
       ON CONFLICT (guild_id)
       DO UPDATE SET updated_at = NOW()`,
      [guildId]
    );
  }

  async getSettings(guildId) {
    const result = await this.pool.query(
      'SELECT * FROM guild_settings WHERE guild_id = $1',
      [guildId]
    );
    return result.rows[0] || null;
  }

  async getConfigs(guildId) {
    const result = await this.pool.query(
      'SELECT config_key, config_value FROM configs WHERE guild_id = $1',
      [guildId]
    );
    return Object.fromEntries(result.rows.map((row) => [row.config_key, row.config_value]));
  }

  async setConfig(guildId, key, value, queryable = this.pool) {
    await this.ensure(guildId, queryable);
    await queryable.query(
      `INSERT INTO configs (guild_id, config_key, config_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, config_key)
       DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW()`,
      [guildId, key, String(value)]
    );
  }

  async incrementSetupVersion(guildId) {
    const result = await this.pool.query(
      `UPDATE guild_settings
       SET setup_version = setup_version + 1, updated_at = NOW()
       WHERE guild_id = $1
       RETURNING setup_version`,
      [guildId]
    );
    return result.rows[0]?.setup_version || 0;
  }
}

module.exports = { GuildRepository };
