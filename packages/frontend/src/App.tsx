import { useState, useEffect } from 'react';
import SalaryForm from './components/SalaryForm';
import SalaryResult from './components/SalaryResult';
import BatchCalculator from './components/BatchCalculator';
import BonusResult from './components/BonusResult';
import { calculateSalary, calculateBonus, getPrefectures } from './api';
import type {
  SalaryInput,
  SalaryCalculationResult,
  BonusInput,
  BonusCalculationResult,
  Prefecture,
} from './types';
import type { DeductionOverrides } from './format';

function App() {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [result, setResult] = useState<SalaryCalculationResult | null>(null);
  const [lastInput, setLastInput] = useState<SalaryInput | null>(null);
  const [bonusResult, setBonusResult] = useState<BonusCalculationResult | null>(null);
  const [bonusInput, setBonusInput] = useState<BonusInput | null>(null);
  // 健保・介護・子育て支援金の表示金額の手動調整（表の原生小数値が既定。
  // 各社の労使特約に合わせて顧客が上書きし、画面・PDF・CSVすべてに反映される）
  const [salaryOverrides, setSalaryOverrides] = useState<DeductionOverrides>({});
  const [bonusOverrides, setBonusOverrides] = useState<DeductionOverrides>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefectures, setPrefectures] = useState<Prefecture[]>([]);

  useEffect(() => {
    // 初期化: 都道府県一覧取得
    getPrefectures()
      .then(setPrefectures)
      .catch((err) => {
        console.error('Failed to load prefectures:', err);
        setError('都道府県データの読み込みに失敗しました');
      });
  }, []);

  const handleCalculate = async (input: SalaryInput, bonus?: BonusInput) => {
    setLoading(true);
    setError(null);
    try {
      // 給与と賞与は別計算。賞与ありなら並行して両方計算する
      const [calculationResult, bonusCalculationResult] = await Promise.all([
        calculateSalary(input),
        bonus ? calculateBonus(bonus) : Promise.resolve(null),
      ]);
      setResult(calculationResult);
      setLastInput(input);
      setBonusResult(bonusCalculationResult);
      setBonusInput(bonus ?? null);
      // 再計算したら手動調整はリセット（前回の上書きが新しい結果に紛れ込まないように）
      setSalaryOverrides({});
      setBonusOverrides({});
    } catch (err) {
      console.error('Calculation error:', err);
      setError('計算中にエラーが発生しました。入力内容を確認してください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                日本給与手取り計算ツール
              </h1>
              <p className="mt-1 sm:mt-2 text-sm text-gray-600">
                令和8年対応・紙の税額表に合わせて手取り額を確認
              </p>
            </div>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setMode('single')}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'single'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                単一計算
              </button>
              <button
                onClick={() => setMode('batch')}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'batch'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                複数人計算
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {mode === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <SalaryForm
                onCalculate={handleCalculate}
                loading={loading}
                prefectures={prefectures}
              />
            </div>

            <div className="space-y-8">
              {result && (
                <SalaryResult
                  result={result}
                  input={lastInput}
                  bonusResult={bonusResult}
                  bonusInput={bonusInput}
                  overrides={salaryOverrides}
                  onChangeOverrides={setSalaryOverrides}
                  bonusOverrides={bonusOverrides}
                />
              )}
              {bonusResult && (
                <BonusResult
                  result={bonusResult}
                  overrides={bonusOverrides}
                  onChangeOverrides={setBonusOverrides}
                />
              )}
              {!result && !loading && (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
                  左側のフォームに入力して「計算する」をクリックしてください
                </div>
              )}
              {loading && (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">計算中...</p>
                </div>
              )}
            </div>
          </div>
        )}
        {mode === 'batch' && <BatchCalculator prefectures={prefectures} />}

        <footer className="mt-12 pt-8 border-t text-center text-sm text-gray-600">
          <p>
            ※ 本ツールは社内確認用です。実際の給与計算では会社の決定等級・自治体の通知書をご確認ください。
          </p>
          <p className="mt-2">
            データソース: 協会けんぽ、日本年金機構、厚生労働省
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
