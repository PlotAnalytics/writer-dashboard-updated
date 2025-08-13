const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Simple admin-only guard (allow master_editor and admin roles)
function adminOnly(req, res, next) {
  try {
    const user = req.user || {};
    if (
      user?.username === 'master_editor' ||
      user?.role === 'admin' ||
      user?.role === 'master_editor'
    ) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  } catch (e) {
    return res.status(403).json({ error: 'Access denied.' });
  }
}

// ----- Posting Accounts -----
// List all posting accounts
router.get('/posting-accounts', authenticateToken, adminOnly, async (req, res) => {
  try {
    const q = `SELECT id, account, platform, status, writer_id, daily_limit, daily_used
               FROM posting_accounts
               ORDER BY id ASC`;
    const { rows } = await pool.query(q);
    res.json({ success: true, postingAccounts: rows });
  } catch (error) {
    console.error('Admin posting-accounts list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Next ID (ignore 99999)
router.get('/posting-accounts/next-id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT COALESCE(MAX(id), 0) AS max_id FROM posting_accounts WHERE id <> 99999`);
    const nextId = Number(rows[0]?.max_id || 0) + 1;
    res.json({ success: true, next_id: nextId });
  } catch (error) {
    console.error('Admin posting-accounts next-id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create posting account (id optional; DB has default sequence)
router.post('/posting-accounts', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { id, account, platform, status, writer_id, daily_limit, daily_used } = req.body;

    if (!account || !platform || !status) {
      return res.status(400).json({ error: 'account, platform and status are required' });
    }

    let query, params;
    if (id) {
      query = `INSERT INTO posting_accounts (id, account, platform, status, writer_id, daily_limit, daily_used)
               VALUES ($1, $2, $3, $4, $5, COALESCE($6, 10), COALESCE($7, 0))
               RETURNING id, account, platform, status, writer_id, daily_limit, daily_used`;
      params = [id, account, platform, status, writer_id ?? null, daily_limit ?? 10, daily_used ?? 0];
    } else {
      query = `INSERT INTO posting_accounts (account, platform, status, writer_id, daily_limit, daily_used)
               VALUES ($1, $2, $3, $4, COALESCE($5, 10), COALESCE($6, 0))
               RETURNING id, account, platform, status, writer_id, daily_limit, daily_used`;
      params = [account, platform, status, writer_id ?? null, daily_limit ?? 10, daily_used ?? 0];
    }

    const { rows } = await pool.query(query, params);
    res.json({ success: true, postingAccount: rows[0] });
  } catch (error) {
    console.error('Admin posting-accounts create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update posting account
router.put('/posting-accounts/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { account, platform, status, writer_id, daily_limit, daily_used } = req.body;

    const { rows } = await pool.query(
      `UPDATE posting_accounts
       SET account = COALESCE($1, account),
           platform = COALESCE($2, platform),
           status = COALESCE($3, status),
           writer_id = $4,
           daily_limit = COALESCE($5, daily_limit),
           daily_used = COALESCE($6, daily_used)
       WHERE id = $7
       RETURNING id, account, platform, status, writer_id, daily_limit, daily_used`,
      [account ?? null, platform ?? null, status ?? null, writer_id ?? null, daily_limit ?? null, daily_used ?? null, id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Posting account not found' });
    res.json({ success: true, postingAccount: rows[0] });
  } catch (error) {
    console.error('Admin posting-accounts update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete posting account
router.delete('/posting-accounts/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rowCount } = await pool.query('DELETE FROM posting_accounts WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Posting account not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin posting-accounts delete error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ----- Writer Settings -----
router.get('/writer-settings', authenticateToken, adminOnly, async (req, res) => {
  try {
    const q = `SELECT writer_id as id, writer_name, writer_fname, writer_lname, skip_qa, post_acct_list, access_advanced_types
               FROM writer_settings
               ORDER BY id ASC`;
    const { rows } = await pool.query(q);
    return res.json({ success: true, writerSettings: rows });
  } catch (error) {
    console.error('Admin writer-settings list error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/writer-settings/next-id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT COALESCE(MAX(id), 0) AS max_id FROM writer_settings`);
    const nextId = Number(rows[0]?.max_id || 0) + 1;
    return res.json({ success: true, next_id: nextId });
  } catch (error) {
    // Fallback if id column doesn't exist
    if (error && error.code === '42703') {
      try {
        const { rows } = await pool.query(`SELECT COALESCE(MAX(writer_id), 0) AS max_id FROM writer_settings`);
        const nextId = Number(rows[0]?.max_id || 0) + 1;
        return res.json({ success: true, next_id: nextId });
      } catch (e2) {
        console.error('Admin writer-settings next-id fallback error:', e2);
        return res.status(500).json({ error: e2.message });
      }
    }
    console.error('Admin writer-settings next-id error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/writer-settings', authenticateToken, adminOnly, async (req, res) => {
  try {
    const {
      id,
      writer_id,
      writer_name,
      writer_fname,
      writer_lname,
      skip_qa,
      post_acct_list,
      access_advanced_types
    } = req.body;

    if (!writer_name) {
      return res.status(400).json({ error: 'writer_name is required' });
    }

    let newId = id;
    if (!newId) {
      const { rows: idRows } = await pool.query(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM writer_settings`);
      newId = Number(idRows[0]?.next_id || 1);
    }

    const insertQ = `INSERT INTO writer_settings
      (id, writer_id, writer_name, writer_fname, writer_lname, skip_qa, post_acct_list, access_advanced_types)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, false), COALESCE($7, '{}'), COALESCE($8, false))
      RETURNING id, writer_id, writer_name, writer_fname, writer_lname, skip_qa, post_acct_list, access_advanced_types`;

    const params = [
      newId,
      writer_id ?? null,
      writer_name,
      writer_fname ?? null,
      writer_lname ?? null,
      skip_qa ?? false,
      Array.isArray(post_acct_list) ? post_acct_list : null,
      access_advanced_types ?? false
    ];

    const { rows } = await pool.query(insertQ, params);
    res.json({ success: true, writerSetting: rows[0] });
  } catch (error) {
    console.error('Admin writer-settings create error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/writer-settings/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      writer_id,
      writer_name,
      writer_fname,
      writer_lname,
      skip_qa,
      post_acct_list,
      access_advanced_types
    } = req.body;

    const params = [
      writer_id ?? null,
      writer_name ?? null,
      writer_fname ?? null,
      writer_lname ?? null,
      skip_qa ?? null,
      Array.isArray(post_acct_list) ? post_acct_list : null,
      access_advanced_types ?? null,
      id,
    ];

    try {
      const { rows } = await pool.query(
        `UPDATE writer_settings
         SET writer_id = COALESCE($1, writer_id),
             writer_name = COALESCE($2, writer_name),
             writer_fname = $3,
             writer_lname = $4,
             skip_qa = COALESCE($5, skip_qa),
             post_acct_list = COALESCE($6, post_acct_list),
             access_advanced_types = COALESCE($7, access_advanced_types)
         WHERE id = $8
         RETURNING id, writer_id, writer_name, writer_fname, writer_lname, skip_qa, post_acct_list, access_advanced_types`,
        params
      );

      if (rows.length === 0) {
        // Attempt update by writer_id as fallback if id did not match
        const { rows: rows2 } = await pool.query(
          `UPDATE writer_settings
           SET writer_id = COALESCE($1, writer_id),
               writer_name = COALESCE($2, writer_name),
               writer_fname = $3,
               writer_lname = $4,
               skip_qa = COALESCE($5, skip_qa),
               post_acct_list = COALESCE($6, post_acct_list),
               access_advanced_types = COALESCE($7, access_advanced_types)
           WHERE writer_id = $8
           RETURNING writer_id AS id, writer_id, writer_name, writer_fname, writer_lname, skip_qa, post_acct_list, access_advanced_types`,
          params
        );
        if (rows2.length === 0)
          return res.status(404).json({ error: 'Writer setting not found' });
        return res.json({ success: true, writerSetting: rows2[0] });
      }

      return res.json({ success: true, writerSetting: rows[0] });
    } catch (err) {
      // Undefined column id -> fallback to writer_id
      if (err && err.code === '42703') {
        const { rows: rows2 } = await pool.query(
          `UPDATE writer_settings
           SET writer_id = COALESCE($1, writer_id),
               writer_name = COALESCE($2, writer_name),
               writer_fname = $3,
               writer_lname = $4,
               skip_qa = COALESCE($5, skip_qa),
               post_acct_list = COALESCE($6, post_acct_list),
               access_advanced_types = COALESCE($7, access_advanced_types)
           WHERE writer_id = $8
           RETURNING writer_id AS id, writer_id, writer_name, writer_fname, writer_lname, skip_qa, post_acct_list, access_advanced_types`,
          params
        );
        if (rows2.length === 0)
          return res.status(404).json({ error: 'Writer setting not found' });
        return res.json({ success: true, writerSetting: rows2[0] });
      }
      throw err;
    }
  } catch (error) {
    console.error('Admin writer-settings update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete writer setting
router.delete('/writer-settings/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rowCount } = await pool.query('DELETE FROM writer_settings WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Writer setting not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin writer-settings delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

