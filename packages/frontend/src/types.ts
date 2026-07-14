export interface RateDetail {
  total: number;    // 総料率（労使合計）
  employee: number; // 労働者負担分
}

export interface InsuranceRates {
  healthInsurance: RateDetail;
  nursingCare: RateDetail;
  employeePension: RateDetail;
  unemployment: RateDetail;
  childSupport: RateDetail;
  effectiveDate: string;
  sourceUrls: Record<string, string>;
}

export interface SalaryInput {
  salaryType: 'monthly' | 'hourly';
  baseSalary?: number;
  hourlyWage?: number;
  totalWorkHours?: number;
  commutingAllowance: number;
  businessTripAllowance?: number; // 出張手当（非課税・社保基数にも不算入）
  performancePay?: number;        // 業績給（毎月支給・課税・社保基数に算入。その他手当と同じ扱い）
  otherAllowances: number;
  prefecture: string;
  salaryMonth: string;
  age: number;
  dependents: number;
  enrollInInsurance: boolean;
  overtime?: {
    regular: number;
    holiday: number;
    night: number;
  };
  absenceDays?: number;
  scheduledMonthlyHours?: number; // 月所定労働時間（省略時160h）
  manualGrade?: number;           // 社保等級の手動指定（1〜50、省略時は自動判定）
  residentTax?: number;           // 住民税（特別徴収・月額）。決定通知書の月割額をそのまま控除
  enrollInUnemploymentInsurance?: boolean; // 雇用保険加入。false=未加入（法人代表・役員等）、省略時は加入扱い
}

export interface GradeInfo {
  grade_number: number;
  min_amount: number;
  max_amount: number;
  standard_amount: number;
}

export interface SalaryCalculationResult {
  grossSalary: number;
  standardMonthlyRemuneration: number;
  grades: {
    health: number | null;         // 健康保険の等級（1〜50）
    pension: number | null;        // 厚生年金の等級（1〜32）
    pensionStandardAmount: number; // 厚生年金の標準報酬月額（650,000円上限）
  };
  deductions: {
    healthInsurance: number;
    nursingCare: number;
    employeePension: number;
    unemployment: number;
    childSupport: number;
    incomeTax: number;
    residentTax: number; // 住民税（特別徴収・入力された月割額の転記）
    total: number;
  };
  netSalary: number;
  breakdown: {
    income: Array<{
      label: string;
      amount: number;
      description?: string;
    }>;
    deductions: Array<{
      label: string;
      amount: number;
      calculation: string;
      sourceUrl?: string;
    }>;
  };
  ratesUsed: InsuranceRates;
}

// 賞与（ボーナス）計算
export interface BonusInput {
  bonusAmount: number;                 // 賞与総支給額（円）
  prevMonthAfterInsurance: number;     // 前月の社会保険料等控除後の給与額（円）。0なら特例（月額表）
  prefecture: string;
  salaryMonth: string;                 // YYYY-MM（料率の適用月）
  age: number;
  dependents: number;
  enrollInInsurance: boolean;
  enrollInUnemploymentInsurance?: boolean; // 雇用保険加入。false=未加入（法人代表・役員等）
  priorFiscalBonusTotal?: number;      // 当年度(4/1〜3/31)の既払標準賞与額累計（健保573万上限判定用）
  bonusCalcMonths?: number;            // 賞与計算期間の月数（特例時の除数。6超で12、既定6）
}

export interface BonusCalculationResult {
  bonusAmount: number;
  standardBonusAmount: number;
  healthStandardBonus: number;
  pensionStandardBonus: number;
  deductions: {
    healthInsurance: number;
    nursingCare: number;
    employeePension: number;
    unemployment: number;
    childSupport: number;
    incomeTax: number;
    total: number;
  };
  netBonus: number;
  taxMethod: string;
  taxRate: number | null;
  breakdown: {
    income: Array<{ label: string; amount: number; description?: string }>;
    deductions: Array<{ label: string; amount: number; calculation: string; sourceUrl?: string }>;
  };
  ratesUsed: InsuranceRates;
}

export interface Prefecture {
  code: string;
  name_ja: string;
  name_en: string;
  region: string;
}
