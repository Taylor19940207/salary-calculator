import type { SalaryCalculationResult } from '../types';
import EditableAmount from './EditableAmount';
import { formatYen, mergedSalaryDeductions, LABEL_TO_FIELD, type DeductionOverrides } from '../format';

// 複数人版の明細行を展開したときに表示する内訳ビュー。
// 単人版 SalaryResult の内訳部分と同じ内容（ヒーロー部を除く）。
// 健保・介護・子育ては表の丸め前の金額（小数）を表示し、手動調整できる。
interface Props {
  result: SalaryCalculationResult;
  overrides: DeductionOverrides;
  onChangeOverrides: (ov: DeductionOverrides) => void;
}

export default function ResultDetail({ result, overrides, onChangeOverrides }: Props) {
  const merged = mergedSalaryDeductions(result, overrides);
  return (
    <div className="p-5 bg-gray-50 space-y-5 text-sm">
      {/* 総支給・控除・手取 */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-gray-600 text-xs">総支給額</p>
          <p className="text-lg font-semibold text-gray-900">¥{result.grossSalary.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-600 text-xs">控除合計</p>
          <p className="text-lg font-semibold text-red-600">-¥{formatYen(merged.total)}</p>
        </div>
        <div>
          <p className="text-gray-600 text-xs">手取額</p>
          <p className="text-lg font-semibold text-teal-600">¥{formatYen(merged.netSalary)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* 左カラム: 支給内訳 ＋ メタ情報（下の余白を活用） */}
        <div className="space-y-5">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">支給内訳（計算過程付）</h4>
            <div className="space-y-2">
              {result.breakdown.income.map((item, index) => (
                <div key={index} className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-700">{item.label}</p>
                    {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                  </div>
                  <p className={`font-semibold ${item.amount < 0 ? 'text-red-600' : 'text-teal-600'}`}>
                    {item.amount < 0 ? '-' : '+'}¥{Math.abs(item.amount).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* メタ情報（等級・料率）— 左カラム下部の余白に配置 */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-xs">
            <p className="font-medium text-blue-900">
              ※ 本計算は {result.ratesUsed.effectiveDate} 版の料率を使用
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
                標準報酬月額（厚生年金）: ¥
                {result.grades?.pensionStandardAmount?.toLocaleString() ?? result.standardMonthlyRemuneration.toLocaleString()}
                {result.grades?.pension !== null && result.grades?.pension !== undefined && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-100 rounded text-blue-800 font-medium">
                    第{result.grades.pension}級
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
                    <td>子育て支援金</td>
                    <td className="text-right">{result.ratesUsed.childSupport.total}%</td>
                    <td className="text-right">{result.ratesUsed.childSupport.employee}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 右カラム: 控除内訳 */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">控除内訳（計算過程付）</h4>
          <div className="space-y-3">
            {result.breakdown.deductions.map((item, index) => {
              const field = LABEL_TO_FIELD[item.label];
              return (
              <div key={index} className="space-y-1">
                <div className="flex justify-between items-start">
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
                    <p className="font-semibold text-red-600 ml-4">-¥{formatYen(item.amount)}</p>
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
              端数（小数）がある項目は
              <span className="px-1 bg-amber-50 border border-amber-300 rounded">薄い黄色</span>
              で表示され、金額を直接編集できます（整数に調整すると色が消え、合計・PDF・CSVに反映）。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
