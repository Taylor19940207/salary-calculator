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
  commutingAllowance: number;          // 通勤手当（非課税・社保基数には算入）
  businessTripAllowance?: number;      // 出張手当（非課税・実費弁償のため社保基数にも不算入）
  performancePay?: number;             // 業績給（毎月支給・課税・社保基数に算入。その他手当と同じ扱い）
  otherAllowances: number;
  prefecture: string;
  salaryMonth: string; // YYYY-MM format
  age: number;
  dependents: number;

  // 社会保険（健康保険・介護保険・厚生年金）加入
  enrollInInsurance: boolean;
  // 雇用保険加入。社会保険とは別制度のため独立して管理する
  // （例: 法人代表・役員は社会保険には加入するが雇用保険には加入できない）。
  // 省略時は true（一般被保険者）とみなす
  enrollInUnemploymentInsurance?: boolean;

  // 加班・欠勤（オプション）
  overtime?: {
    regular: number;    // 1.25x
    holiday: number;    // 1.35x
    night: number;      // 1.25x
  };
  absenceDays?: number;
  scheduledMonthlyHours?: number; // 月所定労働時間（省略時160h）。祝日の多い月は少なくなる
  manualGrade?: number;           // 社保等級の手動指定（健保等級番号1〜50、省略時は総支給額から自動判定）
  residentTax?: number;           // 住民税（特別徴収・月額）。市区町村の決定通知書の月割額をそのまま控除（計算しない）
  priorMonthAdjustment?: number;  // 前月調整訂正分。前期給与計算の誤りを当月で調整する手動入力額（正=追加控除、負=追加支給）
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
    residentTax: number; // 住民税（特別徴収・入力された月割額の転記）
    priorMonthAdjustment: number; // 前月調整訂正分（手動入力額の転記。正負可）
    total: number;
  };
  // 上記 deductions と同じ形だが、健保・介護・厚年・子育て支援金・雇用保険の5項目は
  // 被保険者負担分の法定端数処理（50銭以下切捨て・50銭超切上げ）を適用する前の生値（銭単位）。
  // 所得税・住民税・前月調整訂正分は端数処理の対象ではないため deductions と同じ値。
  // 明細で「端数を丸めない」表示を選んだときに使う（デフォルトでは使わない）。
  deductionsRaw: {
    healthInsurance: number;
    nursingCare: number;
    employeePension: number;
    unemployment: number;
    childSupport: number;
    incomeTax: number;
    residentTax: number;
    priorMonthAdjustment: number;
    total: number;
  };
  netSalary: number;
  netSalaryRaw: number; // grossSalary - deductionsRaw.total
  breakdown: {
    income: Array<{
      label: string;
      amount: number;
      description?: string;
    }>;
    deductions: Array<{
      label: string;
      amount: number;
      rawAmount: number; // 端数処理前の生値（社保5項目以外は amount と同じ）
      calculation: string;
      sourceUrl?: string;
    }>;
  };
  ratesUsed: InsuranceRates;
}

// 賞与（ボーナス）計算の入力。月給とは全く別の計算経路（算出率の表・標準賞与額）
export interface BonusInput {
  bonusAmount: number;                 // 賞与総支給額（円）
  prevMonthAfterInsurance: number;     // 前月の社会保険料等控除後の給与額（円）。0/未入力なら特例（月額表）で計算
  prefecture: string;
  salaryMonth: string;                 // YYYY-MM（料率の適用月）
  age: number;
  dependents: number;
  enrollInInsurance: boolean;
  enrollInUnemploymentInsurance?: boolean; // 雇用保険加入。false=未加入（法人代表・役員等）。省略時は加入扱い
  priorFiscalBonusTotal?: number;      // 当年度(4/1〜3/31)に既に支払った標準賞与額の累計（健保573万上限判定用、既定0）
  bonusCalcMonths?: number;            // 賞与計算期間の月数（特例時の除数。6を超えると12、既定6）
}

export interface BonusCalculationResult {
  bonusAmount: number;
  standardBonusAmount: number;         // 標準賞与額（1,000円未満切捨て、上限適用前）
  healthStandardBonus: number;         // 健保・介護・子育て支援金の対象額（年度573万累計上限適用後）
  pensionStandardBonus: number;        // 厚年の対象額（1回150万上限適用後）
  deductions: {
    healthInsurance: number;
    nursingCare: number;
    employeePension: number;
    unemployment: number;
    childSupport: number;
    incomeTax: number;
    total: number;
  };
  // deductions と同じ形だが、健保・介護・厚年・子育て支援金・雇用保険は
  // 被保険者負担分の法定端数処理を適用する前の生値（銭単位）。所得税は端数処理の対象外のため同じ値。
  deductionsRaw: {
    healthInsurance: number;
    nursingCare: number;
    employeePension: number;
    unemployment: number;
    childSupport: number;
    incomeTax: number;
    total: number;
  };
  netBonus: number;
  netBonusRaw: number; // bonusAmount - deductionsRaw.total
  taxMethod: string;                   // 例: '算出率 2.042%' / '特例（前月給与なし・月額表÷6×6）'
  taxRate: number | null;              // 算出率(%)。特例時は null
  breakdown: {
    income: Array<{ label: string; amount: number; description?: string }>;
    deductions: Array<{ label: string; amount: number; rawAmount: number; calculation: string; sourceUrl?: string }>;
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
