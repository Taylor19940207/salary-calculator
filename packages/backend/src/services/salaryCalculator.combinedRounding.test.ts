import { describe, it, expect, beforeAll } from 'vitest';
import { employeePremium, employeePremiumByThousandths } from './salaryCalculator.js';
import type { SalaryInput, BonusInput } from '../types/index.js';

let calculateSalary: (input: SalaryInput) => Promise<any>;
let calculateBonus: (input: BonusInput) => Promise<any>;

beforeAll(async () => {
  process.env.DATABASE_PATH = ':memory:';
  const { ensureDatabase } = await import('../db/setup.js');
  await ensureDatabase();
  ({ calculateSalary } = await import('./salaryCalculator.js'));
  ({ calculateBonus } = await import('./bonusCalculator.js'));
});

describe('employeePremium（整数演算による50銭境界の正確な判定）', () => {
  it('ちょうど50銭は切捨て: 5,000×0.81% = 40.5 → 40（浮動小数点だと41になる回帰）', () => {
    // 5000 * (0.81/100) = 40.500000000000006 のため旧実装は誤って切上げていた
    expect(employeePremium(5000, 0.81).rounded).toBe(40);
    expect(employeePremium(5000, 0.81).raw).toBe(40.5);
  });

  it('50銭超は切上げ・50銭未満は切捨て（両側）', () => {
    expect(employeePremium(300101, 0.5).rounded).toBe(1501); // 1,500.505 → 切上げ
    expect(employeePremium(300100, 0.5).rounded).toBe(1500); // 1,500.5 → 切捨て
    expect(employeePremium(503000, 4.925).rounded).toBe(24773); // 24,772.75 → 切上げ
    expect(employeePremium(502000, 4.925).rounded).toBe(24723); // 24,723.5 → 切捨て
  });

  it('合算用: 率の千分率を整数加算してから計算', () => {
    // 青森 4.925% + 介護 0.81% = 5.735% → 134,000 × 5.735% = 7,684.9 → 切上げ 7,685
    const combined = employeePremiumByThousandths(134000, 4925 + 810);
    expect(combined.raw).toBe(7684.9);
    expect(combined.rounded).toBe(7685);
  });
});

describe('健保＋介護の合算丸め（健康保険法156条・協会けんぽ表の該当者欄方式）', () => {
  function input(over: Partial<SalaryInput> = {}): SalaryInput {
    return {
      salaryType: 'monthly',
      baseSalary: 134000,
      commutingAllowance: 0,
      otherAllowances: 0,
      prefecture: '02', // 青森 9.85%
      salaryMonth: '2026-05',
      age: 45,
      dependents: 0,
      enrollInInsurance: true,
      ...over,
    };
  }

  it('介護該当者: 個別丸めと合算丸めが異なるケースで公式値になる', async () => {
    // 青森・標準報酬134,000: 健保raw 6,599.5 / 介護raw 1,085.4
    // 個別丸め: 6,599 + 1,085 = 7,684（旧実装）
    // 合算丸め: 7,684.9 → 7,685（公式）→ 減算法で 介護1,085 + 健保6,600
    const r = await calculateSalary(input());
    expect(r.deductions.nursingCare).toBe(1085);
    expect(r.deductions.healthInsurance).toBe(6600);
    expect(r.deductions.healthInsurance + r.deductions.nursingCare).toBe(7685);
    // raw は各項の生値のまま（表示・編集用は変わらない）
    expect(r.deductionsRaw.healthInsurance).toBe(6599.5);
    expect(r.deductionsRaw.nursingCare).toBe(1085.4);
    // 減算法が適用されたことが計算過程に明示される
    const item = r.breakdown.deductions.find((d: any) => d.label === '健康保険');
    expect(item.calculation).toContain('合算');
  });

  it('40歳未満（介護なし）: 健保は単独丸めのまま', async () => {
    const r = await calculateSalary(input({ age: 35 }));
    expect(r.deductions.healthInsurance).toBe(6599); // 6,599.5 → 単独で50銭以下切捨て
    expect(r.deductions.nursingCare).toBe(0);
  });

  it('協会けんぽ公式表（東京R8）の実値と一致: 58,000円・45歳', async () => {
    // 公式表: 該当者折半額 3,326.3 / 非該当 2,856.5 / 支援金 66.7（別欄・単独丸め）
    const r = await calculateSalary(input({ prefecture: '13', baseSalary: 58000 }));
    expect(r.deductionsRaw.nursingCare).toBe(469.8);
    expect(r.deductions.nursingCare).toBe(470);
    expect(r.deductions.healthInsurance + r.deductions.nursingCare).toBe(3326); // 3,326.3 → 切捨て
    expect(r.deductionsRaw.childSupport).toBe(66.7);
    expect(r.deductions.childSupport).toBe(67); // 支援金は公式表で別欄 → 単独で50銭超切上げ
  });

  it('協会けんぽ公式表（東京R8）の実値と一致: 58,000円・35歳（非該当）', async () => {
    const r = await calculateSalary(input({ prefecture: '13', baseSalary: 58000, age: 35 }));
    expect(r.deductionsRaw.healthInsurance).toBe(2856.5); // 公式表 非該当折半額
    expect(r.deductions.healthInsurance).toBe(2856); // 50銭以下切捨て
  });

  it('合算と個別が一致するケースは従来通り（東京・320,000・45歳）', async () => {
    const r = await calculateSalary(input({ prefecture: '13', baseSalary: 320000 }));
    expect(r.deductions.healthInsurance).toBe(15760);
    expect(r.deductions.nursingCare).toBe(2592);
  });

  it('賞与でも合算丸め＋50銭境界の整数演算が効く（北海道・賞与5,000円・45歳）', async () => {
    // 標準賞与5,000: 健保raw 257.0 / 介護raw 40.5（浮動小数点だと41に誤丸めされていた）
    // 合算: 5,000×5.95% = 297.5 → 切捨て297 → 介護40 + 健保257
    const b = await calculateBonus({
      bonusAmount: 5000,
      prevMonthAfterInsurance: 285454,
      prefecture: '01',
      salaryMonth: '2026-06',
      age: 45,
      dependents: 0,
      enrollInInsurance: true,
    });
    expect(b.deductions.nursingCare).toBe(40);
    expect(b.deductions.healthInsurance).toBe(257);
    expect(b.deductions.nursingCare + b.deductions.healthInsurance).toBe(297);
  });

  it('所得税は合算丸め後の社保合計を基準に計算される（1円の差が課税対象額に正しく反映）', async () => {
    const r = await calculateSalary(input());
    const d = r.deductions;
    const social = d.healthInsurance + d.nursingCare + d.employeePension + d.unemployment + d.childSupport;
    const item = r.breakdown.deductions.find((x: any) => x.label.includes('所得税'));
    expect(item.calculation).toContain(`課税対象額¥${(r.grossSalary - social).toLocaleString()}`);
  });
});
