import type { BonusCalculationResult } from '../types';
import BonusResultDetail from './BonusResultDetail';

interface Props {
  result: BonusCalculationResult;
}

// 単一計算の下段カード。内訳は多人版と同じ BonusResultDetail を使い、見た目を統一する。
// 明細の出力は上の給与カードの「給与・賞与明細を出力」から給与と1ファイル2ページで行う。
export default function BonusResult({ result }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="flex justify-between items-center px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-900">賞与 手取り額</h2>
        <p className="text-3xl font-bold text-teal-600">¥{result.netBonus.toLocaleString()}</p>
      </div>

      <BonusResultDetail result={result} />

      <p className="px-5 py-3 border-t border-teal-100 text-xs text-gray-500">
        📄 賞与明細の出力は上の「給与・賞与明細を出力」から（給与＋賞与を1ファイル2ページで印刷）
      </p>
    </div>
  );
}
