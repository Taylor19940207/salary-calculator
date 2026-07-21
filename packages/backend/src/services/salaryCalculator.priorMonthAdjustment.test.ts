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

describe('前月調整訂正分（前期給与計算の誤りを当月で調整する手動入力額）', () => {
  it('入力なし → 控除0・従来と同じ結果', async () => {
    const r = await calculateSalary(input());
    expect(r.deductions.priorMonthAdjustment).toBe(0);
    expect(r.breakdown.deductions.some((d: any) => d.label === '前月調整訂正分')).toBe(false);
  });

  it('正の値: 追加控除として控除合計に加算され、手取がその分減る', async () => {
    const base = await calculateSalary(input());
    const withAdj = await calculateSalary(input({ priorMonthAdjustment: 3000 }));
    expect(withAdj.deductions.priorMonthAdjustment).toBe(3000);
    expect(withAdj.deductions.total).toBe(base.deductions.total + 3000);
    expect(withAdj.netSalary).toBe(base.netSalary - 3000);
  });

  it('負の値: 追加支給として控除合計から減算され、手取がその分増える', async () => {
    const base = await calculateSalary(input());
    const withAdj = await calculateSalary(input({ priorMonthAdjustment: -3000 }));
    expect(withAdj.deductions.priorMonthAdjustment).toBe(-3000);
    expect(withAdj.deductions.total).toBe(base.deductions.total - 3000);
    expect(withAdj.netSalary).toBe(base.netSalary + 3000);
  });

  it('所得税・社会保険料には一切影響しない（当月の課税計算と無関係）', async () => {
    const base = await calculateSalary(input());
    const withAdj = await calculateSalary(input({ priorMonthAdjustment: -5000 }));
    expect(withAdj.deductions.incomeTax).toBe(base.deductions.incomeTax);
    expect(withAdj.deductions.healthInsurance).toBe(base.deductions.healthInsurance);
    expect(withAdj.deductions.employeePension).toBe(base.deductions.employeePension);
    expect(withAdj.deductions.unemployment).toBe(base.deductions.unemployment);
    expect(withAdj.grossSalary).toBe(base.grossSalary);
    expect(withAdj.standardMonthlyRemuneration).toBe(base.standardMonthlyRemuneration);
  });

  it('小数は丸められる（正負とも四捨五入）', async () => {
    const r1 = await calculateSalary(input({ priorMonthAdjustment: 3000.6 }));
    expect(r1.deductions.priorMonthAdjustment).toBe(3001);
    const r2 = await calculateSalary(input({ priorMonthAdjustment: -3000.6 }));
    expect(r2.deductions.priorMonthAdjustment).toBe(-3001);
  });

  it('控除内訳に正負に応じた説明が表示される', async () => {
    const plus = await calculateSalary(input({ priorMonthAdjustment: 2000 }));
    const plusItem = plus.breakdown.deductions.find((d: any) => d.label === '前月調整訂正分');
    expect(plusItem).toBeDefined();
    expect(plusItem.amount).toBe(2000);
    expect(plusItem.calculation).toContain('追加控除');

    const minus = await calculateSalary(input({ priorMonthAdjustment: -2000 }));
    const minusItem = minus.breakdown.deductions.find((d: any) => d.label === '前月調整訂正分');
    expect(minusItem).toBeDefined();
    expect(minusItem.amount).toBe(-2000);
    expect(minusItem.calculation).toContain('追加支給');
  });
});
