const { pool } = require('../database');
const logger = require('../utils/logger');

class Sandbox {
  static async create(sandboxData) {
    try {
      const query = `
        INSERT INTO sandboxes (
          id, name, user_id, android_version, device_profile,
          network_config, analysis_tools, security_policy,
          status, container_id, tags, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING *
      `;

      const values = [
        sandboxData.id,
        sandboxData.name,
        sandboxData.user_id,
        sandboxData.android_version,
        sandboxData.device_profile,
        JSON.stringify(sandboxData.network_config || {}),
        JSON.stringify(sandboxData.analysis_tools || []),
        sandboxData.security_policy,
        sandboxData.status,
        sandboxData.container_id || null,
        JSON.stringify(sandboxData.tags || []),
        sandboxData.created_at,
        sandboxData.updated_at
      ];

      const result = await pool.query(query, values);
      return this.formatSandbox(result.rows[0]);
    } catch (error) {
      logger.error('Error creating sandbox:', error);
      throw error;
    }
  }

  static async findById(id, userId = null) {
    try {
      let query = 'SELECT * FROM sandboxes WHERE id = $1';
      const values = [id];

      if (userId) {
        query += ' AND user_id = $2';
        values.push(userId);
      }

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatSandbox(result.rows[0]);
    } catch (error) {
      logger.error(`Error finding sandbox ${id}:`, error);
      throw error;
    }
  }

  static async list(options = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        status = null,
        search = null,
        userId = null
      } = options;

      let query = `
        SELECT * FROM sandboxes
        WHERE 1=1
      `;
      const values = [];
      let paramIndex = 1;

      if (userId) {
        query += ` AND user_id = $${paramIndex}`;
        values.push(userId);
        paramIndex++;
      }

      if (status) {
        if (Array.isArray(status)) {
          query += ` AND status = ANY($${paramIndex})`;
          values.push(status);
        } else {
          query += ` AND status = $${paramIndex}`;
          values.push(status);
        }
        paramIndex++;
      }

      if (search) {
        query += ` AND (name ILIKE $${paramIndex} OR tags::text ILIKE $${paramIndex})`;
        values.push(`%${search}%`);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(limit, offset);

      const result = await pool.query(query);
      return result.rows.map(row => this.formatSandbox(row));
    } catch (error) {
      logger.error('Error listing sandboxes:', error);
      throw error;
    }
  }

  static async count(options = {}) {
    try {
      const {
        status = null,
        search = null,
        userId = null
      } = options;

      let query = 'SELECT COUNT(*) FROM sandboxes WHERE 1=1';
      const values = [];
      let paramIndex = 1;

      if (userId) {
        query += ` AND user_id = $${paramIndex}`;
        values.push(userId);
        paramIndex++;
      }

      if (status) {
        if (Array.isArray(status)) {
          query += ` AND status = ANY($${paramIndex})`;
          values.push(status);
        } else {
          query += ` AND status = $${paramIndex}`;
          values.push(status);
        }
        paramIndex++;
      }

      if (search) {
        query += ` AND (name ILIKE $${paramIndex} OR tags::text ILIKE $${paramIndex})`;
        values.push(`%${search}%`);
        paramIndex++;
      }

      const result = await pool.query(query, values);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error counting sandboxes:', error);
      throw error;
    }
  }

  static async update(id, updateData) {
    try {
      const allowedFields = [
        'name', 'network_config', 'analysis_tools', 'security_policy',
        'status', 'container_id', 'adb_port', 'vnc_port', 'ip_address',
        'error_message', 'tags', 'started_at', 'stopped_at', 'failed_at',
        'restarted_at', 'updated_at'
      ];

      const updates = [];
      const values = [id];
      let paramIndex = 2;

      Object.entries(updateData).forEach(([key, value]) => {
        if (allowedFields.includes(key)) {
          if (key === 'network_config' || key === 'analysis_tools' || key === 'tags') {
            updates.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(value));
          } else {
            updates.push(`${key} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      });

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      // Always update the updated_at timestamp
      updates.push(`updated_at = $${paramIndex}`);
      values.push(new Date().toISOString());

      const query = `
        UPDATE sandboxes
        SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING *
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Sandbox not found');
      }

      return this.formatSandbox(result.rows[0]);
    } catch (error) {
      logger.error(`Error updating sandbox ${id}:`, error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const query = 'DELETE FROM sandboxes WHERE id = $1 RETURNING *';
      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        throw new Error('Sandbox not found');
      }

      return this.formatSandbox(result.rows[0]);
    } catch (error) {
      logger.error(`Error deleting sandbox ${id}:`, error);
      throw error;
    }
  }

  static async getStats(userId = null) {
    try {
      let query = `
        SELECT
          status,
          COUNT(*) as count
        FROM sandboxes
      `;
      const values = [];

      if (userId) {
        query += ' WHERE user_id = $1';
        values.push(userId);
      }

      query += ' GROUP BY status';

      const result = await pool.query(query, values);
      const stats = {};

      result.rows.forEach(row => {
        stats[row.status] = parseInt(row.count);
      });

      return stats;
    } catch (error) {
      logger.error('Error getting sandbox stats:', error);
      throw error;
    }
  }

  static async getActiveSandboxes(userId = null) {
    try {
      let query = `
        SELECT * FROM sandboxes
        WHERE status IN ('running', 'starting')
      `;
      const values = [];

      if (userId) {
        query += ' AND user_id = $1';
        values.push(userId);
      }

      query += ' ORDER BY started_at DESC';

      const result = await pool.query(query, values);
      return result.rows.map(row => this.formatSandbox(row));
    } catch (error) {
      logger.error('Error getting active sandboxes:', error);
      throw error;
    }
  }

  static formatSandbox(row) {
    return {
      id: row.id,
      name: row.name,
      user_id: row.user_id,
      android_version: row.android_version,
      device_profile: row.device_profile,
      network_config: typeof row.network_config === 'string'
        ? JSON.parse(row.network_config)
        : row.network_config,
      analysis_tools: typeof row.analysis_tools === 'string'
        ? JSON.parse(row.analysis_tools)
        : row.analysis_tools,
      security_policy: row.security_policy,
      status: row.status,
      container_id: row.container_id,
      adb_port: row.adb_port,
      vnc_port: row.vnc_port,
      ip_address: row.ip_address,
      error_message: row.error_message,
      tags: typeof row.tags === 'string'
        ? JSON.parse(row.tags)
        : row.tags,
      created_at: row.created_at,
      updated_at: row.updated_at,
      started_at: row.started_at,
      stopped_at: row.stopped_at,
      failed_at: row.failed_at,
      restarted_at: row.restarted_at
    };
  }
}

module.exports = { Sandbox };