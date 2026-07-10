import { useEffect, useState } from 'react';
import { getGrades } from '../api';
import type { SalaryInput, Prefecture, GradeInfo } from '../types';

interface Props {
  onCalculate: (input: SalaryInput) => void;
  loading: boolean;
  prefectures: Prefecture[];
}

export default function SalaryForm({ onCalculate, loading, prefectures }: Props) {
  const [salaryType, setSalaryType] = useState<'monthly' | 'hourly'>('monthly');
  const [baseSalary, setBaseSalary] = useState('300000');
  const [hourlyWage, setHourlyWage] = useState('1500');
  const [totalWorkHours, setTotalWorkHours] = useState('160');
  const [commutingAllowance, setCommutingAllowance] = useState('10000');
  const [businessTripAllowance, setBusinessTripAllowance] = useState('0');
  const [otherAllowances, setOtherAllowances] = useState('0');
  const [prefecture, setPrefecture] = useState('13'); // 東京都
  const [salaryMonth, setSalaryMonth] = useState('2026-05');
  const [age, setAge] = useState('35');
  const [dependents, setDependents] = useState('0');
  const [enrollInInsurance, setEnrollInInsurance] = useState(true);
  const [showOvertime, setShowOvertime] = useState(false);
  const [overtimeRegular, setOvertimeRegular] = useState('0');
  const [overtimeHoliday, setOvertimeHoliday] = useState('0');
  const [overtimeNight, setOvertimeNight] = useState('0');
  const [absenceDays, setAbsenceDays] = useState('0');
  const [scheduledMonthlyHours, setScheduledMonthlyHours] = useState('160');
  const [manualGrade, setManualGrade] = useState(''); // '' = 自動判定
  const [grades, setGrades] = useState<GradeInfo[]>([]);

  useEffect(() => {
    getGrades().then(setGrades).catch(() => setGrades([]));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const input: SalaryInput = {
      salaryType,
      baseSalary: salaryType === 'monthly' ? Number(baseSalary) : undefined,
      hourlyWage: salaryType === 'hourly' ? Number(hourlyWage) : undefined,
      totalWorkHours: salaryType === 'hourly' ? Number(totalWorkHours) : undefined,
      commutingAllowance: Number(commutingAllowance),
      businessTripAllowance: Number(businessTripAllowance) || undefined,
      otherAllowances: Number(otherAllowances),
      prefecture,
      salaryMonth,
      age: Number(age),
      dependents: Number(dependents),
      enrollInInsurance,
      manualGrade: manualGrade ? Number(manualGrade) : undefined,
    };

    if (showOvertime) {
      input.overtime = {
        regular: Number(overtimeRegular),
        holiday: Number(overtimeHoliday),
        night: Number(overtimeNight),
      };
      input.absenceDays = Number(absenceDays);
      input.scheduledMonthlyHours = Number(scheduledMonthlyHours) || 160;
    }

    onCalculate(input);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-6">入力</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 給与形態 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            給与形態
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setSalaryType('monthly')}
              className={`flex-1 py-2 px-4 rounded-lg border ${
                salaryType === 'monthly'
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              月給
            </button>
            <button
              type="button"
              onClick={() => setSalaryType('hourly')}
              className={`flex-1 py-2 px-4 rounded-lg border ${
                salaryType === 'hourly'
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              時給
            </button>
          </div>
        </div>

        {/* 基本給 / 時給 */}
        {salaryType === 'monthly' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              基本給（月額）
            </label>
            <div className="relative">
              <input
                type="number"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
              <span className="absolute right-4 top-2.5 text-gray-500">円</span>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                時給
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={hourlyWage}
                  onChange={(e) => setHourlyWage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
                <span className="absolute right-4 top-2.5 text-gray-500">円</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                総労働時間
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={totalWorkHours}
                  onChange={(e) => setTotalWorkHours(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
                <span className="absolute right-4 top-2.5 text-gray-500">h/月</span>
              </div>
            </div>
          </>
        )}

        {/* 手当 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              通勤手当（非課税）
            </label>
            <div className="relative">
              <input
                type="number"
                value={commutingAllowance}
                onChange={(e) => setCommutingAllowance(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <span className="absolute right-4 top-2.5 text-gray-500">円</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">所得税は非課税・社会保険の基数には算入</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              出張手当（非課税）
            </label>
            <div className="relative">
              <input
                type="number"
                value={businessTripAllowance}
                onChange={(e) => setBusinessTripAllowance(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <span className="absolute right-4 top-2.5 text-gray-500">円</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">実費弁償のため非課税・社会保険の基数にも不算入</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              その他手当
            </label>
            <div className="relative">
              <input
                type="number"
                value={otherAllowances}
                onChange={(e) => setOtherAllowances(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <span className="absolute right-4 top-2.5 text-gray-500">円</span>
            </div>
          </div>
        </div>

        {/* 給与年月・都道府県 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              給与年月（料率の適用月）
            </label>
            <input
              type="month"
              value={salaryMonth}
              onChange={(e) => setSalaryMonth(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              都道府県
            </label>
            <select
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              年齢
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
              min="15"
              max="100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              扶養人数
            </label>
            <input
              type="number"
              value={dependents}
              onChange={(e) => setDependents(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
              min="0"
            />
          </div>
        </div>

        {/* 社会保険加入 */}
        <div className="flex items-start">
          <input
            type="checkbox"
            id="enrollInInsurance"
            checked={enrollInInsurance}
            onChange={(e) => setEnrollInInsurance(e.target.checked)}
            className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
          />
          <label htmlFor="enrollInInsurance" className="ml-3">
            <span className="block text-sm font-medium text-gray-700">
              健康保険・介護保険・厚生年金に加入する
            </span>
            <span className="block text-xs text-gray-500 mt-1">
              正社員や週30h以上の勤務者は原則加入。雇用保険は週20h以上で自動判定。介護保険は40〜64歳のみ。
            </span>
          </label>
        </div>

        {/* 社保等級（標準報酬月額）の指定 */}
        {enrollInInsurance && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              社保等級（標準報酬月額）
            </label>
            <select
              value={manualGrade}
              onChange={(e) => setManualGrade(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">自動判定（今月の総支給額から）</option>
              {grades.map((g) => (
                <option key={g.grade_number} value={g.grade_number}>
                  第{g.grade_number}級　標準報酬月額 ¥{g.standard_amount.toLocaleString()}（報酬 {g.min_amount.toLocaleString()}〜{g.max_amount >= 9999999 ? '' : g.max_amount.toLocaleString()}円）
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              実務では入社時・定時決定（算定基礎届）・随時改定で決まった等級が使われるため、残業などで今月の支給額が変動しても等級は変わりません。会社で決定済みの等級があればこちらで指定してください。
            </p>
          </div>
        )}

        {/* 残業・欠勤（展開可能） */}
        <div>
          <button
            type="button"
            onClick={() => setShowOvertime(!showOvertime)}
            className="text-sm text-green-600 hover:text-green-700 font-medium"
          >
            {showOvertime ? '▼' : '▶'} 残業・欠勤を追加
          </button>

          {showOvertime && (
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-200">
              {salaryType === 'monthly' && (
                <div className="w-1/2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    月所定労働時間
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={scheduledMonthlyHours}
                      onChange={(e) => setScheduledMonthlyHours(e.target.value)}
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    残業（×1.25）
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={overtimeRegular}
                      onChange={(e) => setOvertimeRegular(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      min="0"
                      step="0.5"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-500">h</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    休日労働（×1.35）
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={overtimeHoliday}
                      onChange={(e) => setOvertimeHoliday(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      min="0"
                      step="0.5"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-500">h</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    深夜労働（×1.25）
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={overtimeNight}
                      onChange={(e) => setOvertimeNight(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      min="0"
                      step="0.5"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-500">h</span>
                  </div>
                </div>
              </div>
              {salaryType === 'monthly' && (
                <div className="w-1/3 pr-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    欠勤日数
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={absenceDays}
                      onChange={(e) => setAbsenceDays(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      min="0"
                      step="1"
                    />
                    <span className="absolute right-3 top-2 text-xs text-gray-500">日</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    日割額 = 月給 ÷ 所定{Math.round((Number(scheduledMonthlyHours) || 160) / 8)}日（所定時間 ÷ 8h）
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '計算中...' : '計算する'}
        </button>
      </form>
    </div>
  );
}
