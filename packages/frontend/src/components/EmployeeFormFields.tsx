import type { Prefecture, GradeInfo, SalaryInput, BonusInput } from '../types';

// 多人版で 1 名分の入力を保持するドラフト。数値は文字列で保持し、
// 計算時に draftToInput() で SalaryInput に変換する（単人版 SalaryForm と同じ流儀）。
export interface EmployeeDraft {
  id: string;
  name: string;
  salaryType: 'monthly' | 'hourly';
  baseSalary: string;
  hourlyWage: string;
  totalWorkHours: string;
  commutingAllowance: string;
  businessTripAllowance: string;
  otherAllowances: string;
  prefecture: string;
  salaryMonth: string;
  age: string;
  dependents: string;
  enrollInInsurance: boolean;
  manualGrade: string; // '' = 自動判定
  residentTax: string; // 住民税（特別徴収・月額）。'' = 控除なし
  showOvertime: boolean;
  overtimeRegular: string;
  overtimeHoliday: string;
  overtimeNight: string;
  absenceDays: string;
  scheduledMonthlyHours: string;
  // 賞与（今月支給があれば ON。給与とは別計算だが基本情報は共通）
  hasBonus: boolean;
  bonusAmount: string;
  prevMonthAfterInsurance: string;
  priorFiscalBonusTotal: string;
  bonusCalcMonths: string;
}

export function createEmptyDraft(index: number): EmployeeDraft {
  return {
    id: `EMP${index + 1}`,
    name: `従業員 ${index + 1}`,
    salaryType: 'monthly',
    baseSalary: '300000',
    hourlyWage: '1500',
    totalWorkHours: '160',
    commutingAllowance: '10000',
    businessTripAllowance: '0',
    otherAllowances: '0',
    prefecture: '13',
    salaryMonth: '2026-05',
    age: '35',
    dependents: '0',
    enrollInInsurance: true,
    manualGrade: '',
    residentTax: '',
    showOvertime: false,
    overtimeRegular: '0',
    overtimeHoliday: '0',
    overtimeNight: '0',
    absenceDays: '0',
    scheduledMonthlyHours: '160',
    // 賞与額・前月給与はダミー既定値を置かない（消し忘れ＝税率誤りに直結）
    hasBonus: false,
    bonusAmount: '',
    prevMonthAfterInsurance: '',
    priorFiscalBonusTotal: '0',
    bonusCalcMonths: '6',
  };
}

// 賞与ありのドラフトを BonusInput に変換（基本情報は給与と共通）
export function draftToBonusInput(d: EmployeeDraft): BonusInput {
  return {
    bonusAmount: Number(d.bonusAmount),
    prevMonthAfterInsurance: Number(d.prevMonthAfterInsurance) || 0,
    prefecture: d.prefecture,
    salaryMonth: d.salaryMonth,
    age: Number(d.age),
    dependents: Number(d.dependents),
    enrollInInsurance: d.enrollInInsurance,
    priorFiscalBonusTotal: Number(d.priorFiscalBonusTotal) || undefined,
    bonusCalcMonths: Number(d.bonusCalcMonths) || undefined,
  };
}

// ドラフトを API 送信用の SalaryInput（＋id/name）に変換
export function draftToInput(d: EmployeeDraft): SalaryInput & { id: string; name: string } {
  const input: SalaryInput & { id: string; name: string } = {
    id: d.id,
    name: d.name,
    salaryType: d.salaryType,
    baseSalary: d.salaryType === 'monthly' ? Number(d.baseSalary) : undefined,
    hourlyWage: d.salaryType === 'hourly' ? Number(d.hourlyWage) : undefined,
    totalWorkHours: d.salaryType === 'hourly' ? Number(d.totalWorkHours) : undefined,
    commutingAllowance: Number(d.commutingAllowance),
    businessTripAllowance: Number(d.businessTripAllowance) || undefined,
    otherAllowances: Number(d.otherAllowances),
    prefecture: d.prefecture,
    salaryMonth: d.salaryMonth,
    age: Number(d.age),
    dependents: Number(d.dependents),
    enrollInInsurance: d.enrollInInsurance,
    manualGrade: d.manualGrade ? Number(d.manualGrade) : undefined,
    residentTax: Number(d.residentTax) > 0 ? Number(d.residentTax) : undefined,
  };

  if (d.showOvertime) {
    input.overtime = {
      regular: Number(d.overtimeRegular),
      holiday: Number(d.overtimeHoliday),
      night: Number(d.overtimeNight),
    };
    input.absenceDays = Number(d.absenceDays);
    input.scheduledMonthlyHours = Number(d.scheduledMonthlyHours) || 160;
  }

  return input;
}

interface Props {
  value: EmployeeDraft;
  onChange: (patch: Partial<EmployeeDraft>) => void;
  prefectures: Prefecture[];
  grades: GradeInfo[];
}

export default function EmployeeFormFields({ value: d, onChange, prefectures, grades }: Props) {
  return (
    <div className="space-y-6">
      {/* 従業員識別 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">従業員コード</label>
          <input
            type="text"
            value={d.id}
            onChange={(e) => onChange({ id: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">氏名</label>
          <input
            type="text"
            value={d.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 給与形態 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">給与形態</label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => onChange({ salaryType: 'monthly' })}
            className={`flex-1 py-2 px-4 rounded-lg border font-medium transition-colors ${
              d.salaryType === 'monthly'
                ? 'bg-teal-50 border-teal-500 text-teal-700'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            月給
          </button>
          <button
            type="button"
            onClick={() => onChange({ salaryType: 'hourly' })}
            className={`flex-1 py-2 px-4 rounded-lg border font-medium transition-colors ${
              d.salaryType === 'hourly'
                ? 'bg-teal-50 border-teal-500 text-teal-700'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            時給
          </button>
        </div>
      </div>

      {/* 基本給 / 時給 */}
      {d.salaryType === 'monthly' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">基本給（月額）</label>
          <div className="relative">
            <input
              type="number"
              value={d.baseSalary}
              onChange={(e) => onChange({ baseSalary: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <span className="absolute right-4 top-2.5 text-gray-500">円</span>
          </div>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">時給</label>
            <div className="relative">
              <input
                type="number"
                value={d.hourlyWage}
                onChange={(e) => onChange({ hourlyWage: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <span className="absolute right-4 top-2.5 text-gray-500">円</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">総労働時間</label>
            <div className="relative">
              <input
                type="number"
                value={d.totalWorkHours}
                onChange={(e) => onChange({ totalWorkHours: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <span className="absolute right-4 top-2.5 text-gray-500">h/月</span>
            </div>
          </div>
        </>
      )}

      {/* 手当 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">通勤手当（非課税）</label>
          <div className="relative">
            <input
              type="number"
              value={d.commutingAllowance}
              onChange={(e) => onChange({ commutingAllowance: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <span className="absolute right-4 top-2.5 text-gray-500">円</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">所得税は非課税・社会保険の基数には算入</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">出張手当（非課税）</label>
          <div className="relative">
            <input
              type="number"
              value={d.businessTripAllowance}
              onChange={(e) => onChange({ businessTripAllowance: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <span className="absolute right-4 top-2.5 text-gray-500">円</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">実費弁償のため非課税・社会保険の基数にも不算入</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">その他手当</label>
          <div className="relative">
            <input
              type="number"
              value={d.otherAllowances}
              onChange={(e) => onChange({ otherAllowances: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <span className="absolute right-4 top-2.5 text-gray-500">円</span>
          </div>
        </div>
      </div>

      {/* 給与年月・都道府県 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">給与年月（料率の適用月）</label>
          <input
            type="month"
            value={d.salaryMonth}
            onChange={(e) => onChange({ salaryMonth: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">都道府県</label>
          <select
            value={d.prefecture}
            onChange={(e) => onChange({ prefecture: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            {prefectures.map((pref) => (
              <option key={pref.code} value={pref.code}>
                {pref.name_ja}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 年齢・扶養人数 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">年齢</label>
          <input
            type="number"
            value={d.age}
            onChange={(e) => onChange({ age: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            min="15"
            max="100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">扶養人数</label>
          <input
            type="number"
            value={d.dependents}
            onChange={(e) => onChange({ dependents: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            min="0"
          />
        </div>
      </div>

      {/* 社会保険加入 */}
      <div className="flex items-start">
        <input
          type="checkbox"
          id={`enroll-${d.id}`}
          checked={d.enrollInInsurance}
          onChange={(e) => onChange({ enrollInInsurance: e.target.checked })}
          className="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
        />
        <label htmlFor={`enroll-${d.id}`} className="ml-3">
          <span className="block text-sm font-medium text-gray-700">
            健康保険・介護保険・厚生年金に加入する
          </span>
          <span className="block text-xs text-gray-500 mt-1">
            正社員や週30h以上の勤務者は原則加入。雇用保険は週20h以上で自動判定。介護保険は40〜64歳のみ。
          </span>
        </label>
      </div>

      {/* 社保等級（標準報酬月額）の指定 */}
      {d.enrollInInsurance && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            社保等級（標準報酬月額）
          </label>
          <select
            value={d.manualGrade}
            onChange={(e) => onChange({ manualGrade: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">自動判定（今月の総支給額から）</option>
            {grades.map((g) => (
              <option key={g.grade_number} value={g.grade_number}>
                第{g.grade_number}級　標準報酬月額 ¥{g.standard_amount.toLocaleString()}（報酬 {g.min_amount.toLocaleString()}〜
                {g.max_amount >= 9999999 ? '' : g.max_amount.toLocaleString()}円）
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            実務では入社時・定時決定（算定基礎届）・随時改定で決まった等級が使われるため、残業などで今月の支給額が変動しても等級は変わりません。会社で決定済みの等級があればこちらで指定してください。
          </p>
        </div>
      )}

      {/* 住民税（特別徴収） */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">住民税（特別徴収・月額）</label>
          <div className="relative">
            <input
              type="number"
              value={d.residentTax}
              onChange={(e) => onChange({ residentTax: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              min="0"
              placeholder="0"
            />
            <span className="absolute right-4 top-2.5 text-gray-500">円</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            決定通知書の月割額を入力（6月分は端数調整あり）。前年所得なしは空欄
          </p>
        </div>
      </div>

      {/* 残業・欠勤（展開可能） */}
      <div>
        <button
          type="button"
          onClick={() => onChange({ showOvertime: !d.showOvertime })}
          className="text-sm text-teal-600 hover:text-teal-700 font-medium"
        >
          {d.showOvertime ? '▼' : '▶'} 残業・欠勤を追加
        </button>

        {d.showOvertime && (
          <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-200">
            {d.salaryType === 'monthly' && (
              <div className="w-1/2">
                <label className="block text-xs font-medium text-gray-700 mb-1">月所定労働時間</label>
                <div className="relative">
                  <input
                    type="number"
                    value={d.scheduledMonthlyHours}
                    onChange={(e) => onChange({ scheduledMonthlyHours: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    min="1"
                    max="250"
                    step="1"
                  />
                  <span className="absolute right-3 top-2 text-xs text-gray-500">h</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  基準時給・欠勤日割の分母。祝日の多い月は少なめ（例: 5月 152h）
                </p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">残業（×1.25）</label>
                <div className="relative">
                  <input
                    type="number"
                    value={d.overtimeRegular}
                    onChange={(e) => onChange({ overtimeRegular: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    min="0"
                    step="0.5"
                  />
                  <span className="absolute right-3 top-2 text-xs text-gray-500">h</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">休日労働（×1.35）</label>
                <div className="relative">
                  <input
                    type="number"
                    value={d.overtimeHoliday}
                    onChange={(e) => onChange({ overtimeHoliday: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    min="0"
                    step="0.5"
                  />
                  <span className="absolute right-3 top-2 text-xs text-gray-500">h</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">深夜労働（×1.25）</label>
                <div className="relative">
                  <input
                    type="number"
                    value={d.overtimeNight}
                    onChange={(e) => onChange({ overtimeNight: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    min="0"
                    step="0.5"
                  />
                  <span className="absolute right-3 top-2 text-xs text-gray-500">h</span>
                </div>
              </div>
            </div>
            {d.salaryType === 'monthly' && (
              <div className="w-1/3 pr-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">欠勤日数</label>
                <div className="relative">
                  <input
                    type="number"
                    value={d.absenceDays}
                    onChange={(e) => onChange({ absenceDays: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    min="0"
                    step="1"
                  />
                  <span className="absolute right-3 top-2 text-xs text-gray-500">日</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  日割額 = 月給 ÷ 所定{Math.round((Number(d.scheduledMonthlyHours) || 160) / 8)}日（所定時間 ÷ 8h）
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 賞与（今月支給あり） */}
      <div className="border-t pt-4">
        <label className="flex items-start cursor-pointer">
          <input
            type="checkbox"
            checked={d.hasBonus}
            onChange={(e) => onChange({ hasBonus: e.target.checked })}
            className="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
          />
          <span className="ml-3">
            <span className="block text-sm font-medium text-gray-700">今月は賞与（ボーナス）あり</span>
            <span className="block text-xs text-gray-500 mt-1">
              賞与は給与とは別に計算し、別途「賞与明細」を出力します（都道府県・年齢・扶養などは共通）。
            </span>
          </span>
        </label>

        {d.hasBonus && (
          <div className="mt-4 space-y-4 pl-4 border-l-2 border-teal-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">賞与総支給額</label>
                <div className="relative">
                  <input
                    type="number"
                    value={d.bonusAmount}
                    onChange={(e) => onChange({ bonusAmount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <span className="absolute right-4 top-2.5 text-gray-500">円</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">前月の社会保険料控除後の給与額</label>
                <div className="relative">
                  <input
                    type="number"
                    value={d.prevMonthAfterInsurance}
                    onChange={(e) => onChange({ prevMonthAfterInsurance: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <span className="absolute right-4 top-2.5 text-gray-500">円</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">賞与の所得税率の基準。前月の給与がない場合は 0 を入力（特例・月額表）</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">当年度の既払標準賞与額 累計</label>
                <div className="relative">
                  <input
                    type="number"
                    value={d.priorFiscalBonusTotal}
                    onChange={(e) => onChange({ priorFiscalBonusTotal: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    min="0"
                  />
                  <span className="absolute right-3 top-2 text-xs text-gray-500">円</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">健保573万累計上限の判定用</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">賞与計算期間の月数</label>
                <input
                  type="number"
                  value={d.bonusCalcMonths}
                  onChange={(e) => onChange({ bonusCalcMonths: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  min="1"
                  max="12"
                />
                <p className="mt-1 text-xs text-gray-400">特例計算時の除数（6超で12）</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
