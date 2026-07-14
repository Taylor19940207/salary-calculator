import { describe, it, expect, beforeAll } from 'vitest';
import { bonusTaxRate } from './bonusTaxRateTable2026.js';
import type { BonusInput } from '../types/index.js';

// calculateBonus は getInsuranceRates 経由で DB を参照するため、
// テスト用にインメモリ DB を migrate + seed してから読み込む。
let calculateBonus: (input: BonusInput) => Promise<any>;

beforeAll(async () => {
  process.env.DATABASE_PATH = ':memory:';
  const { ensureDatabase } = await import('../db/setup.js');
  await ensureDatabase();
  ({ calculateBonus } = await import('./bonusCalculator.js'));
});

// 東京(13)・令和8年6月・基本の入力
function input(over: Partial<BonusInput> = {}): BonusInput {
  return {
    bonusAmount: 500000,
    prevMonthAfterInsurance: 285454,
    prefecture: '13',
    salaryMonth: '2026-06',
    age: 35,
    dependents: 3,
    enrollInInsurance: true,
    ...over,
  };
}

describe('bonusTaxRate（賞与算出率表・甲欄）', () => {
  it('国税庁の計算例: 扶養3人・前月285,454円 → 2.042%', () => {
    expect(bonusTaxRate(3, 285454)).toBe(2.042);
  });

  it('扶養0人の帯境界', () => {
    expect(bonusTaxRate(0, 81999)).toBe(0); // 82千円未満は0%
    expect(bonusTaxRate(0, 82000)).toBe(2.042);
    expect(bonusTaxRate(0, 93999)).toBe(2.042);
    expect(bonusTaxRate(0, 94000)).toBe(4.084);
  });

  it('最上位帯（扶養0・3,495千円以上）→ 45.945%', () => {
    expect(bonusTaxRate(0, 3495000)).toBe(45.945);
    expect(bonusTaxRate(0, 10000000)).toBe(45.945);
  });

  it('扶養8人以上は7人の列を使用', () => {
    expect(bonusTaxRate(9, 400000)).toBe(bonusTaxRate(7, 400000));
    expect(bonusTaxRate(7, 400000)).toBe(4.084);
  });
});

describe('calculateBonus', () => {
  it('基本例: 賞与50万/前月285,454/扶養3/35歳 → 手取417,840・所得税8,710', async () => {
    const r = await calculateBonus(input());
    expect(r.deductions.healthInsurance).toBe(24625);
    expect(r.deductions.employeePension).toBe(45750);
    expect(r.deductions.childSupport).toBe(575);
    expect(r.deductions.unemployment).toBe(2500);
    expect(r.deductions.nursingCare).toBe(0); // 35歳
    expect(r.taxRate).toBe(2.042);
    expect(r.deductions.incomeTax).toBe(8710);
    expect(r.netBonus).toBe(417840);
  });

  it('標準賞与額は1,000円未満切捨て', async () => {
    const r = await calculateBonus(input({ bonusAmount: 500999 }));
    expect(r.standardBonusAmount).toBe(500000);
  });

  // 逐円一致の要: 浮動小数点で1円ずれないこと（回帰テスト）
  // 社保・雇用保険とも未加入にして bonusAfterInsurance = bonus（社保控除ゼロ）の条件で検証する
  it('所得税の丸め: 1,000,000×4.084% = 40,840（39ではない）', async () => {
    const r = await calculateBonus(
      input({
        enrollInInsurance: false,
        enrollInUnemploymentInsurance: false,
        dependents: 0,
        prevMonthAfterInsurance: 100000,
        bonusAmount: 1000000,
      })
    );
    expect(r.taxMethod).toBe('算出率 4.084%');
    expect(r.deductions.incomeTax).toBe(40840);
  });

  it('所得税の丸め: 未加入 500,000×2.042% = 10,210', async () => {
    const r = await calculateBonus(
      input({ enrollInInsurance: false, enrollInUnemploymentInsurance: false, bonusAmount: 500000 })
    );
    expect(r.deductions.healthInsurance).toBe(0);
    expect(r.deductions.unemployment).toBe(0);
    expect(r.deductions.incomeTax).toBe(10210);
  });

  it('特例: 賞与が前月給与の10倍ちょうどは算出率、10倍超で月額表', async () => {
    const eq = await calculateBonus(
      input({
        enrollInInsurance: false,
        enrollInUnemploymentInsurance: false,
        dependents: 0,
        prevMonthAfterInsurance: 100000,
        bonusAmount: 1000000,
      })
    );
    expect(eq.taxMethod).toBe('算出率 4.084%');
    const over = await calculateBonus(
      input({
        enrollInInsurance: false,
        enrollInUnemploymentInsurance: false,
        dependents: 0,
        prevMonthAfterInsurance: 100000,
        bonusAmount: 1000001,
      })
    );
    expect(over.taxMethod.startsWith('特例')).toBe(true);
  });

  it('雇用保険は社保未加入でも独立して課税基礎に反映される（enrollInUnemploymentInsurance未指定=加入）', async () => {
    const withUI = await calculateBonus(
      input({ enrollInInsurance: false, enrollInUnemploymentInsurance: true, dependents: 0, prevMonthAfterInsurance: 100000, bonusAmount: 1000000 })
    );
    const withoutUI = await calculateBonus(
      input({ enrollInInsurance: false, enrollInUnemploymentInsurance: false, dependents: 0, prevMonthAfterInsurance: 100000, bonusAmount: 1000000 })
    );
    expect(withUI.deductions.unemployment).toBeGreaterThan(0);
    expect(withoutUI.deductions.unemployment).toBe(0);
    // 雇用保険料が引かれる分、withUI の課税対象(bonusAfterInsurance)が減り、所得税も減る
    expect(withUI.deductions.incomeTax).toBeLessThan(withoutUI.deductions.incomeTax);
  });

  it('特例: 前月給与なし（0）は月額表で計算', async () => {
    const r = await calculateBonus(input({ prevMonthAfterInsurance: 0 }));
    expect(r.taxMethod.startsWith('特例')).toBe(true);
    expect(r.taxRate).toBeNull();
  });

  it('介護保険は40〜64歳のみ（39=0, 40/64=課税, 65=0）', async () => {
    expect((await calculateBonus(input({ age: 39 }))).deductions.nursingCare).toBe(0);
    expect((await calculateBonus(input({ age: 40 }))).deductions.nursingCare).toBe(4050);
    expect((await calculateBonus(input({ age: 64 }))).deductions.nursingCare).toBe(4050);
    expect((await calculateBonus(input({ age: 65 }))).deductions.nursingCare).toBe(0);
  });

  it('健保の標準賞与額は年度573万累計上限', async () => {
    expect((await calculateBonus(input({ priorFiscalBonusTotal: 5730000 }))).healthStandardBonus).toBe(0);
    expect((await calculateBonus(input({ priorFiscalBonusTotal: 5700000 }))).healthStandardBonus).toBe(30000);
  });

  it('厚年の標準賞与額は1回150万上限', async () => {
    const r = await calculateBonus(input({ bonusAmount: 2000000 }));
    expect(r.pensionStandardBonus).toBe(1500000);
  });

  it('賞与0円は全額0', async () => {
    const r = await calculateBonus(input({ bonusAmount: 0 }));
    expect(r.netBonus).toBe(0);
    expect(r.deductions.total).toBe(0);
  });
});
