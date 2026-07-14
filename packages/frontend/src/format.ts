import type { SalaryCalculationResult, BonusCalculationResult } from './types';

// 銭単位（小数点2桁）に丸める。浮動小数点誤差の除去用
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// 金額表示: 整数はそのまま、端数がある場合のみ小数を表示
//（協会けんぽ保険料額表の折半額と同じ流儀。例: 2,981.2 / 15,760）
export function formatYen(amount: number): string {
  return round2(amount).toLocaleString('ja-JP', { maximumFractionDigits: 2 });
}

// 明細上で金額を手動調整できる控除項目。
// 健保・介護・子育て支援金は協会けんぽ料額表（または同構造の料率計算）で丸め前の小数が出るため、
// 表の値をそのまま表示し、各社の労使特約（切捨て・四捨五入等）に合わせて利用会社が手で調整する。
// 厚生年金（月給は等級×9.15%で必ず整数）・雇用保険（50銭ルールで徴収額確定）・
// 所得税・住民税は固定（編集不可）。
export type EditableDeductionField = 'healthInsurance' | 'nursingCare' | 'childSupport';
export const EDITABLE_FIELDS: readonly EditableDeductionField[] = [
  'healthInsurance',
  'nursingCare',
  'childSupport',
];

// 控除内訳の label → 編集可能フィールドの対応
export const LABEL_TO_FIELD: Record<string, EditableDeductionField> = {
  健康保険: 'healthInsurance',
  介護保険: 'nursingCare',
  '子ども・子育て支援金': 'childSupport',
};

// 入力欄は文字列で保持し（編集途中の状態を許容）、計算時に数値へ解決する
export type DeductionOverrides = Partial<Record<EditableDeductionField, string>>;

// 健保・介護・子育てのいずれかに端数（小数）が残っているか（要調整の判定に使う）
export function hasFraction(d: {
  healthInsurance: number;
  nursingCare: number;
  childSupport: number;
}): boolean {
  return (
    !Number.isInteger(d.healthInsurance) ||
    !Number.isInteger(d.nursingCare) ||
    !Number.isInteger(d.childSupport)
  );
}

function resolve(override: string | undefined, fallback: number): number {
  if (override === undefined || override.trim() === '') return fallback;
  const n = Number(override);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// 給与: 手動調整を反映した控除額・合計・手取を返す。
// 健保・介護・子育ては表の丸め前の金額（deductionsRaw）を既定とし、上書きがあればそれを使う。
// 所得税は法定丸め後の社保額から算出した値のまま（表示調整の影響を受けない・税法上の要件）。
export function mergedSalaryDeductions(result: SalaryCalculationResult, ov: DeductionOverrides) {
  const d = result.deductions;
  const raw = result.deductionsRaw;
  const healthInsurance = resolve(ov.healthInsurance, raw.healthInsurance);
  const nursingCare = resolve(ov.nursingCare, raw.nursingCare);
  const childSupport = resolve(ov.childSupport, raw.childSupport);
  const total = round2(
    healthInsurance +
      nursingCare +
      childSupport +
      d.employeePension +
      d.unemployment +
      d.incomeTax +
      d.residentTax
  );
  return {
    healthInsurance,
    nursingCare,
    childSupport,
    employeePension: d.employeePension,
    unemployment: d.unemployment,
    incomeTax: d.incomeTax,
    residentTax: d.residentTax,
    total,
    netSalary: round2(result.grossSalary - total),
  };
}

// 賞与: 同上（住民税なし）
export function mergedBonusDeductions(result: BonusCalculationResult, ov: DeductionOverrides) {
  const d = result.deductions;
  const raw = result.deductionsRaw;
  const healthInsurance = resolve(ov.healthInsurance, raw.healthInsurance);
  const nursingCare = resolve(ov.nursingCare, raw.nursingCare);
  const childSupport = resolve(ov.childSupport, raw.childSupport);
  const total = round2(
    healthInsurance + nursingCare + childSupport + d.employeePension + d.unemployment + d.incomeTax
  );
  return {
    healthInsurance,
    nursingCare,
    childSupport,
    employeePension: d.employeePension,
    unemployment: d.unemployment,
    incomeTax: d.incomeTax,
    total,
    netBonus: round2(result.bonusAmount - total),
  };
}
