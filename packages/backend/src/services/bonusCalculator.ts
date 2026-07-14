import type { BonusInput, BonusCalculationResult, InsuranceRates } from '../types/index.js';
import { getInsuranceRates } from '../db/queries.js';
import { calculateIncomeTax, roundEmployeeBurden, round2 } from './salaryCalculator.js';
import { bonusTaxRate } from './bonusTaxRateTable2026.js';

// 標準賞与額の上限（令和8年度）
const HEALTH_ANNUAL_CAP = 5_730_000; // 健康保険・介護保険・子育て支援金: 年度(4/1〜3/31)累計 573万円
const PENSION_PER_PAYMENT_CAP = 1_500_000; // 厚生年金: 1回（同月合算）150万円

/**
 * 賞与（ボーナス）の手取り計算。
 * 月給とは別経路：社保は標準賞与額（1,000円未満切捨て・上限あり）、
 * 所得税は「賞与に対する源泉徴収税額の算出率の表」甲欄。
 * 特例（前月給与なし／賞与が前月給与の10倍超）では月額表で計算する。
 */
export async function calculateBonus(input: BonusInput): Promise<BonusCalculationResult> {
  const bonus = Math.max(0, Math.floor(input.bonusAmount));
  const targetDate = new Date(input.salaryMonth + '-01');
  const isNursing = input.age >= 40 && input.age <= 64;

  // 1. 標準賞与額（1,000円未満切捨て）と上限適用
  const standardBonusAmount = Math.floor(bonus / 1000) * 1000;
  const priorCumulative = Math.max(0, input.priorFiscalBonusTotal || 0);
  const healthStandardBonus = Math.max(
    0,
    Math.min(standardBonusAmount, HEALTH_ANNUAL_CAP - priorCumulative)
  );
  const pensionStandardBonus = Math.min(standardBonusAmount, PENSION_PER_PAYMENT_CAP);

  // 2. 料率取得
  const ratesMap = await getInsuranceRates(input.prefecture, targetDate);
  const ratesUsed: InsuranceRates = {
    healthInsurance: {
      total: ratesMap.health_insurance?.rate_percentage || 0,
      employee: ratesMap.health_insurance?.employee_burden_percentage || 0,
    },
    nursingCare: {
      total: isNursing ? ratesMap.nursing_care?.rate_percentage || 0 : 0,
      employee: isNursing ? ratesMap.nursing_care?.employee_burden_percentage || 0 : 0,
    },
    employeePension: {
      total: ratesMap.pension?.rate_percentage || 0,
      employee: ratesMap.pension?.employee_burden_percentage || 0,
    },
    unemployment: {
      total: ratesMap.unemployment?.rate_percentage || 0,
      employee: ratesMap.unemployment?.employee_burden_percentage || 0,
    },
    childSupport: {
      total: ratesMap.child_support?.rate_percentage || 0,
      employee: ratesMap.child_support?.employee_burden_percentage || 0,
    },
    effectiveDate: ratesMap.health_insurance?.effective_from || '',
    sourceUrls: {
      healthInsurance: ratesMap.health_insurance?.source_url || '',
      pension: ratesMap.pension?.source_url || '',
      unemployment: ratesMap.unemployment?.source_url || '',
    },
  };

  // deductions = 法定丸め後（正式な徴収額）。deductionsRaw = 丸め前の生値（銭単位、明細の表示切替用）
  const deductions = {
    healthInsurance: 0,
    nursingCare: 0,
    employeePension: 0,
    unemployment: 0,
    childSupport: 0,
    incomeTax: 0,
    total: 0,
  };
  const deductionsRaw = { ...deductions };
  const breakdown: BonusCalculationResult['breakdown'] = {
    income: [{ label: '賞与', amount: bonus }],
    deductions: [],
  };

  // 3. 社会保険料（本人負担・端数は50銭以下切捨て/50銭超切上げ）
  if (input.enrollInInsurance) {
    const capNote =
      healthStandardBonus < standardBonusAmount ? `（年度累計573万上限適用後 ¥${healthStandardBonus.toLocaleString()}）` : '';

    const healthInsuranceRaw = healthStandardBonus * (ratesUsed.healthInsurance.employee / 100);
    deductions.healthInsurance = roundEmployeeBurden(healthInsuranceRaw);
    deductionsRaw.healthInsurance = round2(healthInsuranceRaw);
    breakdown.deductions.push({
      label: '健康保険',
      amount: deductions.healthInsurance,
      rawAmount: deductionsRaw.healthInsurance,
      calculation: `標準賞与額 ¥${standardBonusAmount.toLocaleString()}${capNote} × ${ratesUsed.healthInsurance.employee}%（総料率 ${ratesUsed.healthInsurance.total}% の労使折半）`,
      sourceUrl: ratesUsed.sourceUrls.healthInsurance,
    });

    if (isNursing) {
      const nursingCareRaw = healthStandardBonus * (ratesUsed.nursingCare.employee / 100);
      deductions.nursingCare = roundEmployeeBurden(nursingCareRaw);
      deductionsRaw.nursingCare = round2(nursingCareRaw);
      breakdown.deductions.push({
        label: '介護保険',
        amount: deductions.nursingCare,
        rawAmount: deductionsRaw.nursingCare,
        calculation: `標準賞与額 ¥${healthStandardBonus.toLocaleString()} × ${ratesUsed.nursingCare.employee}%（総料率 ${ratesUsed.nursingCare.total}% の労使折半）`,
      });
    }

    const pensionCapNote =
      pensionStandardBonus < standardBonusAmount ? `（1回150万上限適用後 ¥${pensionStandardBonus.toLocaleString()}）` : '';
    const employeePensionRaw = pensionStandardBonus * (ratesUsed.employeePension.employee / 100);
    deductions.employeePension = roundEmployeeBurden(employeePensionRaw);
    deductionsRaw.employeePension = round2(employeePensionRaw);
    breakdown.deductions.push({
      label: '厚生年金',
      amount: deductions.employeePension,
      rawAmount: deductionsRaw.employeePension,
      calculation: `標準賞与額 ¥${standardBonusAmount.toLocaleString()}${pensionCapNote} × ${ratesUsed.employeePension.employee}%（総料率 ${ratesUsed.employeePension.total}% の労使折半）`,
      sourceUrl: ratesUsed.sourceUrls.pension,
    });

    const childSupportRaw = healthStandardBonus * (ratesUsed.childSupport.employee / 100);
    deductions.childSupport = roundEmployeeBurden(childSupportRaw);
    deductionsRaw.childSupport = round2(childSupportRaw);
    breakdown.deductions.push({
      label: '子ども・子育て支援金',
      amount: deductions.childSupport,
      rawAmount: deductionsRaw.childSupport,
      calculation: `標準賞与額 ¥${healthStandardBonus.toLocaleString()} × ${ratesUsed.childSupport.employee}%（総料率 ${ratesUsed.childSupport.total}% の労使折半）`,
    });

  }

  // 雇用保険は社会保険（健保・介護・厚年）とは別制度のため、enrollInInsurance とは独立して判定する。
  // 法人代表・役員は社会保険に加入していても雇用保険には加入できない。省略時は一般被保険者として扱う。
  const enrollInUnemploymentInsurance = input.enrollInUnemploymentInsurance !== false;
  if (enrollInUnemploymentInsurance) {
    // 雇用保険は標準賞与額ではなく賞与の実支給額に料率を掛ける
    const unemploymentRaw = bonus * (ratesUsed.unemployment.employee / 100);
    deductions.unemployment = roundEmployeeBurden(unemploymentRaw);
    deductionsRaw.unemployment = round2(unemploymentRaw);
    breakdown.deductions.push({
      label: '雇用保険',
      amount: deductions.unemployment,
      rawAmount: deductionsRaw.unemployment,
      calculation: `賞与総額 ¥${bonus.toLocaleString()} × ${ratesUsed.unemployment.employee}%（総料率 ${ratesUsed.unemployment.total}%）`,
      sourceUrl: ratesUsed.sourceUrls.unemployment,
    });
  } else {
    breakdown.deductions.push({
      label: '雇用保険',
      amount: 0,
      rawAmount: 0,
      calculation: '未加入（法人代表・役員など、雇用保険の被保険者に該当しないため）',
    });
  }

  const socialTotal =
    deductions.healthInsurance +
    deductions.nursingCare +
    deductions.employeePension +
    deductions.unemployment +
    deductions.childSupport;

  // 4. 所得税（賞与の社会保険料控除後の金額に率を掛ける／特例は月額表）
  const bonusAfterInsurance = bonus - socialTotal;
  const prev = Math.max(0, Math.floor(input.prevMonthAfterInsurance || 0));
  const months = input.bonusCalcMonths && input.bonusCalcMonths > 6 ? 12 : 6;

  let taxMethod: string;
  let taxRate: number | null = null;

  // 所得税は法定丸め後の社保額（socialTotal）を基準に計算する唯一の値
  // （月給と同じ理由で、raw版でも同じ値を使う。所得税自体は端数処理の対象外＝1円未満切捨てのみ）
  if (prev <= 0 || bonusAfterInsurance > prev * 10) {
    // 特例: 月額表甲欄を使い、賞与(社保控除後)÷月数 の税額を月数倍する
    const base = bonusAfterInsurance / months;
    deductions.incomeTax = calculateIncomeTax(base, input.dependents) * months;
    const reason = prev <= 0 ? '前月給与なし' : `賞与が前月給与の10倍超`;
    taxMethod = `特例（${reason}・月額表÷${months}×${months}）`;
    breakdown.deductions.push({
      label: '所得税（源泉徴収）',
      amount: deductions.incomeTax,
      rawAmount: deductions.incomeTax,
      calculation: `${taxMethod}: (¥${bonusAfterInsurance.toLocaleString()} ÷ ${months}) を月額表甲欄・扶養${input.dependents}人にあて ×${months}`,
    });
  } else {
    taxRate = bonusTaxRate(input.dependents, prev);
    // 率は最大3桁小数（例 2.042%）。浮動小数点の誤差で1円ずれるのを防ぐため
    // 率を1000倍した整数で計算する（税額は1円未満切捨て）
    const rateThousandths = Math.round(taxRate * 1000);
    deductions.incomeTax = Math.floor((bonusAfterInsurance * rateThousandths) / 100000);
    taxMethod = `算出率 ${taxRate}%`;
    breakdown.deductions.push({
      label: '所得税（源泉徴収）',
      amount: deductions.incomeTax,
      rawAmount: deductions.incomeTax,
      calculation: `賞与算出率表 甲欄: 前月社保控除後給与 ¥${prev.toLocaleString()}・扶養${input.dependents}人 → ${taxRate}% × 賞与(社保控除後) ¥${bonusAfterInsurance.toLocaleString()}`,
    });
  }
  deductionsRaw.incomeTax = deductions.incomeTax;

  deductions.total = socialTotal + deductions.incomeTax;
  const netBonus = bonus - deductions.total;

  const socialTotalRaw =
    deductionsRaw.healthInsurance +
    deductionsRaw.nursingCare +
    deductionsRaw.employeePension +
    deductionsRaw.unemployment +
    deductionsRaw.childSupport;
  deductionsRaw.total = round2(socialTotalRaw + deductionsRaw.incomeTax);
  const netBonusRaw = round2(bonus - deductionsRaw.total);

  return {
    bonusAmount: bonus,
    standardBonusAmount,
    healthStandardBonus,
    pensionStandardBonus,
    deductions,
    deductionsRaw,
    netBonus,
    netBonusRaw,
    taxMethod,
    taxRate,
    breakdown,
    ratesUsed,
  };
}
