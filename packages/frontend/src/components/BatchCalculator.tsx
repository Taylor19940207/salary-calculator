import { Fragment, useEffect, useState } from 'react';
import type { Prefecture, GradeInfo } from '../types';
import { getGrades, calculateBatch, importCsvAndCalculate, exportResultsCsv } from '../api';
import EmployeeFormFields, {
  createEmptyDraft,
  draftToInput,
  type EmployeeDraft,
} from './EmployeeFormFields';
import ResultDetail from './ResultDetail';
import Payslip from './Payslip';
import type { SalaryInput } from '../types';

interface Props {
  prefectures: Prefecture[];
}

interface BatchRow {
  id?: string;
  name?: string;
  input?: SalaryInput;
  result: any;
  error?: string;
}

interface BatchResult {
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalGrossSalary: number;
    totalNetSalary: number;
    totalDeductions: number;
  };
  results: BatchRow[];
}

export default function BatchCalculator({ prefectures }: Props) {
  const [employees, setEmployees] = useState<EmployeeDraft[]>([createEmptyDraft(0)]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvInput, setCsvInput] = useState('');
  const [showCsv, setShowCsv] = useState(false);
  const [grades, setGrades] = useState<GradeInfo[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [payslipFor, setPayslipFor] = useState<BatchRow | null>(null);
  const [companyName, setCompanyName] = useState(''); // 全明細に共通の会社名
  const [paymentDate, setPaymentDate] = useState(''); // 全明細に共通の支給日
  const [periodStart, setPeriodStart] = useState(''); // 全明細に共通の給与計算期間（開始）
  const [periodEnd, setPeriodEnd] = useState('');     // 全明細に共通の給与計算期間（終了）

  useEffect(() => {
    getGrades().then(setGrades).catch(() => setGrades([]));
  }, []);

  const active = employees[activeIdx];

  // アクティブな従業員のフィールドを部分更新
  const updateActive = (patch: Partial<EmployeeDraft>) => {
    setEmployees((prev) => prev.map((emp, i) => (i === activeIdx ? { ...emp, ...patch } : emp)));
  };

  const addEmployee = () => {
    setEmployees((prev) => {
      const next = [...prev, createEmptyDraft(prev.length)];
      setActiveIdx(next.length - 1);
      return next;
    });
  };

  // アクティブな従業員を複製（同一条件で給与だけ変える用途）
  const duplicateEmployee = () => {
    setEmployees((prev) => {
      const src = prev[activeIdx];
      const copy: EmployeeDraft = {
        ...src,
        id: `EMP${prev.length + 1}`,
        name: `${src.name} (コピー)`,
      };
      const next = [...prev, copy];
      setActiveIdx(next.length - 1);
      return next;
    });
  };

  const removeEmployee = (index: number) => {
    setEmployees((prev) => {
      if (prev.length === 1) return prev; // 最低 1 名は残す
      const next = prev.filter((_, i) => i !== index);
      setActiveIdx((cur) => {
        if (index < cur) return cur - 1;
        if (index === cur) return Math.min(cur, next.length - 1);
        return cur;
      });
      return next;
    });
  };

  // 送信前の入力チェック。問題があれば該当タブと理由を返す。
  const findInvalid = (): { index: number; reason: string } | null => {
    for (let i = 0; i < employees.length; i++) {
      const d = employees[i];
      const who = d.name || d.id || `従業員 ${i + 1}`;
      const age = Number(d.age);
      if (!Number.isFinite(age) || age < 15 || age > 100) {
        return { index: i, reason: `${who}：年齢は 15〜100 で入力してください（現在: ${d.age || '空欄'}）` };
      }
      if (!/^\d{4}-\d{2}$/.test(d.salaryMonth)) {
        return { index: i, reason: `${who}：給与年月を選択してください` };
      }
      if (Number(d.dependents) < 0 || !Number.isFinite(Number(d.dependents))) {
        return { index: i, reason: `${who}：扶養人数が不正です` };
      }
      if (d.salaryType === 'monthly' && !(Number(d.baseSalary) > 0)) {
        return { index: i, reason: `${who}：基本給を入力してください` };
      }
      if (d.salaryType === 'hourly' && !(Number(d.hourlyWage) > 0)) {
        return { index: i, reason: `${who}：時給を入力してください` };
      }
      if (d.showOvertime && d.salaryType === 'monthly') {
        const h = Number(d.scheduledMonthlyHours);
        if (h && (h < 1 || h > 250)) {
          return { index: i, reason: `${who}：月所定労働時間は 1〜250 の範囲で入力してください` };
        }
      }
    }
    return null;
  };

  const handleBatchCalculate = async () => {
    const invalid = findInvalid();
    if (invalid) {
      setActiveIdx(invalid.index);
      setError(invalid.reason);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const inputs = employees.map(draftToInput);
      const data = await calculateBatch(inputs);
      setResult(data);
      setExpandedRow(null);
    } catch (err) {
      console.error('Batch calculation failed:', err);
      setError('批量計算に失敗しました。入力内容を確認してください。');
    } finally {
      setLoading(false);
    }
  };

  const handleCSVImport = async () => {
    if (!csvInput.trim()) {
      setError('CSV データを入力してください');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await importCsvAndCalculate(csvInput);
      setResult(data);
      setExpandedRow(null);
    } catch (err) {
      console.error('CSV import failed:', err);
      setError('CSV 取り込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCSVExport = async () => {
    if (!result) {
      setError('先に計算を実行してください');
      return;
    }
    try {
      const blob = await exportResultsCsv(result.results);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salary_results_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed:', err);
      setError('CSV 出力に失敗しました');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">複数人の給与計算</h2>

      {/* 会社名・支給日・給与計算期間（全従業員の明細に共通・ここで一度だけ入力） */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3">
          <label htmlFor="batch-company" className="text-sm font-medium text-gray-700 whitespace-nowrap w-24">
            会社名
          </label>
          <input
            id="batch-company"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="株式会社サンプル"
            className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label htmlFor="batch-payday" className="text-sm font-medium text-gray-700 whitespace-nowrap w-24">
            支給日
          </label>
          <input
            id="batch-payday"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap ml-2">
            給与計算期間
          </label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <span>〜</span>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <p className="text-xs text-gray-400">会社名・支給日・給与計算期間は全員の給与明細に共通で表示されます（期間は空欄なら給与月の前月1日〜末日）</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* タブ列（横スクロール可能） */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <div className="flex-1 flex gap-1 overflow-x-auto pb-px">
          {employees.map((emp, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`group flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-t-lg border border-b-0 text-sm ${
                i === activeIdx
                  ? 'bg-white border-gray-300 text-green-700 font-medium -mb-px'
                  : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{emp.name || emp.id || `従業員 ${i + 1}`}</span>
              {employees.length > 1 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEmployee(i);
                  }}
                  className="text-gray-400 hover:text-red-600 cursor-pointer"
                  aria-label="削除"
                >
                  ✕
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={addEmployee}
          className="shrink-0 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          ＋ 従業員を追加
        </button>
        <button
          onClick={duplicateEmployee}
          className="shrink-0 px-3 py-2 text-sm bg-white border border-green-600 text-green-700 rounded-lg hover:bg-green-50"
        >
          ⧉ この従業員を複製
        </button>
      </div>

      {/* アクティブな従業員のフォーム */}
      {active && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <EmployeeFormFields
            value={active}
            onChange={updateActive}
            prefectures={prefectures}
            grades={grades}
          />
        </div>
      )}

      {/* 全員計算 */}
      <button
        onClick={handleBatchCalculate}
        disabled={loading || employees.length === 0}
        className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400"
      >
        {loading ? '計算中...' : `全員を計算（${employees.length} 名）`}
      </button>

      {/* CSV 取り込み（折りたたみ） */}
      <div className="border-t pt-4">
        <button
          type="button"
          onClick={() => setShowCsv(!showCsv)}
          className="text-sm text-green-600 hover:text-green-700 font-medium"
        >
          {showCsv ? '▼' : '▶'} CSV でまとめて取り込む
        </button>
        {showCsv && (
          <div className="mt-3">
            <textarea
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              placeholder={'貼り付け形式：員工編號,姓名,基本給,通勤手当,都道府県,給与年月,年齢,扶養人数'}
              className="w-full h-32 px-3 py-2 border rounded-lg text-sm font-mono"
            />
            <button
              onClick={handleCSVImport}
              disabled={loading}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              CSV を取り込んで計算
            </button>
            <p className="mt-1 text-xs text-gray-400">
              CSV 経由の計算は上のタブ入力とは別に、貼り付けた行がそのまま計算されます。
            </p>
          </div>
        )}
      </div>

      {/* 結果 */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">計算中...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-green-400 to-green-500 p-6 rounded-lg text-white">
            <h2 className="text-lg font-semibold mb-4">集計サマリー</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm opacity-90">総人数</p>
                <p className="text-2xl font-bold">{result.summary.total} 名</p>
              </div>
              <div>
                <p className="text-sm opacity-90">成功 / 失敗</p>
                <p className="text-2xl font-bold">
                  {result.summary.successful} / {result.summary.failed}
                </p>
              </div>
              <div>
                <p className="text-sm opacity-90">総支給額</p>
                <p className="text-xl font-bold">¥{result.summary.totalGrossSalary.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm opacity-90">総手取額</p>
                <p className="text-xl font-bold">¥{result.summary.totalNetSalary.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleCSVExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            📥 CSV 出力
          </button>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <h3 className="font-semibold">明細一覧</h3>
            </div>
            <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">明細</th>
                    <th className="px-4 py-2 text-left w-8"></th>
                    <th className="px-4 py-2 text-left">従業員</th>
                    <th className="px-4 py-2 text-right">総支給</th>
                    <th className="px-4 py-2 text-right">控除</th>
                    <th className="px-4 py-2 text-right">手取</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r, index) => {
                    const expandable = !r.error;
                    const isOpen = expandedRow === index;
                    return (
                      <Fragment key={index}>
                        <tr
                          onClick={() => expandable && setExpandedRow(isOpen ? null : index)}
                          className={`border-b ${expandable ? 'hover:bg-green-50 cursor-pointer' : ''} ${
                            isOpen ? 'bg-green-50' : ''
                          }`}
                        >
                          <td className="px-3 py-2">
                            {!r.error && r.input && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPayslipFor(r);
                                }}
                                className="px-2.5 py-1 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700 whitespace-nowrap"
                              >
                                 出力
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-400">
                            {expandable && (
                              <span className={`inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                                ▶
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="font-medium">{r.name || r.id}</div>
                            {r.error && <div className="text-xs text-red-600">{r.error}</div>}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {r.error ? '-' : `¥${r.result.grossSalary.toLocaleString()}`}
                          </td>
                          <td className="px-4 py-2 text-right text-red-600">
                            {r.error ? '-' : `-¥${r.result.deductions.total.toLocaleString()}`}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">
                            {r.error ? '-' : `¥${r.result.netSalary.toLocaleString()}`}
                          </td>
                        </tr>
                        {isOpen && expandable && (
                          <tr>
                            <td colSpan={6} className="p-0 border-b">
                              <ResultDetail result={r.result} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 給与明細の出力（1 名ずつ・従業員名を事前設定） */}
      {payslipFor && payslipFor.input && (
        <Payslip
          result={payslipFor.result}
          input={payslipFor.input}
          onClose={() => setPayslipFor(null)}
          defaultCompanyName={companyName || undefined}
          defaultEmployeeName={payslipFor.name || ''}
          defaultEmployeeNo={payslipFor.id || ''}
          defaultPaymentDate={paymentDate || undefined}
          defaultPeriodStart={periodStart || undefined}
          defaultPeriodEnd={periodEnd || undefined}
        />
      )}
    </div>
  );
}
