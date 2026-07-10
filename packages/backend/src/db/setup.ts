import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Database } from 'sqlite';
import { getDb } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(db: Database): Promise<void> {
  const schemaSQL = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await db.exec(schemaSQL);
}

export async function runSeed(db: Database): Promise<void> {
  // 都道府県データ
  const prefectures = [
    { code: '01', name_ja: '北海道', name_en: 'Hokkaido', region: '北海道' },
    { code: '02', name_ja: '青森県', name_en: 'Aomori', region: '東北' },
    { code: '03', name_ja: '岩手県', name_en: 'Iwate', region: '東北' },
    { code: '04', name_ja: '宮城県', name_en: 'Miyagi', region: '東北' },
    { code: '05', name_ja: '秋田県', name_en: 'Akita', region: '東北' },
    { code: '06', name_ja: '山形県', name_en: 'Yamagata', region: '東北' },
    { code: '07', name_ja: '福島県', name_en: 'Fukushima', region: '東北' },
    { code: '08', name_ja: '茨城県', name_en: 'Ibaraki', region: '関東' },
    { code: '09', name_ja: '栃木県', name_en: 'Tochigi', region: '関東' },
    { code: '10', name_ja: '群馬県', name_en: 'Gunma', region: '関東' },
    { code: '11', name_ja: '埼玉県', name_en: 'Saitama', region: '関東' },
    { code: '12', name_ja: '千葉県', name_en: 'Chiba', region: '関東' },
    { code: '13', name_ja: '東京都', name_en: 'Tokyo', region: '関東' },
    { code: '14', name_ja: '神奈川県', name_en: 'Kanagawa', region: '関東' },
    { code: '15', name_ja: '新潟県', name_en: 'Niigata', region: '中部' },
    { code: '16', name_ja: '富山県', name_en: 'Toyama', region: '中部' },
    { code: '17', name_ja: '石川県', name_en: 'Ishikawa', region: '中部' },
    { code: '18', name_ja: '福井県', name_en: 'Fukui', region: '中部' },
    { code: '19', name_ja: '山梨県', name_en: 'Yamanashi', region: '中部' },
    { code: '20', name_ja: '長野県', name_en: 'Nagano', region: '中部' },
    { code: '21', name_ja: '岐阜県', name_en: 'Gifu', region: '中部' },
    { code: '22', name_ja: '静岡県', name_en: 'Shizuoka', region: '中部' },
    { code: '23', name_ja: '愛知県', name_en: 'Aichi', region: '中部' },
    { code: '24', name_ja: '三重県', name_en: 'Mie', region: '近畿' },
    { code: '25', name_ja: '滋賀県', name_en: 'Shiga', region: '近畿' },
    { code: '26', name_ja: '京都府', name_en: 'Kyoto', region: '近畿' },
    { code: '27', name_ja: '大阪府', name_en: 'Osaka', region: '近畿' },
    { code: '28', name_ja: '兵庫県', name_en: 'Hyogo', region: '近畿' },
    { code: '29', name_ja: '奈良県', name_en: 'Nara', region: '近畿' },
    { code: '30', name_ja: '和歌山県', name_en: 'Wakayama', region: '近畿' },
    { code: '31', name_ja: '鳥取県', name_en: 'Tottori', region: '中国' },
    { code: '32', name_ja: '島根県', name_en: 'Shimane', region: '中国' },
    { code: '33', name_ja: '岡山県', name_en: 'Okayama', region: '中国' },
    { code: '34', name_ja: '広島県', name_en: 'Hiroshima', region: '中国' },
    { code: '35', name_ja: '山口県', name_en: 'Yamaguchi', region: '中国' },
    { code: '36', name_ja: '徳島県', name_en: 'Tokushima', region: '四国' },
    { code: '37', name_ja: '香川県', name_en: 'Kagawa', region: '四国' },
    { code: '38', name_ja: '愛媛県', name_en: 'Ehime', region: '四国' },
    { code: '39', name_ja: '高知県', name_en: 'Kochi', region: '四国' },
    { code: '40', name_ja: '福岡県', name_en: 'Fukuoka', region: '九州' },
    { code: '41', name_ja: '佐賀県', name_en: 'Saga', region: '九州' },
    { code: '42', name_ja: '長崎県', name_en: 'Nagasaki', region: '九州' },
    { code: '43', name_ja: '熊本県', name_en: 'Kumamoto', region: '九州' },
    { code: '44', name_ja: '大分県', name_en: 'Oita', region: '九州' },
    { code: '45', name_ja: '宮崎県', name_en: 'Miyazaki', region: '九州' },
    { code: '46', name_ja: '鹿児島県', name_en: 'Kagoshima', region: '九州' },
    { code: '47', name_ja: '沖縄県', name_en: 'Okinawa', region: '九州' },
  ];

  for (const pref of prefectures) {
    await db.run(
      `INSERT OR IGNORE INTO prefectures (code, name_ja, name_en, region)
       VALUES (?, ?, ?, ?)`,
      [pref.code, pref.name_ja, pref.name_en, pref.region]
    );
  }

  // 2026年度（令和8年度）保険料率
  const rates2026 = [
    {
      prefecture_code: null,
      rate_type: 'pension',
      rate_percentage: 18.3,
      employee_burden_percentage: 9.15,
      effective_from: '2026-04-01',
      source_url: 'https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/ryogakuhyo/index.html',
      notes: '2017年9月から18.3%で固定'
    },
    {
      prefecture_code: null,
      rate_type: 'unemployment',
      rate_percentage: 1.35,
      employee_burden_percentage: 0.5,
      effective_from: '2026-04-01',
      source_url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html',
      notes: '労働者負担 5/1,000、事業主負担 8.5/1,000'
    },
    {
      prefecture_code: null,
      rate_type: 'nursing_care',
      rate_percentage: 1.62,
      employee_burden_percentage: 0.81,
      effective_from: '2026-03-01',
      source_url: 'https://www.kyoukaikenpo.or.jp/',
      notes: '40歳以上が対象'
    },
    {
      prefecture_code: null,
      rate_type: 'child_support',
      rate_percentage: 0.23,
      employee_burden_percentage: 0.115,
      effective_from: '2026-04-01',
      source_url: 'https://www.kyoukaikenpo.or.jp/',
      notes: '令和8年度新設'
    },
  ];

  for (const rate of rates2026) {
    await db.run(
      `INSERT OR IGNORE INTO insurance_rates
       (prefecture_code, rate_type, rate_percentage, employee_burden_percentage,
        effective_from, source_url, notes, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        rate.prefecture_code,
        rate.rate_type,
        rate.rate_percentage,
        rate.employee_burden_percentage,
        rate.effective_from,
        rate.source_url,
        rate.notes
      ]
    );
  }

  // 健康保険料率（令和8年度・全47都道府県、2026年3月分から適用）
  const healthRates2026: Array<{ code: string; rate: number }> = [
    { code: '01', rate: 10.28 }, { code: '02', rate: 9.85 }, { code: '03', rate: 9.51 }, { code: '04', rate: 10.1 },
    { code: '05', rate: 10.01 }, { code: '06', rate: 9.75 }, { code: '07', rate: 9.5 }, { code: '08', rate: 9.52 },
    { code: '09', rate: 9.82 }, { code: '10', rate: 9.68 }, { code: '11', rate: 9.67 }, { code: '12', rate: 9.73 },
    { code: '13', rate: 9.85 }, { code: '14', rate: 9.92 }, { code: '15', rate: 9.21 }, { code: '16', rate: 9.59 },
    { code: '17', rate: 9.7 }, { code: '18', rate: 9.71 }, { code: '19', rate: 9.55 }, { code: '20', rate: 9.63 },
    { code: '21', rate: 9.8 }, { code: '22', rate: 9.61 }, { code: '23', rate: 9.93 }, { code: '24', rate: 9.77 },
    { code: '25', rate: 9.88 }, { code: '26', rate: 9.89 }, { code: '27', rate: 10.13 }, { code: '28', rate: 10.12 },
    { code: '29', rate: 9.91 }, { code: '30', rate: 10.06 }, { code: '31', rate: 9.86 }, { code: '32', rate: 9.94 },
    { code: '33', rate: 10.05 }, { code: '34', rate: 9.78 }, { code: '35', rate: 10.15 }, { code: '36', rate: 10.24 },
    { code: '37', rate: 10.02 }, { code: '38', rate: 9.98 }, { code: '39', rate: 10.05 }, { code: '40', rate: 10.11 },
    { code: '41', rate: 10.55 }, { code: '42', rate: 10.06 }, { code: '43', rate: 10.08 }, { code: '44', rate: 10.08 },
    { code: '45', rate: 9.77 }, { code: '46', rate: 10.13 }, { code: '47', rate: 9.44 },
  ];

  for (const hr of healthRates2026) {
    await db.run(
      `INSERT OR IGNORE INTO insurance_rates
       (prefecture_code, rate_type, rate_percentage, employee_burden_percentage,
        effective_from, source_url, notes, verified_at)
       VALUES (?, 'health_insurance', ?, ?, '2026-03-01', ?, ?, datetime('now'))`,
      [hr.code, hr.rate, Math.round(hr.rate / 2 * 1000) / 1000, 'https://www.kyoukaikenpo.or.jp/about/business/insurance_rate/rate_prefectures/r08/index.html', '令和8年度（2026年3月分から適用）']
    );
  }

  // 標準報酬月額等級（健康保険 第1〜50級）
  const grades = [
    { grade: 1, min: 0, max: 63000, standard: 58000 },
    { grade: 2, min: 63000, max: 73000, standard: 68000 },
    { grade: 3, min: 73000, max: 83000, standard: 78000 },
    { grade: 4, min: 83000, max: 93000, standard: 88000 },
    { grade: 5, min: 93000, max: 101000, standard: 98000 },
    { grade: 6, min: 101000, max: 107000, standard: 104000 },
    { grade: 7, min: 107000, max: 114000, standard: 110000 },
    { grade: 8, min: 114000, max: 122000, standard: 118000 },
    { grade: 9, min: 122000, max: 130000, standard: 126000 },
    { grade: 10, min: 130000, max: 138000, standard: 134000 },
    { grade: 11, min: 138000, max: 146000, standard: 142000 },
    { grade: 12, min: 146000, max: 155000, standard: 150000 },
    { grade: 13, min: 155000, max: 165000, standard: 160000 },
    { grade: 14, min: 165000, max: 175000, standard: 170000 },
    { grade: 15, min: 175000, max: 185000, standard: 180000 },
    { grade: 16, min: 185000, max: 195000, standard: 190000 },
    { grade: 17, min: 195000, max: 210000, standard: 200000 },
    { grade: 18, min: 210000, max: 230000, standard: 220000 },
    { grade: 19, min: 230000, max: 250000, standard: 240000 },
    { grade: 20, min: 250000, max: 270000, standard: 260000 },
    { grade: 21, min: 270000, max: 290000, standard: 280000 },
    { grade: 22, min: 290000, max: 310000, standard: 300000 },
    { grade: 23, min: 310000, max: 330000, standard: 320000 },
    { grade: 24, min: 330000, max: 350000, standard: 340000 },
    { grade: 25, min: 350000, max: 370000, standard: 360000 },
    { grade: 26, min: 370000, max: 395000, standard: 380000 },
    { grade: 27, min: 395000, max: 425000, standard: 410000 },
    { grade: 28, min: 425000, max: 455000, standard: 440000 },
    { grade: 29, min: 455000, max: 485000, standard: 470000 },
    { grade: 30, min: 485000, max: 515000, standard: 500000 },
    { grade: 31, min: 515000, max: 545000, standard: 530000 },
    { grade: 32, min: 545000, max: 575000, standard: 560000 },
    { grade: 33, min: 575000, max: 605000, standard: 590000 },
    { grade: 34, min: 605000, max: 635000, standard: 620000 },
    { grade: 35, min: 635000, max: 665000, standard: 650000 },
    { grade: 36, min: 665000, max: 695000, standard: 680000 },
    { grade: 37, min: 695000, max: 730000, standard: 710000 },
    { grade: 38, min: 730000, max: 770000, standard: 750000 },
    { grade: 39, min: 770000, max: 810000, standard: 790000 },
    { grade: 40, min: 810000, max: 855000, standard: 830000 },
    { grade: 41, min: 855000, max: 905000, standard: 880000 },
    { grade: 42, min: 905000, max: 955000, standard: 930000 },
    { grade: 43, min: 955000, max: 1005000, standard: 980000 },
    { grade: 44, min: 1005000, max: 1055000, standard: 1030000 },
    { grade: 45, min: 1055000, max: 1115000, standard: 1090000 },
    { grade: 46, min: 1115000, max: 1175000, standard: 1150000 },
    { grade: 47, min: 1175000, max: 1235000, standard: 1210000 },
    { grade: 48, min: 1235000, max: 1295000, standard: 1270000 },
    { grade: 49, min: 1295000, max: 1355000, standard: 1330000 },
    { grade: 50, min: 1355000, max: 9999999, standard: 1390000 },
  ];

  for (const g of grades) {
    await db.run(
      `INSERT OR IGNORE INTO standard_remuneration_grades
       (grade_number, min_amount, max_amount, standard_amount, effective_from)
       VALUES (?, ?, ?, ?, '2026-04-01')`,
      [g.grade, g.min, g.max, g.standard]
    );
  }
}

// サーバー起動時に呼ぶ: スキーマ作成＋シード（冪等）
export async function ensureDatabase(): Promise<void> {
  const db = await getDb();
  await runMigrations(db);
  await runSeed(db);
}
