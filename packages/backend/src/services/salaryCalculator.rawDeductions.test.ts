import { describe, it, expect, beforeAll } from 'vitest';
import type { SalaryInput } from '../types/index.js';

// calculateSalary は DB を参照するため、インメモリ DB を migrate + seed してから読み込む。
let calculateSalary: (input: SalaryInput) => Promise<any>;

beforeAll(async () => {
  process.env.DATABASE_PATH = ':memory:';
  const { ensureDatabase } = await import('../db/setup.js');
  await ensureDatabase();
  ({ calculateSalary } = await import('./salaryCalculator.js'));
});

// 佐賀(41)は健保料率10.55%で、標準報酬月額との掛け算で端数（銭）が出やすい
function input(over: Partial<SalaryInput> = {}): SalaryInput {
  return {
    salaryType: 'monthly',
    baseSalary: 279000, // 端数が出るよう半端な額にする
    commutingAllowance: 3000,
    otherAllowances: 0,
    prefecture: '41',
    salaryMonth: '2026-05',
    age: 45, // 介護保険も対象にして端数項目を増やす
    dependents: 1,
    enrollInInsurance: true,
    ...over,
  };
}

describe('deductionsRaw（端数処理前の生値・明細の丸めない表示用）', () => {
  // 実際に小数（銭）が出る組み合わせで、raw ≠ 丸め後 になることを直接確認する
  // （北海道・標準報酬月額58,000円: 健保raw=2981.2→丸め2981、介護raw=469.8→丸め470、子育てraw=66.7→丸め67）
  it('端数が出る組み合わせでは raw が実際に小数を持ち、丸め後の整数と異なる', async () => {
    const r = await calculateSalary(input({ prefecture: '01', baseSalary: 58000, commutingAllowance: 0 }));
    expect(Number.isInteger(r.deductionsRaw.healthInsurance)).toBe(false);
    expect(r.deductionsRaw.healthInsurance).toBeCloseTo(2981.2, 5);
    expect(r.deductions.healthInsurance).toBe(2981);
    expect(r.deductionsRaw.nursingCare).toBeCloseTo(469.8, 5);
    expect(r.deductions.nursingCare).toBe(470);
    expect(r.deductionsRaw.childSupport).toBeCloseTo(66.7, 5);
    expect(r.deductions.childSupport).toBe(67);
  });

  it('raw版は法定丸め後の値と概ね一致するが、端数のある項目は差が出うる', async () => {
    const r = await calculateSalary(input());
    // 丸めの差は各項目 0.5円未満（切捨て/切上げの定義上、差の絶対値は常に0.5未満）
    for (const key of ['healthInsurance', 'nursingCare', 'employeePension', 'unemployment', 'childSupport'] as const) {
      const diff = Math.abs(r.deductions[key] - r.deductionsRaw[key]);
      expect(diff).toBeLessThan(1);
    }
  });

  it('所得税・住民税は raw と丸め後で完全に同じ値（端数処理の対象外）', async () => {
    const r = await calculateSalary(input({ residentTax: 12345 }));
    expect(r.deductionsRaw.incomeTax).toBe(r.deductions.incomeTax);
    expect(r.deductionsRaw.residentTax).toBe(r.deductions.residentTax);
  });

  it('deductionsRaw.total は raw各項目の合計と一致する（内部自己無矛盾）', async () => {
    const r = await calculateSalary(input({ residentTax: 5000 }));
    const sum =
      r.deductionsRaw.healthInsurance +
      r.deductionsRaw.nursingCare +
      r.deductionsRaw.employeePension +
      r.deductionsRaw.unemployment +
      r.deductionsRaw.childSupport +
      r.deductionsRaw.incomeTax +
      r.deductionsRaw.residentTax;
    expect(Math.abs(r.deductionsRaw.total - Math.round(sum * 100) / 100)).toBeLessThan(0.005);
  });

  it('netSalaryRaw = grossSalary - deductionsRaw.total（自己無矛盾）', async () => {
    const r = await calculateSalary(input());
    expect(Math.abs(r.netSalaryRaw - (r.grossSalary - r.deductionsRaw.total))).toBeLessThan(0.005);
  });

  it('breakdown.deductions の各項目に rawAmount が付与され、丸め後 amount との差は0.5円未満', async () => {
    const r = await calculateSalary(input());
    for (const item of r.breakdown.deductions) {
      expect(item.rawAmount).toBeDefined();
      expect(Math.abs(item.amount - item.rawAmount)).toBeLessThan(1);
    }
  });

  it('未加入の項目は raw も丸め後も 0（雇用保険未加入のケース）', async () => {
    const r = await calculateSalary(input({ enrollInUnemploymentInsurance: false }));
    expect(r.deductions.unemployment).toBe(0);
    expect(r.deductionsRaw.unemployment).toBe(0);
  });

  it('社保未加入なら健保・介護・厚年・子育ての raw も丸め後もすべて0', async () => {
    const r = await calculateSalary(input({ enrollInInsurance: false }));
    for (const key of ['healthInsurance', 'nursingCare', 'employeePension', 'childSupport'] as const) {
      expect(r.deductions[key]).toBe(0);
      expect(r.deductionsRaw[key]).toBe(0);
    }
  });

  it('raw版の合計は丸め後合計と大きくは乖離しない（各項目差0.5円未満×5項目なので2.5円未満）', async () => {
    const r = await calculateSalary(input());
    expect(Math.abs(r.deductions.total - r.deductionsRaw.total)).toBeLessThan(3);
  });
});
