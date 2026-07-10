import dotenv from 'dotenv';
import { getDb } from './connection.js';
import type { InsuranceRate, Prefecture } from '../types/index.js';

dotenv.config();

// 都道府県一覧取得
export async function getPrefectures(): Promise<Prefecture[]> {
  const db = await getDb();
  const result = await db.all(
    'SELECT code, name_ja, name_en, region FROM prefectures ORDER BY code'
  );
  return result;
}

// 指定日時点での保険料率取得
export async function getInsuranceRates(
  prefectureCode: string,
  targetDate: Date
): Promise<Record<string, InsuranceRate>> {
  const db = await getDb();
  const dateStr = targetDate.toISOString().split('T')[0];

  const result = await db.all<InsuranceRate[]>(
    `SELECT * FROM insurance_rates
     WHERE (prefecture_code = ? OR prefecture_code IS NULL)
       AND effective_from <= ?
       AND (effective_to IS NULL OR effective_to >= ?)
     ORDER BY prefecture_code DESC`,
    [prefectureCode, dateStr, dateStr]
  );

  const ratesMap: Record<string, InsuranceRate> = {};

  for (const row of result) {
    // 都道府県固有の料率を優先
    if (!ratesMap[row.rate_type] || row.prefecture_code !== null) {
      ratesMap[row.rate_type] = row;
    }
  }

  return ratesMap;
}

// 標準報酬月額の計算（等級番号付き）
export async function calculateStandardRemuneration(
  totalSalary: number,
  targetDate: Date
): Promise<{ amount: number; grade: number | null }> {
  const db = await getDb();
  const dateStr = targetDate.toISOString().split('T')[0];

  const result = await db.get(
    `SELECT grade_number, standard_amount FROM standard_remuneration_grades
     WHERE min_amount <= ? AND max_amount > ?
       AND effective_from <= ?
       AND (effective_to IS NULL OR effective_to >= ?)
     ORDER BY effective_from DESC
     LIMIT 1`,
    [totalSalary, totalSalary, dateStr, dateStr]
  );

  if (!result) {
    // フォールバック
    if (totalSalary < 88000) return { amount: 88000, grade: null };
    if (totalSalary > 1355000) return { amount: 1390000, grade: 50 };
    return { amount: Math.round(totalSalary / 1000) * 1000, grade: null };
  }

  return { amount: result.standard_amount, grade: result.grade_number };
}
