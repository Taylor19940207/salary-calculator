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

export interface Prefecture {
  code: string;
  name_ja: string;
  name_en: string;
  region: string;
}
