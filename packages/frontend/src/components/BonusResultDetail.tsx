import type { BonusCalculationResult } from '../types';

// 賞与の内訳ビュー。多人版の展開行と単一版の下段カードの両方で使う。
// ResultDetail と同じ構成（3列サマリー → 左=支給＋メタ / 右=控除内訳）に合わせ、
// teal の色調とバッジで「給与とは別計算」であることを示す。
interface Props {
  result: BonusCalculationResult;
}

export default function BonusResultDetail({ result }: Props) {
  const d = result.deductions;
  return (
    <div className="p-5 bg-teal-50/40 border-t border-teal-100 space-y-5 text-sm">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 bg-teal-600 text-white rounded text-xs font-bold">賞与</span>
        <p className="font-semibold text-teal-800">給与とは別計算・別明細</p>
      </div>

      {/* 総支給・控除・手取（ResultDetail と同じ3列） */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-gray-600 text-xs">賞与総支給額</p>
          <p className="text-lg font-semibold text-gray-900">¥{result.bonusAmount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-600 text-xs">控除合計</p>
          <p className="text-lg font-semibold text-red-600">-¥{d.total.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-600 text-xs">手取額</p>
          <p className="text-lg font-semibold text-teal-700">¥{result.netBonus.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* 左カラム: 支給内訳 ＋ メタ情報（ResultDetail の料率カードに対応） */}
        <div className="space-y-5">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">支給内訳</h4>
            <div className="flex justify-between items-start">
              <p className="font-medium text-gray-700">賞与</p>
              <p className="font-semibold text-teal-600">+¥{result.bonusAmount.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-teal-50 rounded-lg p-4 space-y-1.5 text-xs border border-teal-100">
            <p className="font-medium text-teal-900">賞与の社会保険・税の基準額</p>
            <div className="text-teal-800 space-y-0.5">
              <p>標準賞与額（1,000円未満切捨て）: ¥{result.standardBonusAmount.toLocaleString()}</p>
              {result.healthStandardBonus !== result.standardBonusAmount && (
                <p className="text-amber-600">
                  健保/介護/子育て対象: ¥{result.healthStandardBonus.toLocaleString()}（年度573万上限適用）
                </p>
              )}
              {result.pensionStandardBonus !== result.standardBonusAmount && (
                <p className="text-amber-600">
                  厚年対象: ¥{result.pensionStandardBonus.toLocaleString()}（1回150万上限適用）
                </p>
              )}
              <p>所得税の計算方法: {result.taxMethod}</p>
            </div>
          </div>
        </div>

        {/* 右カラム: 控除内訳（ResultDetail と同じスタイル） */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">控除内訳（計算過程付）</h4>
          <div className="space-y-3">
            {result.breakdown.deductions.map((item, index) => (
              <div key={index} className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.calculation}</p>
                </div>
                <p className="font-semibold text-red-600 ml-4 whitespace-nowrap">
                  -¥{item.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
