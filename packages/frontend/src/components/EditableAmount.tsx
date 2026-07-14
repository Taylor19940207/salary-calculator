import { formatYen } from '../format';

// 控除内訳の金額を手動調整するための入力欄。
// 既定表示は表の原生値（小数含む）。顧客が各社の労使特約（端数切捨て・四捨五入等）に
// 合わせて上書きでき、空にすると表の値に戻る。
interface Props {
  value: string | undefined; // 上書き文字列（undefined/空 = 表の値を使用）
  raw: number;               // 表の原生値
  onChange: (v: string) => void;
}

export default function EditableAmount({ value, raw, onChange }: Props) {
  const edited = value !== undefined && value.trim() !== '' && Number(value) !== raw;
  return (
    <span className="inline-flex flex-col items-end gap-0.5 ml-4">
      <span className="inline-flex items-center gap-1 font-semibold text-red-600 whitespace-nowrap">
        -¥
        <input
          type="number"
          step="0.01"
          min="0"
          value={value ?? String(raw)}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm font-semibold text-red-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </span>
      {edited && (
        <button
          type="button"
          onClick={() => onChange(String(raw))}
          className="text-[10px] text-gray-400 hover:text-teal-600 whitespace-nowrap"
        >
          表の値 {formatYen(raw)} に戻す
        </button>
      )}
    </span>
  );
}
