const db = require('../config/database');

/**
 * Admin Monitoring Model
 *
 * Raw PostgreSQL queries for database stats and per-user activity aggregation.
 * All queries are read-only and access internal schemas (trx, mst, sys, log).
 */
const adminMonitoringModel = {

  // ─── Per-User Stats ──────────────────────────────────────────────────────────

  /**
   * Returns aggregated stats for all users, joined across multiple transaction tables.
   * Uses LEFT JOINs so users with zero activity still appear.
   */
  async getAllUserStats() {
    const result = await db.query(`
      SELECT
        u.id,
        u.username,
        u.role,
        u.is_super_admin,
        u.accessible_modules,
        u.created_at                                          AS account_created_at,

        -- Batch / purchase activity
        COALESCE(b.batch_count, 0)                           AS batch_count,
        COALESCE(pur.purchase_count, 0)                      AS purchase_count,

        -- Sales activity
        COALESCE(s.sale_count, 0)                            AS sale_count,

        -- File uploads (metadata from trx.files)
        COALESCE(f.file_count, 0)                            AS file_count,
        COALESCE(f.total_size_bytes, 0)                      AS total_file_size_bytes,

        -- Activity log (last 30 days)
        COALESCE(la.action_count_30d, 0)                     AS action_count_30d,
        la.last_activity_at

      FROM sys.users u

      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS batch_count
        FROM trx.batches
        WHERE created_by = u.id
      ) b ON true

      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS purchase_count
        FROM trx.purchases
        WHERE filled_by = u.id
      ) pur ON true

      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS sale_count
        FROM trx.sales
        WHERE created_by = u.id
      ) s ON true

      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)             AS file_count,
          SUM(size_bytes)      AS total_size_bytes
        FROM trx.files f2
        WHERE (to_jsonb(f2)->>'created_by')::uuid = u.id
      ) f ON true

      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)             AS action_count_30d,
          MAX(created_at)      AS last_activity_at
        FROM log.activity
        WHERE user_id = u.id
          AND created_at >= NOW() - INTERVAL '30 days'
      ) la ON true

      ORDER BY u.created_at ASC
    `);
    return result.rows;
  },

  /**
   * Returns detail for a single user including weekly activity trend (last 8 weeks).
   */
  async getUserDetail(userId) {
    const [userRow, weeklyTrend] = await Promise.all([
      db.query(`
        SELECT
          u.id, u.username, u.role, u.is_super_admin, u.accessible_modules,
          u.privilege_level, u.created_at,
          COALESCE(b.batch_count, 0)        AS batch_count,
          COALESCE(pur.purchase_count, 0)   AS purchase_count,
          COALESCE(s.sale_count, 0)         AS sale_count,
          COALESCE(f.file_count, 0)         AS file_count,
          COALESCE(f.total_size_bytes, 0)   AS total_file_size_bytes,
          COALESCE(la.total_actions, 0)     AS total_actions,
          la.last_activity_at
        FROM sys.users u
        LEFT JOIN LATERAL (SELECT COUNT(*) AS batch_count FROM trx.batches WHERE created_by = u.id) b ON true
        LEFT JOIN LATERAL (SELECT COUNT(*) AS purchase_count FROM trx.purchases WHERE filled_by = u.id) pur ON true
        LEFT JOIN LATERAL (SELECT COUNT(*) AS sale_count FROM trx.sales WHERE created_by = u.id) s ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS file_count, SUM(size_bytes) AS total_size_bytes
          FROM trx.files f2 WHERE (to_jsonb(f2)->>'created_by')::uuid = u.id
        ) f ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS total_actions, MAX(created_at) AS last_activity_at
          FROM log.activity WHERE user_id = u.id
        ) la ON true
        WHERE u.id = $1
      `, [userId]),

      db.query(`
        SELECT
          DATE_TRUNC('week', created_at) AS week_start,
          COUNT(*)                       AS action_count
        FROM log.activity
        WHERE user_id = $1
          AND created_at >= NOW() - INTERVAL '8 weeks'
        GROUP BY 1
        ORDER BY 1 ASC
      `, [userId]),
    ]);

    return {
      user: userRow.rows[0] || null,
      weeklyTrend: weeklyTrend.rows,
    };
  },

  // ─── Database Stats ───────────────────────────────────────────────────────────

  /**
   * Returns size and row count for all tables in the monitored schemas.
   */
  async getDatabaseTableSizes() {
    const result = await db.query(`
      SELECT
        schemaname                                                    AS schema,
        tablename                                                     AS table_name,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size_pretty,
        pg_total_relation_size(schemaname || '.' || tablename)        AS size_bytes,
        pg_size_pretty(pg_relation_size(schemaname || '.' || tablename))       AS data_size_pretty,
        pg_relation_size(schemaname || '.' || tablename)              AS data_size_bytes,
        pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename))        AS index_size_pretty
      FROM pg_tables
      WHERE schemaname IN ('trx', 'mst', 'sys', 'log')
      ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
    `);
    return result.rows;
  },

  /**
   * Returns total database size and connection pool info.
   */
  async getDatabaseOverview() {
    const [sizeRow, connRow] = await Promise.all([
      db.query(`
        SELECT
          pg_size_pretty(pg_database_size(current_database())) AS db_size_pretty,
          pg_database_size(current_database())                  AS db_size_bytes,
          current_database()                                    AS db_name
      `),
      db.query(`
        SELECT
          COUNT(*)                                           AS total_connections,
          SUM(CASE WHEN state = 'active' THEN 1 ELSE 0 END) AS active_connections,
          SUM(CASE WHEN state = 'idle'   THEN 1 ELSE 0 END) AS idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `),
    ]);

    return {
      ...sizeRow.rows[0],
      ...connRow.rows[0],
    };
  },

  /**
   * Returns row counts for key business tables.
   */
  async getKeyTableRowCounts() {
    const result = await db.query(`
      SELECT table_name, row_count FROM (
        VALUES
          ('trx.batches',          (SELECT COUNT(*) FROM trx.batches)),
          ('trx.purchases',        (SELECT COUNT(*) FROM trx.purchases)),
          ('trx.inventory_items',  (SELECT COUNT(*) FROM trx.inventory_items)),
          ('trx.sales',            (SELECT COUNT(*) FROM trx.sales)),
          ('trx.sale_items',       (SELECT COUNT(*) FROM trx.sale_items)),
          ('trx.journal_entries',  (SELECT COUNT(*) FROM trx.journal_entries)),
          ('trx.journal_lines',    (SELECT COUNT(*) FROM trx.journal_lines)),
          ('trx.files',            (SELECT COUNT(*) FROM trx.files)),
          ('trx.drying_processes', (SELECT COUNT(*) FROM trx.drying_processes)),
          ('trx.processes',        (SELECT COUNT(*) FROM trx.processes)),
          ('sys.users',            (SELECT COUNT(*) FROM sys.users)),
          ('log.activity',         (SELECT COUNT(*) FROM log.activity))
      ) AS t(table_name, row_count)
      ORDER BY row_count DESC
    `);
    return result.rows;
  },

  /**
   * Returns weekly data entry growth for the last 12 weeks (purchases as proxy for activity).
   */
  async getDataGrowthTrend() {
    const result = await db.query(`
      SELECT
        DATE_TRUNC('week', created_at) AS week_start,
        COUNT(*)                       AS new_purchases
      FROM trx.purchases
      WHERE created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY 1
      ORDER BY 1 ASC
    `);
    return result.rows;
  },

  // ─── Storage Stats (from trx.files — DB-side tracking) ───────────────────────

  /**
   * Aggregates storage usage from trx.files metadata (size_bytes per file upload).
   * Fallback when Supabase service_role key is not configured.
   */
  async getStorageStatsFromDb() {
    const [byType, byUser, topFiles, monthlyGrowth] = await Promise.all([
      db.query(`
        SELECT
          file_type,
          COUNT(*)        AS file_count,
          SUM(size_bytes) AS total_bytes,
          AVG(size_bytes) AS avg_bytes
        FROM trx.files
        GROUP BY file_type
        ORDER BY total_bytes DESC
      `),

      db.query(`
        SELECT
          u.username,
          u.role,
          COUNT(f.id)          AS file_count,
          SUM(f.size_bytes)    AS total_bytes
        FROM trx.files f
        JOIN sys.users u ON (to_jsonb(f)->>'created_by')::uuid = u.id
        GROUP BY u.id, u.username, u.role
        ORDER BY total_bytes DESC
      `),

      db.query(`
        SELECT
          id, original_name, file_type, size_bytes, created_at,
          purchase_id, process_id, sale_id
        FROM trx.files
        ORDER BY size_bytes DESC
        LIMIT 10
      `),

      db.query(`
        SELECT
          DATE_TRUNC('month', created_at) AS month,
          COUNT(*)                        AS file_count,
          SUM(size_bytes)                 AS total_bytes
        FROM trx.files
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY 1
        ORDER BY 1 ASC
      `),
    ]);

    return {
      source: 'database',
      byFileType: byType.rows,
      byUser: byUser.rows,
      topFiles: topFiles.rows,
      monthlyGrowth: monthlyGrowth.rows,
    };
  },
};

module.exports = adminMonitoringModel;
