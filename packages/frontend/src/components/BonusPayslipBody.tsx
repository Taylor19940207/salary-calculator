import { Fragment } from 'react';
import type { BonusInput, BonusCalculationResult } from '../types';
import { formatYen, mergedBonusDeductions, type DeductionOverrides } from '../format';

interface Props {
  result: BonusCalculationResult;
  input: BonusInput;
  companyName: string;
  employeeName: string;
  employeeNo: string;
  paymentDate: string; // 賞与支給日（YYYY-MM-DD）
  overrides?: DeductionOverrides; // 健保・介護・子育ての手動調整（表の丸め前の小数値が既定）
}

const TEAL = '#4db6ac';
const TEAL_LIGHT = '#e0f2f1';

function fmtJpDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

type Cell = [string, string] | null;

// 賞与明細の支給/控除行を構築する。画面（本コンポーネント）と Excel 出力（Payslip.tsx）で
// 同じ行データを使い、レイアウトの分岐を防ぐ
export function buildBonusRows(
  result: BonusCalculationResult,
  merged: ReturnType<typeof mergedBonusDeductions>
): { shikyuRows: Cell[][]; kojoRows: Cell[][] } {
  const fmt = formatYen;
  const shikyuRows: Cell[][] = [
    [
      ['賞与', result.bonusAmount.toLocaleString()],
      ['標準賞与額', result.standardBonusAmount.toLocaleString()],
      null,
      null,
    ],
  ];
  const kojoRows: Cell[][] = [
    [
      ['健康保険', fmt(merged.healthInsurance)],
      ['介護保険', fmt(merged.nursingCare)],
      ['厚生年金', fmt(merged.employeePension)],
      ['雇用保険', fmt(merged.unemployment)],
    ],
    [
      ['子育て支援金', fmt(merged.childSupport)],
      ['所得税', fmt(merged.incomeTax)],
      null,
      null,
    ],
  ];
  return { shikyuRows, kojoRows };
}

// 賞与支払明細書の本体（勤怠欄なし）。印刷ページの 1 枚分。
export default function BonusPayslipBody({
  result,
  input,
  companyName,
  employeeName,
  employeeNo,
  paymentDate,
  overrides = {},
}: Props) {
  const [y, m] = input.salaryMonth.split('-').map(Number);
  // 手動調整を反映した控除額・合計・手取（画面表示と同じ値を印刷する）
  const d = mergedBonusDeductions(result, overrides);
  const netAmount = d.netBonus;
  const fmt = formatYen;

  const { shikyuRows, kojoRows } = buildBonusRows(result, d);

  const renderSection = (title: string, rows: Cell[][], cols: number) => (
    <table className="w-full border-collapse mb-3" style={{ tableLayout: 'fixed' }}>
      <tbody>
        {rows.map((row, ri) => (
          <Fragment key={ri}>
            <tr>
              {ri === 0 && (
                <td
                  rowSpan={rows.length * 2}
                  className="text-white text-center font-bold text-lg border"
                  style={{ backgroundColor: TEAL, width: '12%', borderColor: TEAL }}
                >
                  {title}
                </td>
              )}
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border px-2 py-1.5 text-center text-xs font-medium"
                  style={{ backgroundColor: TEAL_LIGHT, borderColor: '#b2dfdb', width: `${88 / cols}%` }}
                >
                  {cell ? cell[0] : ''}
                </td>
              ))}
            </tr>
            <tr>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border px-2 py-2 text-center text-sm bg-white"
                  style={{ borderColor: '#b2dfdb' }}
                >
                  {cell ? cell[1] : ''}
                </td>
              ))}
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="payslip-page p-8 min-w-[720px]">
      <h1 className="text-center text-2xl font-bold mb-6">
        {y}年{m}月分　賞与支払明細書
      </h1>

      {/* Microsoft Print to PDF（Windows）は flex justify-between の子要素を落とすことがあるため、
          他の表と同じ table 罫線なしレイアウトで組む */}
      <table className="w-full mb-1" style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td className="text-base font-bold p-0 text-left align-top">{companyName}</td>
            <td className="text-sm p-0 text-right align-top">{paymentDate && `賞与支給日: ${fmtJpDate(paymentDate)}`}</td>
          </tr>
        </tbody>
      </table>
      <table className="w-full mb-4" style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td className="text-sm p-0 text-left align-bottom">
              氏名: {employeeName}
              {employeeNo && `（社員番号: ${employeeNo}）`}
            </td>
            <td className="p-0 text-right align-bottom">
              <div className="inline-block text-right border-b-2 pb-1" style={{ borderColor: TEAL }}>
                <span className="text-lg font-bold mr-8">差引支給額</span>
                <span className="text-2xl font-bold">¥{fmt(netAmount)}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {renderSection('支給', shikyuRows, 4)}
      {renderSection('控除', kojoRows, 4)}

      {/* 合計 */}
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td
              rowSpan={2}
              className="text-white text-center font-bold text-lg border"
              style={{ backgroundColor: TEAL, width: '12%', borderColor: TEAL }}
            >
              合計
            </td>
            <td className="border" style={{ borderColor: '#b2dfdb', width: '22%' }}></td>
            <td className="border px-2 py-1.5 text-center text-xs font-medium" style={{ backgroundColor: TEAL_LIGHT, borderColor: '#b2dfdb', width: '22%' }}>総支給額</td>
            <td className="border px-2 py-1.5 text-center text-xs font-medium" style={{ backgroundColor: TEAL_LIGHT, borderColor: '#b2dfdb', width: '22%' }}>総控除額</td>
            <td className="border px-2 py-1.5 text-center text-xs font-medium" style={{ backgroundColor: TEAL_LIGHT, borderColor: '#b2dfdb', width: '22%' }}>差引支給額</td>
          </tr>
          <tr>
            <td className="border bg-white" style={{ borderColor: '#b2dfdb' }}></td>
            <td className="border px-2 py-2 text-center text-sm bg-white" style={{ borderColor: '#b2dfdb' }}>
              {result.bonusAmount.toLocaleString()}
            </td>
            <td className="border px-2 py-2 text-center text-sm bg-white" style={{ borderColor: '#b2dfdb' }}>
              {fmt(d.total)}
            </td>
            <td className="border px-2 py-2 text-center text-sm bg-white font-bold" style={{ borderColor: '#b2dfdb' }}>
              {fmt(netAmount)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-4 text-xs text-gray-600 print:hidden">
        ※ 所得税は{result.taxMethod}で計算。住民税は賞与から徴収されません。本明細は計算ツールによる参考値です。
      </p>
    </div>
  );
}
