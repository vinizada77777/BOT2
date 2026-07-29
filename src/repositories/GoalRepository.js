'use strict';

const { AppError } = require('../errors/AppError');
const { withTransaction } = require('../db/transaction');

class GoalRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async createGoal(values) {
    return withTransaction(this.pool, async (client) => {
      await client.query(
        `UPDATE goals
         SET status = 'closed', closed_at = NOW(), updated_at = NOW()
         WHERE guild_id = $1 AND status = 'active'`,
        [values.guildId]
      );
      const result = await client.query(
        `INSERT INTO goals (guild_id, name, goal_type, target, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [values.guildId, values.name, values.goalType, values.target, values.createdBy]
      );
      return result.rows[0];
    });
  }


  async updateActiveGoal(guildId, values) {
    const result = await this.pool.query(
      `UPDATE goals
       SET name = COALESCE($2, name),
           goal_type = COALESCE($3, goal_type),
           target = COALESCE($4, target),
           updated_at = NOW()
       WHERE guild_id = $1 AND status = 'active'
       RETURNING *`,
      [guildId, values.name || null, values.goalType || null, values.target || null]
    );
    if (!result.rows[0]) {
      throw new AppError('NO_ACTIVE_GOAL', 'Não existe meta ativa para editar.');
    }
    return result.rows[0];
  }

  async closeActiveGoal(guildId) {
    const result = await this.pool.query(
      `UPDATE goals
       SET status = 'closed', closed_at = NOW(), updated_at = NOW()
       WHERE guild_id = $1 AND status = 'active'
       RETURNING *`,
      [guildId]
    );
    if (!result.rows[0]) {
      throw new AppError('NO_ACTIVE_GOAL', 'Não existe meta ativa para encerrar.');
    }
    return result.rows[0];
  }

  async getActiveGoal(guildId) {
    const result = await this.pool.query(
      `SELECT g.*,
              COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'approved'), 0)::TEXT AS current
       FROM goals g
       LEFT JOIN contributions c ON c.goal_id = g.id
       WHERE g.guild_id = $1 AND g.status = 'active'
       GROUP BY g.id
       LIMIT 1`,
      [guildId]
    );
    return result.rows[0] || null;
  }

  async getGoalById(guildId, goalId) {
    const result = await this.pool.query(
      `SELECT g.*,
              COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'approved'), 0)::TEXT AS current
       FROM goals g
       LEFT JOIN contributions c ON c.goal_id = g.id
       WHERE g.guild_id = $1 AND g.id = $2
       GROUP BY g.id`,
      [guildId, goalId]
    );
    return result.rows[0] || null;
  }

  async createContribution(values) {
    try {
      return await withTransaction(this.pool, async (client) => {
        const goalResult = await client.query(
          `SELECT *
           FROM goals
           WHERE guild_id = $1 AND status = 'active'
           FOR UPDATE`,
          [values.guildId]
        );
        const goal = goalResult.rows[0];
        if (!goal) {
          throw new AppError('NO_ACTIVE_GOAL', 'Não existe meta ativa.');
        }

        const result = await client.query(
          `INSERT INTO contributions (
             goal_id, guild_id, user_id, amount, proof_url,
             proof_filename, proof_content_type, observation
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            goal.id,
            values.guildId,
            values.userId,
            values.amount,
            values.proofUrl,
            values.proofFilename || null,
            values.proofContentType || null,
            values.observation || null
          ]
        );
        return { goal, contribution: result.rows[0] };
      });
    } catch (error) {
      if (error.code === '23505') {
        throw new AppError(
          'PENDING_CONTRIBUTION_EXISTS',
          'Você já possui uma contribuição pendente nesta meta.',
          { cause: error }
        );
      }
      throw error;
    }
  }

  async setContributionReviewMessage(contributionId, messageId, mirroredProof = null) {
    await this.pool.query(
      `UPDATE contributions
       SET review_message_id = $2,
           proof_url = COALESCE($3, proof_url),
           proof_filename = COALESCE($4, proof_filename),
           proof_content_type = COALESCE($5, proof_content_type),
           updated_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [
        contributionId,
        messageId,
        mirroredProof?.url || null,
        mirroredProof?.name || null,
        mirroredProof?.contentType || null
      ]
    );
  }

  async cancelContribution(contributionId) {
    await this.pool.query(
      `UPDATE contributions
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [contributionId]
    );
  }

  async decideContribution(guildId, contributionId, decision, reviewerId) {
    if (!['approved', 'rejected'].includes(decision)) throw new Error('Decisão inválida.');

    return withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `UPDATE contributions
         SET status = $3,
             reviewed_by = $4,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE guild_id = $1 AND id = $2 AND status IN ('pending', 'processing')
         RETURNING *`,
        [guildId, contributionId, decision, reviewerId]
      );
      if (result.rowCount) return { contribution: result.rows[0], changed: true };

      const existing = await client.query(
        'SELECT * FROM contributions WHERE guild_id = $1 AND id = $2',
        [guildId, contributionId]
      );
      return { contribution: existing.rows[0] || null, changed: false };
    });
  }

  async findContributionByLegacyIdentifier(guildId, legacyIdentifier) {
    const result = await this.pool.query(
      `SELECT *
       FROM contributions
       WHERE guild_id = $1 AND legacy_key = $2`,
      [guildId, `contribution:${guildId}:${legacyIdentifier}`]
    );
    return result.rows[0] || null;
  }

  async getRanking(goalId, limit = 10) {
    const result = await this.pool.query(
      `SELECT user_id, SUM(amount)::TEXT AS total
       FROM contributions
       WHERE goal_id = $1 AND status = 'approved'
       GROUP BY user_id
       ORDER BY SUM(amount) DESC, user_id ASC
       LIMIT $2`,
      [goalId, limit]
    );
    return result.rows;
  }

  async getUserHistory(guildId, userId, limit = 10) {
    const result = await this.pool.query(
      `SELECT c.id, c.amount::TEXT AS amount, c.reviewed_at,
              g.name AS goal_name, g.goal_type
       FROM contributions c
       JOIN goals g ON g.id = c.goal_id
       WHERE c.guild_id = $1 AND c.user_id = $2 AND c.status = 'approved'
       ORDER BY c.reviewed_at DESC NULLS LAST, c.created_at DESC
       LIMIT $3`,
      [guildId, userId, limit]
    );
    return result.rows;
  }

  async getUserSummary(guildId, userId) {
    const result = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE c.status = 'approved')::INTEGER AS approved_count,
         COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'approved'), 0)::TEXT AS historical_total,
         COALESCE(SUM(c.amount) FILTER (
           WHERE c.status = 'approved' AND g.status = 'active'
         ), 0)::TEXT AS active_total
       FROM contributions c
       JOIN goals g ON g.id = c.goal_id
       WHERE c.guild_id = $1 AND c.user_id = $2`,
      [guildId, userId]
    );
    return result.rows[0];
  }
}

module.exports = { GoalRepository };
