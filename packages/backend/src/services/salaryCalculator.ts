import type { SalaryInput, SalaryCalculationResult, InsuranceRates } from '../types/index.js';
import { getInsuranceRates, calculateStandardRemuneration } from '../db/queries.js';
import {
  MONTHLY_KOU_BRACKETS_2026,
  MONTHLY_KOU_ANCHORS_2026,
  OVER_7_DEPENDENTS_DEDUCTION_2026,
} from './incomeTaxTable2026.js';

// 所得税計算（令和8年分 源泉徴収税額表 月額表・甲欄による査表方式）
// 紙の税額表と1円単位で一致するため、年末調整との差額が出ない
// 賞与の特例（前月給与なし・10倍超）でも月額表を使うため export する
export function calculateIncomeTax(socialInsuranceDeductedSalary: number, dependents: number): number {
  const A = Math.floor(socialInsuranceDeductedSalary); // その月の社会保険料等控除後の給与等の金額
  if (A < 105000) return 0; // 105,000円未満は扶養人数にかかわらず0円

  const depIndex = Math.min(dependents, 7);
  const extraDependents = Math.max(0, dependents - 7);

  let tax: number | null = null;

  if (A < 740000) {
    for (const [min, max, taxes] of MONTHLY_KOU_BRACKETS_2026) {
      if (A >= min && A < max) {
        tax = taxes[depIndex];
        break;
      }
    }
  }

  if (tax === null) {
    // 740,000円以上: 直近の基準額の税額に超過分×税率を加算（1円未満切捨て）
    let anchor = MONTHLY_KOU_ANCHORS_2026[0];
    for (const a of MONTHLY_KOU_ANCHORS_2026) {
      if (A >= a[0]) anchor = a;
    }
    const [base, taxes, rate] = anchor;
    tax = taxes[depIndex] + Math.floor((A - base) * rate);
  }

  // 扶養親族等が7人を超える場合は1人ごとに1,610円を控除
  tax -= extraDependents * OVER_7_DEPENDENTS_DEDUCTION_2026;

  return Math.max(0, tax);
}

// 厚生年金の標準報酬月額は健康保険と等級表が異なる（1等級88,000円〜32等級650,000円）
const PENSION_STANDARD_MIN = 88000;
const PENSION_STANDARD_MAX = 650000;

function toPensionStandardRemuneration(healthStandardRemuneration: number): number {
  return Math.min(Math.max(healthStandardRemuneration, PENSION_STANDARD_MIN), PENSION_STANDARD_MAX);
}

// 厚生年金の等級は健康保険の等級から3を引いた値（1〜32等級にクリップ）
// 健保4等級(88,000円)=年金1等級、健保35等級(650,000円)=年金32等級
function toPensionGrade(healthGrade: number | null): number | null {
  if (healthGrade === null) return null;
  return Math.min(Math.max(healthGrade - 3, 1), 32);
}

// 被保険者負担分の端数処理: 50銭以下切捨て、50銭超切上げ（健康保険法167条等）
export function roundEmployeeBurden(amount: number): number {
  const floor = Math.floor(amount);
  return amount - floor <= 0.5 ? floor : floor + 1;
}

export async function calculateSalary(input: SalaryInput): Promise<SalaryCalculationResult> {
  // 1. 総支給額の計算
  let grossSalary = 0;
  const breakdown: SalaryCalculationResult['breakdown'] = {
    income: [],
    deductions: [],
  };

  if (input.salaryType === 'monthly') {
    grossSalary = input.baseSalary || 0;
    breakdown.income.push({
      label: '基本給',
      amount: input.baseSalary || 0,
    });
  } else if (input.salaryType === 'hourly') {
    const baseAmount = (input.hourlyWage || 0) * (input.totalWorkHours || 0);
    grossSalary = baseAmount;
    breakdown.income.push({
      label: '基本給',
      amount: baseAmount,
      description: `時給 ¥${input.hourlyWage?.toLocaleString()} × ${input.totalWorkHours}時間`,
    });
  }

  // 加班費計算（月所定労働時間は祝日数により月ごとに変動するため入力可能）
  const scheduledHours = input.scheduledMonthlyHours || 160;
  const hourlyRate = input.salaryType === 'hourly'
    ? input.hourlyWage || 0
    : (input.baseSalary || 0) / scheduledHours;
  const rateBasis = input.salaryType === 'hourly'
    ? `時給 ¥${hourlyRate.toLocaleString()}`
    : `基準時給 ¥${Math.round(hourlyRate).toLocaleString()}（月給 ¥${(input.baseSalary || 0).toLocaleString()} ÷ 所定${scheduledHours}h）`;

  if (input.overtime) {
    if (input.overtime.regular > 0) {
      const overtimeAmount = Math.round(hourlyRate * 1.25 * input.overtime.regular);
      grossSalary += overtimeAmount;
      breakdown.income.push({
        label: '残業手当',
        amount: overtimeAmount,
        description: `${rateBasis} × 1.25 × ${input.overtime.regular}h = ¥${overtimeAmount.toLocaleString()}`,
      });
    }

    if (input.overtime.holiday > 0) {
      const holidayAmount = Math.round(hourlyRate * 1.35 * input.overtime.holiday);
      grossSalary += holidayAmount;
      breakdown.income.push({
        label: '休日労働手当',
        amount: holidayAmount,
        description: `${rateBasis} × 1.35 × ${input.overtime.holiday}h = ¥${holidayAmount.toLocaleString()}`,
      });
    }

    if (input.overtime.night > 0) {
      const nightAmount = Math.round(hourlyRate * 1.25 * input.overtime.night);
      grossSalary += nightAmount;
      breakdown.income.push({
        label: '深夜労働手当',
        amount: nightAmount,
        description: `${rateBasis} × 1.25 × ${input.overtime.night}h = ¥${nightAmount.toLocaleString()}`,
      });
    }
  }

  // 欠勤控除（月給制のみ・ノーワークノーペイの原則）
  // 月所定労働日数 = 月所定労働時間 ÷ 8h/日
  if (input.salaryType === 'monthly' && (input.absenceDays || 0) > 0) {
    const workingDaysPerMonth = Math.round(scheduledHours / 8);
    const dailyRate = (input.baseSalary || 0) / workingDaysPerMonth;
    const absenceDeduction = Math.round(dailyRate * (input.absenceDays || 0));
    grossSalary -= absenceDeduction;
    breakdown.income.push({
      label: '欠勤控除',
      amount: -absenceDeduction,
      description: `日割額 ¥${Math.round(dailyRate).toLocaleString()}（月給 ¥${(input.baseSalary || 0).toLocaleString()} ÷ 所定${workingDaysPerMonth}日） × ${input.absenceDays}日 = -¥${absenceDeduction.toLocaleString()}`,
    });
  }

  // 手当追加
  const businessTripAllowance = input.businessTripAllowance || 0;
  const performancePay = input.performancePay || 0;
  grossSalary += input.commutingAllowance + performancePay + input.otherAllowances;

  if (input.commutingAllowance > 0) {
    breakdown.income.push({
      label: '通勤手当（非課税）',
      amount: input.commutingAllowance,
      description: '所得税非課税・社会保険の報酬には算入',
    });
  }

  if (performancePay > 0) {
    breakdown.income.push({
      label: '業績給',
      amount: performancePay,
      description: '課税・社会保険および雇用保険の基数に算入（その他手当と同じ扱い）',
    });
  }

  if (input.otherAllowances > 0) {
    breakdown.income.push({
      label: 'その他手当',
      amount: input.otherAllowances,
    });
  }

  // 出張手当は実費弁償のため報酬に該当せず、社保基数の判定前に加算しない
  // （支給額としては総支給に含めて表示する）
  const remunerationForGrade = grossSalary;
  grossSalary += businessTripAllowance;

  if (businessTripAllowance > 0) {
    breakdown.income.push({
      label: '出張手当（非課税）',
      amount: businessTripAllowance,
      description: '実費弁償のため所得税非課税・社会保険の報酬にも不算入',
    });
  }

  // 2. 標準報酬月額の計算（出張手当を除いた報酬で判定、手動等級指定があれば優先）
  const targetDate = new Date(input.salaryMonth + '-01');
  const { amount: standardMonthlyRemuneration, grade: healthGrade } =
    await calculateStandardRemuneration(remunerationForGrade, targetDate, input.manualGrade);

  // 厚生年金は健保と等級表が異なるため別途算出
  const pensionStandardRemuneration = toPensionStandardRemuneration(standardMonthlyRemuneration);
  const pensionGrade = toPensionGrade(healthGrade);

  // 3. 保険料率取得
  const ratesMap = await getInsuranceRates(input.prefecture, targetDate);

  const insuranceRates: InsuranceRates = {
    healthInsurance: {
      total: ratesMap.health_insurance?.rate_percentage || 0,
      employee: ratesMap.health_insurance?.employee_burden_percentage || 0,
    },
    // 介護保険第2号被保険者は40〜64歳。65歳以降は第1号となり給与天引きされない
    nursingCare: {
      total: input.age >= 40 && input.age <= 64 ? (ratesMap.nursing_care?.rate_percentage || 0) : 0,
      employee: input.age >= 40 && input.age <= 64 ? (ratesMap.nursing_care?.employee_burden_percentage || 0) : 0,
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

  // 4. 控除額計算
  const deductions = {
    healthInsurance: 0,
    nursingCare: 0,
    employeePension: 0,
    unemployment: 0,
    childSupport: 0,
    incomeTax: 0,
    residentTax: 0,
    total: 0,
  };

  if (input.enrollInInsurance) {
    const manualNote = input.manualGrade ? '【手動指定】' : '';
    const healthGradeLabel = healthGrade !== null ? `${manualNote}健保等級 第${healthGrade}級・` : '';
    // 健康保険
    deductions.healthInsurance = roundEmployeeBurden(
      standardMonthlyRemuneration * (insuranceRates.healthInsurance.employee / 100)
    );
    breakdown.deductions.push({
      label: '健康保険',
      amount: deductions.healthInsurance,
      calculation: `${healthGradeLabel}標準報酬月額 ¥${standardMonthlyRemuneration.toLocaleString()} × ${insuranceRates.healthInsurance.employee}%（総料率 ${insuranceRates.healthInsurance.total}% の労使折半）`,
      sourceUrl: insuranceRates.sourceUrls.healthInsurance,
    });

    // 介護保険（第2号被保険者: 40〜64歳。65歳以降は年金からの特別徴収となり給与控除なし）
    if (input.age >= 40 && input.age <= 64) {
      deductions.nursingCare = roundEmployeeBurden(
        standardMonthlyRemuneration * (insuranceRates.nursingCare.employee / 100)
      );
      breakdown.deductions.push({
        label: '介護保険',
        amount: deductions.nursingCare,
        calculation: `${healthGradeLabel}標準報酬月額 ¥${standardMonthlyRemuneration.toLocaleString()} × ${insuranceRates.nursingCare.employee}%（総料率 ${insuranceRates.nursingCare.total}% の労使折半）`,
      });
    }

    // 厚生年金（等級表は健保と異なり88,000円〜650,000円で頭打ち）
    const pensionGradeLabel = pensionGrade !== null ? `厚年等級 第${pensionGrade}級・` : '';
    const cappedNote = pensionStandardRemuneration > standardMonthlyRemuneration
      ? `（下限 ¥${PENSION_STANDARD_MIN.toLocaleString()} 適用）`
      : pensionStandardRemuneration < standardMonthlyRemuneration
        ? `（上限 ¥${PENSION_STANDARD_MAX.toLocaleString()} 適用）`
        : '';
    deductions.employeePension = roundEmployeeBurden(
      pensionStandardRemuneration * (insuranceRates.employeePension.employee / 100)
    );
    breakdown.deductions.push({
      label: '厚生年金',
      amount: deductions.employeePension,
      calculation: `${pensionGradeLabel}標準報酬月額 ¥${pensionStandardRemuneration.toLocaleString()}${cappedNote} × ${insuranceRates.employeePension.employee}%（総料率 ${insuranceRates.employeePension.total}% の労使折半）`,
      sourceUrl: insuranceRates.sourceUrls.pension,
    });

    // 子ども・子育て支援金
    deductions.childSupport = roundEmployeeBurden(
      standardMonthlyRemuneration * (insuranceRates.childSupport.employee / 100)
    );
    breakdown.deductions.push({
      label: '子ども・子育て支援金',
      amount: deductions.childSupport,
      calculation: `基数 ¥${standardMonthlyRemuneration.toLocaleString()} × ${insuranceRates.childSupport.employee}%（総料率 ${insuranceRates.childSupport.total}% の労使折半）`,
    });

  }

  // 雇用保険は社会保険（健保・介護・厚年）とは別制度のため、enrollInInsurance とは独立して判定する。
  // 法人代表・役員は「労働者」に該当しないため、社会保険に加入していても雇用保険には加入できない。
  // 省略時は一般被保険者（加入）として扱う。
  const enrollInUnemploymentInsurance = input.enrollInUnemploymentInsurance !== false;
  if (enrollInUnemploymentInsurance) {
    // 雇用保険（被保険者負担分も50銭以下切捨て・50銭超切上げ）
    // 出張旅費は実費弁償のため賃金に含めない
    const wageForUnemployment = grossSalary - businessTripAllowance;
    deductions.unemployment = roundEmployeeBurden(
      wageForUnemployment * (insuranceRates.unemployment.employee / 100)
    );
    breakdown.deductions.push({
      label: '雇用保険',
      amount: deductions.unemployment,
      calculation: `賃金総額 ¥${wageForUnemployment.toLocaleString()} × ${insuranceRates.unemployment.employee}%（総料率 ${insuranceRates.unemployment.total}%、事業主負担 ${Math.round((insuranceRates.unemployment.total - insuranceRates.unemployment.employee) * 1000) / 1000}%）`,
      sourceUrl: insuranceRates.sourceUrls.unemployment,
    });
  } else {
    breakdown.deductions.push({
      label: '雇用保険',
      amount: 0,
      calculation: '未加入（法人代表・役員など、雇用保険の被保険者に該当しないため）',
    });
  }

  // 5. 所得税計算（通勤手当・出張手当は非課税）
  const nonTaxable = input.commutingAllowance + businessTripAllowance;
  const taxableIncome = grossSalary - nonTaxable -
    deductions.healthInsurance - deductions.nursingCare -
    deductions.employeePension - deductions.unemployment -
    deductions.childSupport;

  deductions.incomeTax = calculateIncomeTax(taxableIncome, input.dependents);
  breakdown.deductions.push({
    label: '所得税（源泉徴収）',
    amount: deductions.incomeTax,
    calculation: `課税対象額¥${taxableIncome.toLocaleString()}（非課税手当¥${nonTaxable.toLocaleString()}控除後）、扶養${input.dependents}人、令和8年分月額表甲欄`,
  });

  // 5-2. 住民税（特別徴収）: 前年所得に基づき市区町村が決定した月割額をそのまま控除する。
  // 計算はしない（決定通知書の転記）。当月の所得税・社会保険料には一切影響しない。
  deductions.residentTax = Math.max(0, Math.floor(input.residentTax || 0));
  if (deductions.residentTax > 0) {
    breakdown.deductions.push({
      label: '住民税（特別徴収）',
      amount: deductions.residentTax,
      calculation: '市区町村の特別徴収税額決定通知書による月割額（前年所得に基づく決定額の転記）',
    });
  }

  // 総控除額
  deductions.total = Object.values(deductions).reduce((sum, val) => sum + val, 0) - deductions.total;

  // 6. 手取額
  const netSalary = grossSalary - deductions.total;

  return {
    grossSalary,
    standardMonthlyRemuneration,
    grades: {
      health: healthGrade,
      pension: pensionGrade,
      pensionStandardAmount: pensionStandardRemuneration,
    },
    deductions,
    netSalary,
    breakdown,
    ratesUsed: insuranceRates,
  };
}
