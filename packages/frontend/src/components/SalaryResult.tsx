import { useState } from 'react';
import type { SalaryInput, SalaryCalculationResult, BonusInput, BonusCalculationResult } from '../types';
import Payslip from './Payslip';

interface Props {
  result: SalaryCalculationResult;
  input: SalaryInput | null;
  // 賞与あり: 明細出力を給与＋賞与の2ページ1ファイルにする
  bonusResult?: BonusCalculationResult | null;
  bonusInput?: BonusInput | null;
}

export default function SalaryResult({ result, input, bonusResult, bonusInput }: Props) {
  const [showPayslip, setShowPayslip] = useState(false);
  const hasBonus = !!(bonusResult && bonusInput);

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* 手取額 */}
      <div className="bg-gradient-to-r from-teal-400 to-teal-500 p-8 text-white">
        <div className="flex justify-between items-start">
          <h2 className="text-lg font-medium mb-2">手取り額</h2>
          {input && (
            <button
              onClick={() => setShowPayslip(true)}
              className="px-3.5 py-2 bg-white/15 hover:bg-white/25 border border-white/40 rounded-lg text-sm font-semibold backdrop-blur transition-colors"
            >
              {hasBonus ? '給与・賞与明細を出力' : '給与明細を出力'}
            </button>
          )}
        </div>
        <p className="text-5xl font-bold">
          ¥{result.netSalary.toLocaleString()}
        </p>
      </div>

      {showPayslip && input && (
        <Payslip
          result={result}
          input={input}
          onClose={() => setShowPayslip(false)}
          bonusResult={bonusResult ?? undefined}
          bonusInput={bonusInput ?? undefined}
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
              -¥{result.deductions.total.toLocaleString()}
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
            {result.breakdown.deductions.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between items-start text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-gray-700">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.calculation}</p>
                  </div>
                  <p className="font-semibold text-red-600 ml-4">
                    -¥{item.amount.toLocaleString()}
                  </p>
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
            ))}
          </div>
        </div>

        <hr />

        {/* メタ情報 */}
        <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-xs">
          <p className="font-medium text-blue-900">
            ※ 本次計算使用 {result.ratesUsed.effectiveDate} 版費率
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
            データ来源: 協会けんぽ、厚生労働省、日本年金機構
          </p>
        </div>
      </div>
    </div>
  );
}
