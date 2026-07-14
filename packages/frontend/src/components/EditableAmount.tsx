import { formatYen } from '../format';

// 控除内訳の金額表示。
// - 表の値が整数のとき: 端数処理は不要なので通常の固定表示（編集不可）
// - 表の値に端数（小数）があるとき: 編集可能な入力欄にし、淡い黄色で「端数が未処理」であることを示す。
//   顧客が各社の労使特約（切捨て・四捨五入等）に合わせて整数に調整すると色が消える。
//   空にする・無効な値にすると表の値に戻る。
interface Props {
  value: string | undefined; // 上書き文字列（undefined/空 = 表の値を使用）
  raw: number;               // 表の原生値
  onChange: (v: string) => void;
}

export default function EditableAmount({ value, raw, onChange }: Props) {
  // 表の値が整数なら編集の必要がない → 他項目と同じ固定表示
  if (Number.isInteger(raw)) {
    return (
      <p className="font-semibold text-red-600 ml-4 whitespace-nowrap">-¥{formatYen(raw)}</p>
    );
  }

  // 現在の有効値（無効・空入力は表の値にフォールバック。format.ts の resolve と同じ規則）
  const n = value !== undefined && value.trim() !== '' ? Number(value) : NaN;
  const effective = Number.isFinite(n) && n >= 0 ? n : raw;
  // 端数が残っている間は淡黄色でハイライト（＝要処理のサイン）。整数に調整されたら消える
  const pending = !Number.isInteger(effective);
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
          title={pending ? '端数（小数）が未処理です。各社の端数処理に合わせて調整してください' : undefined}
          className={`w-28 px-2 py-1 border rounded text-right text-sm font-semibold text-red-600 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors ${
            pending ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-300'
          }`}
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
