import { useState } from 'react';
import type { SalaryInput, SalaryCalculationResult, BonusInput, BonusCalculationResult } from '../types';
import Payslip from './Payslip';
import EditableAmount from './EditableAmount';
import { formatYen, mergedSalaryDeductions, LABEL_TO_FIELD, type DeductionOverrides } from '../format';

interface Props {
  result: SalaryCalculationResult;
  input: SalaryInput | null;
  // 賞与あり: 明細出力を給与＋賞与の2ページ1ファイルにする
  bonusResult?: BonusCalculationResult | null;
  bonusInput?: BonusInput | null;
  // 健保・介護・子育て支援金の金額の手動調整（表の原生小数値が既定）
  overrides: DeductionOverrides;
  onChangeOverrides: (ov: DeductionOverrides) => void;
  bonusOverrides: DeductionOverrides;
}

export default function SalaryResult({
  result,
  input,
  bonusResult,
  bonusInput,
  overrides,
  onChangeOverrides,
  bonusOverrides,
}: Props) {
  const [showPayslip, setShowPayslip] = useState(false);
  const hasBonus = !!(bonusResult && bonusInput);
  // 手動調整を反映した控除額・合計・手取（画面・PDF・CSVすべてこの値で統一）
  const merged = mergedSalaryDeductions(result, overrides);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* 手取額 */}
      <div className="border-b border-teal-100 bg-teal-50 p-8">
        <div className="flex flex-wrap justify-between items-start gap-2">
          <h2 className="text-lg font-semibold text-teal-950 mb-2">手取り額</h2>
          {input && (
            <button
              onClick={() => setShowPayslip(true)}
              className="px-3.5 py-2 bg-white hover:bg-teal-100 border border-teal-300 rounded-lg text-sm font-semibold text-teal-800 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            >
              {hasBonus ? '給与・賞与明細を出力' : '給与明細を出力'}
            </button>
          )}
        </div>
        <p className="text-4xl sm:text-5xl font-bold tabular-nums text-teal-900">
          ¥{formatYen(merged.netSalary)}
        </p>
      </div>

      {showPayslip && input && (
        <Payslip
          result={result}
          input={input}
          onClose={() => setShowPayslip(false)}
          bonusResult={bonusResult ?? undefined}
          bonusInput={bonusInput ?? undefined}
          overrides={overrides}
          bonusOverrides={bonusOverrides}
        />
      )}

      <div className="p-6 space-y-6">
        {/* サマリー */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">総支給額</p>
            <p className="text-xl font-semibold text-gray-900">
              ¥{result.grossSalary.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-600">控除合計</p>
            <p className="text-xl font-semibold text-red-600">
              -¥{formatYen(merged.total)}
            </p>
          </div>
        </div>

        <hr />

        {/* 支給内訳 */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">
            支給内訳（計算過程付）
          </h3>
          <div className="space-y-2">
            {result.breakdown.income.map((item, index) => (
              <div key={index} className="flex justify-between items-start text-sm">
                <div>
                  <p className="font-medium text-gray-700">{item.label}</p>
                  {item.description && (
                    <p className="text-xs text-gray-500">{item.description}</p>
                  )}
                </div>
                <p className={`font-semibold ${item.amount < 0 ? 'text-red-600' : 'text-teal-600'}`}>
                  {item.amount < 0 ? '-' : '+'}¥{Math.abs(item.amount).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        <hr />

        {/* 控除内訳 */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">
            控除内訳（計算過程付）
          </h3>
          <div className="space-y-3">
            {result.breakdown.deductions.map((item, index) => {
              // 健保・介護・子育ては表の原生値（小数）を表示し、手動調整できる
              const field = LABEL_TO_FIELD[item.label];
              return (
              <div key={index} className="space-y-1">
                <div className="flex justify-between items-start text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-gray-700">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.calculation}</p>
                  </div>
                  {field ? (
                    <EditableAmount
                      value={overrides[field]}
                      raw={item.rawAmount}
                      onChange={(v) => onChangeOverrides({ ...overrides, [field]: v })}
                    />
                  ) : (
                    <p className="font-semibold text-red-600 ml-4">
                      -¥{formatYen(item.amount)}
                    </p>
                  )}
                </div>
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center"
                  >
                    保険料率表 →
                  </a>
                )}
              </div>
              );
            })}
            <p className="text-xs text-gray-500 pt-1 border-t border-gray-100">
              健康保険・介護保険・子育て支援金は保険料額表の原生値を表示。端数（小数）がある項目は
              <span className="px-1 bg-amber-50 border border-amber-300 rounded">淡黄色</span>
              で表示され、各社の端数処理に合わせて金額を直接編集できます（整数に調整すると色が消え、合計・PDF・CSVに反映）。
            </p>
          </div>
        </div>

        <hr />

        {/* メタ情報 */}
        <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-xs">
          <p className="font-medium text-blue-900">
            ※ 本計算は {result.ratesUsed.effectiveDate} 版費率を使用
          </p>
          <div className="text-blue-700 space-y-0.5">
            <p>
              標準報酬月額（健康保険）: ¥{result.standardMonthlyRemuneration.toLocaleString()}
              {result.grades?.health !== null && result.grades?.health !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 rounded text-blue-800 font-medium">
                  第{result.grades.health}級
                </span>
              )}
            </p>
            <p>
              標準報酬月額（厚生年金）: ¥{result.grades?.pensionStandardAmount?.toLocaleString() ?? result.standardMonthlyRemuneration.toLocaleString()}
              {result.grades?.pension !== null && result.grades?.pension !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 rounded text-blue-800 font-medium">
                  第{result.grades.pension}級
                </span>
              )}
              {result.grades?.pensionStandardAmount !== undefined &&
                result.grades.pensionStandardAmount !== result.standardMonthlyRemuneration && (
                <span className="ml-1 text-blue-500">
                  （{result.grades.pensionStandardAmount < result.standardMonthlyRemuneration ? '上限' : '下限'}適用）
                </span>
              )}
            </p>
          </div>
          <div className="text-blue-700 space-y-1">
            <p>使用料率:</p>
            <table className="ml-4 w-full max-w-xs">
              <thead>
                <tr className="text-left text-blue-500">
                  <th className="font-normal pb-1"></th>
                  <th className="font-normal pb-1 text-right">総料率</th>
                  <th className="font-normal pb-1 text-right">労働者負担</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>健康保険</td>
                  <td className="text-right">{result.ratesUsed.healthInsurance.total}%</td>
                  <td className="text-right">{result.ratesUsed.healthInsurance.employee}%</td>
                </tr>
                {result.ratesUsed.nursingCare.employee > 0 && (
                  <tr>
                    <td>介護保険</td>
                    <td className="text-right">{result.ratesUsed.nursingCare.total}%</td>
                    <td className="text-right">{result.ratesUsed.nursingCare.employee}%</td>
                  </tr>
                )}
                <tr>
                  <td>厚生年金</td>
                  <td className="text-right">{result.ratesUsed.employeePension.total}%</td>
                  <td className="text-right">{result.ratesUsed.employeePension.employee}%</td>
                </tr>
                <tr>
                  <td>雇用保険</td>
                  <td className="text-right">{result.ratesUsed.unemployment.total}%</td>
                  <td className="text-right">{result.ratesUsed.unemployment.employee}%</td>
                </tr>
                <tr>
                  <td>子育支援金</td>
                  <td className="text-right">{result.ratesUsed.childSupport.total}%</td>
                  <td className="text-right">{result.ratesUsed.childSupport.employee}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-blue-600 text-xs">
            データソース: 協会けんぽ、厚生労働省、日本年金機構
          </p>
        </div>
      </div>
    </div>
  );
}
