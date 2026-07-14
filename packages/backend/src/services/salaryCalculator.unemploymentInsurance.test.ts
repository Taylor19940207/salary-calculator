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

describe('雇用保険（社会保険とは別制度として独立判定）', () => {
  it('省略時は一般被保険者（加入）として扱われる（後方互換）', async () => {
    const r = await calculateSalary(input());
    expect(r.deductions.unemployment).toBeGreaterThan(0);
    expect(r.breakdown.deductions.some((d: any) => d.label === '雇用保険' && d.amount > 0)).toBe(true);
  });

  it('明示的に true でも従来通り加入', async () => {
    const r = await calculateSalary(input({ enrollInUnemploymentInsurance: true }));
    expect(r.deductions.unemployment).toBeGreaterThan(0);
  });

  it('法人代表・役員パターン: 社会保険は加入するが雇用保険のみ未加入', async () => {
    const withUI = await calculateSalary(input({ enrollInUnemploymentInsurance: true }));
    const noUI = await calculateSalary(input({ enrollInUnemploymentInsurance: false }));

    // 雇用保険だけ0になる
    expect(noUI.deductions.unemployment).toBe(0);
    // 社会保険（健保・厚年）は変わらず控除される
    expect(noUI.deductions.healthInsurance).toBe(withUI.deductions.healthInsurance);
    expect(noUI.deductions.employeePension).toBe(withUI.deductions.employeePension);
    // 雇用保険料が浮いた分、手取は増える。ただし浮いた分は課税対象額を増やすため
    // 所得税もわずかに増え、手取の増加額は雇用保険料そのものよりは小さくなる
    const netGain = noUI.netSalary - withUI.netSalary;
    const taxIncrease = noUI.deductions.incomeTax - withUI.deductions.incomeTax;
    expect(netGain).toBeGreaterThan(0);
    expect(netGain).toBe(withUI.deductions.unemployment - taxIncrease);
  });

  it('未加入時は内訳に「未加入」の注記が表示される', async () => {
    const r = await calculateSalary(input({ enrollInUnemploymentInsurance: false }));
    const item = r.breakdown.deductions.find((d: any) => d.label === '雇用保険');
    expect(item).toBeDefined();
    expect(item.amount).toBe(0);
    expect(item.calculation).toContain('未加入');
  });

  it('社会保険も雇用保険も未加入の組み合わせも成立する（純粋な業務委託等を想定）', async () => {
    const r = await calculateSalary(input({ enrollInInsurance: false, enrollInUnemploymentInsurance: false }));
    expect(r.deductions.healthInsurance).toBe(0);
    expect(r.deductions.employeePension).toBe(0);
    expect(r.deductions.unemployment).toBe(0);
  });

  it('雇用保険が未加入でも所得税の課税対象額の計算は正しい（控除すべき項目が減るだけ）', async () => {
    const withUI = await calculateSalary(input({ enrollInUnemploymentInsurance: true }));
    const noUI = await calculateSalary(input({ enrollInUnemploymentInsurance: false }));
    // 雇用保険料が引かれない分、課税対象の給与は増える → 所得税は同額かそれ以上になるはず
    expect(noUI.deductions.incomeTax).toBeGreaterThanOrEqual(withUI.deductions.incomeTax);
  });
});
