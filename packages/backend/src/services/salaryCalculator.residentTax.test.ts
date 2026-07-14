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

// 東京(13)・令和8年5月・月給30万の基本入力
function input(over: Partial<SalaryInput> = {}): SalaryInput {
  return {
    salaryType: 'monthly',
    baseSalary: 300000,
    commutingAllowance: 10000,
    otherAllowances: 0,
    prefecture: '13',
    salaryMonth: '2026-05',
    age: 35,
    dependents: 0,
    enrollInInsurance: true,
    ...over,
  };
}

describe('住民税（特別徴収・決定通知書の月割額の転記）', () => {
  it('入力なし → 控除0・従来と同じ結果', async () => {
    const r = await calculateSalary(input());
    expect(r.deductions.residentTax).toBe(0);
    expect(r.breakdown.deductions.some((d: any) => d.label.includes('住民税'))).toBe(false);
  });

  it('月割額はそのまま控除され、手取がちょうどその分減る', async () => {
    const base = await calculateSalary(input());
    const withTax = await calculateSalary(input({ residentTax: 12500 }));
    expect(withTax.deductions.residentTax).toBe(12500);
    expect(withTax.deductions.total).toBe(base.deductions.total + 12500);
    expect(withTax.netSalary).toBe(base.netSalary - 12500);
  });

  it('所得税・社会保険料には一切影響しない（住民税は当月の課税計算と無関係）', async () => {
    const base = await calculateSalary(input());
    const withTax = await calculateSalary(input({ residentTax: 25000 }));
    expect(withTax.deductions.incomeTax).toBe(base.deductions.incomeTax);
    expect(withTax.deductions.healthInsurance).toBe(base.deductions.healthInsurance);
    expect(withTax.deductions.employeePension).toBe(base.deductions.employeePension);
    expect(withTax.deductions.unemployment).toBe(base.deductions.unemployment);
    expect(withTax.grossSalary).toBe(base.grossSalary);
    expect(withTax.standardMonthlyRemuneration).toBe(base.standardMonthlyRemuneration);
  });

  it('小数・負値のガード: 端数は切捨て、負値は0扱い', async () => {
    const r1 = await calculateSalary(input({ residentTax: 12500.9 }));
    expect(r1.deductions.residentTax).toBe(12500);
    const r2 = await calculateSalary(input({ residentTax: -5000 }));
    expect(r2.deductions.residentTax).toBe(0);
  });

  it('控除内訳に決定通知書由来である旨が表示される', async () => {
    const r = await calculateSalary(input({ residentTax: 12500 }));
    const item = r.breakdown.deductions.find((d: any) => d.label === '住民税（特別徴収）');
    expect(item).toBeDefined();
    expect(item.amount).toBe(12500);
    expect(item.calculation).toContain('決定通知書');
  });
});
