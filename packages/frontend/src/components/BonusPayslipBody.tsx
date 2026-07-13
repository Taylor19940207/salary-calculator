import { Fragment } from 'react';
import type { BonusInput, BonusCalculationResult } from '../types';

interface Props {
  result: BonusCalculationResult;
  input: BonusInput;
  companyName: string;
  employeeName: string;
  employeeNo: string;
  paymentDate: string; // 賞与支給日（YYYY-MM-DD）
}

const TEAL = '#4db6ac';
const TEAL_LIGHT = '#e0f2f1';

function fmtJpDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

type Cell = [string, string] | null;

// 賞与支払明細書の本体（勤怠欄なし）。印刷ページの 1 枚分。
export default function BonusPayslipBody({
  result,
  input,
  companyName,
  employeeName,
  employeeNo,
  paymentDate,
}: Props) {
  const [y, m] = input.salaryMonth.split('-').map(Number);
  const d = result.deductions;

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
      ['健康保険', d.healthInsurance.toLocaleString()],
      ['介護保険', d.nursingCare.toLocaleString()],
      ['厚生年金', d.employeePension.toLocaleString()],
      ['雇用保険', d.unemployment.toLocaleString()],
    ],
    [
      ['子育て支援金', d.childSupport.toLocaleString()],
      ['所得税', d.incomeTax.toLocaleString()],
      null,
      null,
    ],
  ];

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
    <div className="payslip-page p-8">
      <h1 className="text-center text-2xl font-bold mb-6">
        {y}年{m}月分　賞与支払明細書
      </h1>

      <div className="flex justify-between items-start mb-1">
        <p className="text-base font-bold">{companyName}</p>
        {paymentDate && <p className="text-sm">賞与支給日: {fmtJpDate(paymentDate)}</p>}
      </div>
      <div className="flex justify-between items-end mb-4">
        <p className="text-sm">
          氏名: {employeeName}
          {employeeNo && `（社員番号: ${employeeNo}）`}
        </p>
        <div className="text-right border-b-2 pb-1" style={{ borderColor: TEAL }}>
          <span className="text-lg font-bold mr-8">差引支給額</span>
          <span className="text-2xl font-bold">¥{result.netBonus.toLocaleString()}</span>
        </div>
      </div>

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
              {d.total.toLocaleString()}
            </td>
            <td className="border px-2 py-2 text-center text-sm bg-white font-bold" style={{ borderColor: '#b2dfdb' }}>
              {result.netBonus.toLocaleString()}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-4 text-xs text-gray-400 print:hidden">
        ※ 所得税は{result.taxMethod}で計算。住民税は賞与から徴収されません。本明細は計算ツールによる参考値です。
      </p>
    </div>
  );
}
