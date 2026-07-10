import express from 'express';
import { getDb } from '../db/connection.js';
import { runRateCrawler } from '../services/rateCrawler.js';

const router = express.Router();

/**
 * 管理後台：查看待審核的費率變更
 */
router.get('/admin/rates/pending', async (req, res) => {
  const db = await getDb();

  const pendingRates = await db.all(
    `SELECT * FROM rate_update_log
     WHERE status = 'pending'
     ORDER BY created_at DESC`
  );

  res.json(pendingRates);
});

/**
 * 管理後台：審核並批准費率變更
 */
router.post('/admin/rates/approve/:id', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();

  try {
    // 1. 取得待審核的費率
    const log = await db.get(
      'SELECT * FROM rate_update_log WHERE id = ?',
      [id]
    );

    if (!log || log.status !== 'pending') {
      return res.status(400).json({ error: 'Invalid rate update log' });
    }

    // 2. 結束舊費率（設定 effective_to）
    if (log.old_rate) {
      await db.run(
        `UPDATE insurance_rates
         SET effective_to = date('now', '-1 day')
         WHERE rate_type = ?
           AND (prefecture_code = ? OR (prefecture_code IS NULL AND ? IS NULL))
           AND effective_to IS NULL`,
        [log.rate_type, log.prefecture_code, log.prefecture_code]
      );
    }

    // 3. 插入新費率
    await db.run(
      `INSERT INTO insurance_rates
       (prefecture_code, rate_type, rate_percentage, employee_burden_percentage,
        effective_from, source_url, verified_at, verified_by, notes)
       VALUES (?, ?, ?, ?, date('now'), ?, datetime('now'), ?, ?)`,
      [
        log.prefecture_code,
        log.rate_type,
        log.new_rate,
        log.new_rate / 2, // 假設勞資各半
        log.source,
        'admin',
        'Approved via admin panel'
      ]
    );

    // 4. 更新日誌狀態
    await db.run(
      'UPDATE rate_update_log SET status = ? WHERE id = ?',
      ['verified', id]
    );

    res.json({ success: true, message: 'Rate approved and activated' });

  } catch (error) {
    console.error('Approval failed:', error);
    res.status(500).json({ error: 'Failed to approve rate' });
  }
});

/**
 * 管理後台：拒絕費率變更
 */
router.post('/admin/rates/reject/:id', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const db = await getDb();

  await db.run(
    'UPDATE rate_update_log SET status = ?, notes = ? WHERE id = ?',
    ['rejected', reason, id]
  );

  res.json({ success: true });
});

/**
 * 手動觸發爬蟲
 */
router.post('/admin/crawler/run', async (req, res) => {
  try {
    // 在後台執行，立即返回
    runRateCrawler().catch(console.error);

    res.json({
      success: true,
      message: 'Crawler started in background'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start crawler' });
  }
});

export default router;
