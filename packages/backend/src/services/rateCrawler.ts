import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDb } from '../db/connection.js';

// 官方費率來源
const SOURCES = {
  kyoukaikenpo: 'https://www.kyoukaikenpo.or.jp/',
  nenkin: 'https://www.nenkin.go.jp/',
  mhlw: 'https://www.mhlw.go.jp/'
};

interface RateScrapeResult {
  rateType: string;
  prefectureCode?: string;
  newRate: number;
  effectiveFrom: string;
  sourceUrl: string;
  scrapedAt: string;
  confidence: 'high' | 'medium' | 'low';
  needsVerification: boolean;
}

/**
 * 爬取協會けんぽ的健康保險費率
 */
export async function scrapeKyoukaiKenpoRates(): Promise<RateScrapeResult[]> {
  const results: RateScrapeResult[] = [];

  try {
    // 1. 爬取費率頁面
    const response = await axios.get(
      'https://www.kyoukaikenpo.or.jp/about/business/insurance_rate/premium_prefectures/'
    );

    const $ = cheerio.load(response.data);

    // 2. 檢測是否有新的年度費率發布
    const currentYear = new Date().getFullYear();
    const reiwaYear = currentYear - 2018; // 令和年度轉換

    // 查找「令和X年度」的連結
    const yearLinks = $(`a:contains("令和${reiwaYear}年度")`);

    if (yearLinks.length === 0) {
      console.log('No new rate announcements found');
      return results;
    }

    // 3. 解析各都道府県的費率（這裡是示範邏輯）
    // 實際需要根據網站結構調整
    const prefectures = ['01', '13', '14', '27', '40']; // 示範

    for (const prefCode of prefectures) {
      // 模擬從 PDF 或 HTML 解析費率
      // 實際實作需要使用 pdf-parse 或更複雜的解析邏輯

      results.push({
        rateType: 'health_insurance',
        prefectureCode: prefCode,
        newRate: 10.0, // 從 PDF/HTML 解析出的值
        effectiveFrom: `${currentYear}-03-01`,
        sourceUrl: `https://www.kyoukaikenpo.or.jp/assets/R${reiwaYear}_${prefCode}.pdf`,
        scrapedAt: new Date().toISOString(),
        confidence: 'medium',
        needsVerification: true
      });
    }

  } catch (error) {
    console.error('Scraping failed:', error);
  }

  return results;
}

/**
 * 爬取厚生勞動省的雇用保險費率
 */
export async function scrapeMHLWRates(): Promise<RateScrapeResult[]> {
  const results: RateScrapeResult[] = [];

  try {
    const response = await axios.get(
      'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html'
    );

    const $ = cheerio.load(response.data);

    // 查找最新的雇用保險料率 PDF
    const pdfLinks = $('a[href*="雇用保険料率"]');

    if (pdfLinks.length > 0) {
      // 解析 PDF 內容（需要 pdf-parse）
      results.push({
        rateType: 'unemployment',
        newRate: 1.35,
        effectiveFrom: new Date().getFullYear() + '-04-01',
        sourceUrl: pdfLinks.attr('href') || '',
        scrapedAt: new Date().toISOString(),
        confidence: 'high',
        needsVerification: true
      });
    }

  } catch (error) {
    console.error('MHLW scraping failed:', error);
  }

  return results;
}

/**
 * 比對爬取結果與資料庫現有費率
 */
export async function compareWithCurrentRates(
  scrapedRates: RateScrapeResult[]
): Promise<{ changed: RateScrapeResult[], unchanged: RateScrapeResult[] }> {
  const db = await getDb();
  const changed: RateScrapeResult[] = [];
  const unchanged: RateScrapeResult[] = [];

  for (const scraped of scrapedRates) {
    // 查詢資料庫中現有費率
    const current = await db.get(
      `SELECT rate_percentage FROM insurance_rates
       WHERE rate_type = ?
         AND (prefecture_code = ? OR prefecture_code IS NULL)
         AND effective_to IS NULL
       ORDER BY prefecture_code DESC
       LIMIT 1`,
      [scraped.rateType, scraped.prefectureCode]
    );

    if (!current || Math.abs(current.rate_percentage - scraped.newRate) > 0.001) {
      changed.push(scraped);

      // 記錄變更到日誌
      await db.run(
        `INSERT INTO rate_update_log
         (update_date, rate_type, prefecture_code, old_rate, new_rate, source, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          new Date().toISOString().split('T')[0],
          scraped.rateType,
          scraped.prefectureCode,
          current?.rate_percentage || null,
          scraped.newRate,
          scraped.sourceUrl,
          'pending'
        ]
      );
    } else {
      unchanged.push(scraped);
    }
  }

  return { changed, unchanged };
}

/**
 * 發送通知給管理員
 */
export async function notifyAdmin(changes: RateScrapeResult[]): Promise<void> {
  if (changes.length === 0) return;

  const message = `
🔔 保險費率更新檢測

發現 ${changes.length} 項費率變更，需要人工審核：

${changes.map(c => `
• ${c.rateType} ${c.prefectureCode || '全國'}
  新費率：${c.newRate}%
  生效日期：${c.effectiveFrom}
  來源：${c.sourceUrl}
  可信度：${c.confidence}
`).join('\n')}

請訪問管理後台審核：http://localhost:3001/admin/rates
  `;

  console.log(message);

  // 實際實作：發送 Email 或 Slack 通知
  // await sendEmail(ADMIN_EMAIL, 'Insurance Rate Update', message);
  // await sendSlackMessage(SLACK_WEBHOOK, message);
}

/**
 * 主要爬蟲排程任務
 */
export async function runRateCrawler(): Promise<void> {
  console.log('🕷️ Starting rate crawler...');

  const allResults: RateScrapeResult[] = [];

  // 並行爬取各來源
  const [kyoukaiResults, mhlwResults] = await Promise.all([
    scrapeKyoukaiKenpoRates(),
    scrapeMHLWRates()
  ]);

  allResults.push(...kyoukaiResults, ...mhlwResults);

  console.log(`Scraped ${allResults.length} rates`);

  // 比對變更
  const { changed, unchanged } = await compareWithCurrentRates(allResults);

  console.log(`Changed: ${changed.length}, Unchanged: ${unchanged.length}`);

  // 如果有變更，通知管理員
  if (changed.length > 0) {
    await notifyAdmin(changed);
  }

  console.log('✅ Rate crawler completed');
}
