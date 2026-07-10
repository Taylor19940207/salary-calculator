export interface RateDetail {
  total: number;    // 総費率（労使合計）
  employee: number; // 員工負担分
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

  // 月給の場合
  baseSalary?: number;

  // 時給の場合
  hourlyWage?: number;
  totalWorkHours?: number;

  // 共通
  commutingAllowance: number;
  otherAllowances: number;
  prefecture: string;
  salaryMonth: string; // YYYY-MM format
  age: number;
  dependents: number;

  // 社会保険加入
  enrollInInsurance: boolean;

  // 加班・欠勤（オプション）
  overtime?: {
    regular: number;    // 1.25x
    holiday: number;    // 1.35x
    night: number;      // 1.25x
  };
  absenceDays?: number;
  scheduledMonthlyHours?: number; // 月所定労働時間（省略時160h）。祝日の多い月は少なくなる
}

export interface SalaryCalculationResult {
  grossSalary: number;
  standardMonthlyRemuneration: number;
  grades: {
    health: number | null;        // 健康保険の等級（1〜50）
    pension: number | null;       // 厚生年金の等級（1〜32）
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

export interface InsuranceRate {
  id: number;
  prefecture_code: string | null;
  rate_type: string;
  rate_percentage: number;
  employee_burden_percentage: number;
  effective_from: string;
  effective_to: string | null;
  source_url: string;
  notes: string;
}
