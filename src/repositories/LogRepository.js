'use strict';

class LogRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async record(entry, queryable = this.pool) {
    const result = await queryable.query(
      `INSERT INTO logs (
         guild_id, event_type, actor_user_id, target_user_id,
         entity_type, entity_id, message, correlation_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        entry.guildId,
        entry.eventType,
        entry.actorUserId || null,
        entry.targetUserId || null,
        entry.entityType || null,
        entry.entityId ? String(entry.entityId) : null,
        entry.message,
        entry.correlationId
      ]
    );
    return result.rows[0].id;
  }
}

module.exports = { LogRepository };
