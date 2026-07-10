import cron from 'node-cron';
import { runRateCrawler } from '../services/rateCrawler.js';

/**
 * 設定定期爬蟲排程
 * 每天凌晨 3:00 執行
 */
export function setupCronJobs() {
  // 每天凌晨 3:00 執行爬蟲
  cron.schedule('0 3 * * *', async () => {
    console.log('⏰ Running scheduled rate crawler...');
    try {
      await runRateCrawler();
    } catch (error) {
      console.error('Cron job failed:', error);
    }
  });

  console.log('✅ Cron jobs scheduled');

  // 可選：每月 1 號額外執行一次（費率通常月初更新）
  cron.schedule('0 4 1 * *', async () => {
    console.log('⏰ Running monthly rate check...');
    try {
      await runRateCrawler();
    } catch (error) {
      console.error('Monthly check failed:', error);
    }
  });
}
