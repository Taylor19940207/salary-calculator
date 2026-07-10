import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SalaryInput, SalaryCalculationResult } from '../types';

interface Props {
  result: SalaryCalculationResult;
  input: SalaryInput;
  onClose: () => void;
}

const TEAL = '#4db6ac';
const TEAL_LIGHT = '#e0f2f1';

function findIncome(result: SalaryCalculationResult, label: string): number {
  const item = result.breakdown.income.find((i) => i.label === label);
  return item ? Math.abs(item.amount) : 0;
}

// 給与計算期間（給与月の前月1日〜末日と仮定）
function calcPeriod(salaryMonth: string): string {
  const [y, m] = salaryMonth.split('-').map(Number);
  const prev = new Date(y, m - 2, 1);
  const py = prev.getFullYear();
  const pm = prev.getMonth() + 1;
  const lastDay = new Date(py, pm, 0).getDate();
  return `${py}年${pm}月1日〜${py}年${pm}月${lastDay}日`;
}

function fmtHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}:${String(mm).padStart(2, '0')}`;
}

export default function Payslip({ result, input, onClose }: Props) {
  const [companyName, setCompanyName] = useState('株式会社サンプル');
  const [employeeName, setEmployeeName] = useState('山田 太郎');
  const [employeeNo, setEmployeeNo] = useState('');

  // 印刷時に明細以外を隠すためのマーカー
  useEffect(() => {
    document.body.classList.add('printing-payslip');
    return () => document.body.classList.remove('printing-payslip');
  }, []);

  const [y, m] = input.salaryMonth.split('-').map(Number);
  const scheduledHours = input.scheduledMonthlyHours || 160;
  const scheduledDays = Math.round(scheduledHours / 8);
  const absenceDays = input.absenceDays || 0;
  const ot = input.overtime || { regular: 0, holiday: 0, night: 0 };
  const actualHours = input.salaryType === 'hourly'
    ? (input.totalWorkHours || 0) + ot.regular + ot.holiday + ot.night
    : scheduledHours - absenceDays * 8 + ot.regular + ot.holiday + ot.night;

  const d = result.deductions;

  // セル定義: [ラベル, 値] — 空セルは null
  type Cell = [string, string] | null;
  const kintaiRows: Cell[][] = [
    [
      ['所定就労日', `${scheduledDays}`],
      ['出勤日数', `${scheduledDays - absenceDays}`],
      ['欠勤日数', `${absenceDays}`],
      ['特休日数', '0'],
      ['有休日数', '0'],
      ['有休残日数', '—'],
    ],
    [
      ['所定労働時間', fmtHours(scheduledHours)],
      ['遅刻早退時間', '0:00'],
      ['実働時間', fmtHours(actualHours)],
      ['残業時間', fmtHours(ot.regular)],
      ['休日勤務時間', fmtHours(ot.holiday)],
      ['深夜勤務時間', fmtHours(ot.night)],
    ],
  ];

  const absenceDeduction = findIncome(result, '欠勤控除');
  const shikyuRows: Cell[][] = [
    [
      ['基本給', findIncome(result, '基本給').toLocaleString()],
      ['残業手当', findIncome(result, '残業手当').toLocaleString()],
      ['休日手当', findIncome(result, '休日労働手当').toLocaleString()],
      ['夜勤手当', findIncome(result, '深夜労働手当').toLocaleString()],
      absenceDeduction > 0 ? ['欠勤控除', `-${absenceDeduction.toLocaleString()}`] : null,
      null,
    ],
    [
      ['通勤手当（非課税）', (input.commutingAllowance || 0).toLocaleString()],
      ['出張手当（非課税）', (input.businessTripAllowance || 0).toLocaleString()],
      ['その他手当', (input.otherAllowances || 0).toLocaleString()],
      null,
      null,
      null,
    ],
  ];

  const kojoRows: Cell[][] = [
    [
      ['雇用保険', d.unemployment.toLocaleString()],
      ['健康保険', d.healthInsurance.toLocaleString()],
      ['介護保険', d.nursingCare.toLocaleString()],
      ['厚生年金', d.employeePension.toLocaleString()],
      ['子育て支援金', d.childSupport.toLocaleString()],
      ['所得税', d.incomeTax.toLocaleString()],
    ],
    [
      ['住民税', '—'],
      null,
      null,
      null,
      null,
      null,
    ],
  ];

  const renderSection = (title: string, rows: Cell[][]) => (
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
                  style={{ backgroundColor: TEAL_LIGHT, borderColor: '#b2dfdb', width: '14.66%' }}
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

  return createPortal(
    <div className="payslip-overlay fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto my-8 bg-white rounded-lg shadow-xl print:shadow-none print:my-0 print:rounded-none">
        {/* ツールバー（印刷時非表示） */}
        <div className="flex justify-between items-center px-6 py-4 border-b print:hidden">
          <div className="flex gap-4 items-center text-sm">
            <label>
              会社名:
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="ml-1 px-2 py-1 border rounded w-44"
              />
            </label>
            <label>
              氏名:
              <input
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                className="ml-1 px-2 py-1 border rounded w-32"
              />
            </label>
            <label>
              社員番号:
              <input
                value={employeeNo}
                onChange={(e) => setEmployeeNo(e.target.value)}
                className="ml-1 px-2 py-1 border rounded w-24"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
            >
              🖨 印刷 / PDF保存
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
            >
              閉じる
            </button>
          </div>
        </div>

        {/* 明細書本体 */}
        <div id="payslip-body" className="p-8">
          <h1 className="text-center text-2xl font-bold mb-6">
            {y}年{m}月分　給与支払明細書
          </h1>

          <p className="text-sm mb-1">給与計算期間: {calcPeriod(input.salaryMonth)}</p>
          <p className="text-base font-bold mb-1">{companyName}</p>
          <div className="flex justify-between items-end mb-4">
            <p className="text-sm">
              氏名: {employeeName}
              {employeeNo && `（社員番号: ${employeeNo}）`}
            </p>
            <div className="text-right border-b-2 pb-1" style={{ borderColor: TEAL }}>
              <span className="text-lg font-bold mr-8">差引支給額</span>
              <span className="text-2xl font-bold">¥{result.netSalary.toLocaleString()}</span>
            </div>
          </div>

          {renderSection('勤怠', kintaiRows)}
          {renderSection('支給', shikyuRows)}
          {renderSection('控除', kojoRows)}

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
                <td className="border" style={{ borderColor: '#b2dfdb', width: '14.66%' }}></td>
                <td className="border" style={{ borderColor: '#b2dfdb', width: '14.66%' }}></td>
                <td className="border" style={{ borderColor: '#b2dfdb', width: '14.66%' }}></td>
                <td className="border px-2 py-1.5 text-center text-xs font-medium" style={{ backgroundColor: TEAL_LIGHT, borderColor: '#b2dfdb', width: '14.66%' }}>総支給額</td>
                <td className="border px-2 py-1.5 text-center text-xs font-medium" style={{ backgroundColor: TEAL_LIGHT, borderColor: '#b2dfdb', width: '14.66%' }}>総控除額</td>
                <td className="border px-2 py-1.5 text-center text-xs font-medium" style={{ backgroundColor: TEAL_LIGHT, borderColor: '#b2dfdb', width: '14.66%' }}>差引支給額</td>
              </tr>
              <tr>
                <td className="border bg-white" style={{ borderColor: '#b2dfdb' }}></td>
                <td className="border bg-white" style={{ borderColor: '#b2dfdb' }}></td>
                <td className="border bg-white" style={{ borderColor: '#b2dfdb' }}></td>
                <td className="border px-2 py-2 text-center text-sm bg-white" style={{ borderColor: '#b2dfdb' }}>
                  {result.grossSalary.toLocaleString()}
                </td>
                <td className="border px-2 py-2 text-center text-sm bg-white" style={{ borderColor: '#b2dfdb' }}>
                  {d.total.toLocaleString()}
                </td>
                <td className="border px-2 py-2 text-center text-sm bg-white font-bold" style={{ borderColor: '#b2dfdb' }}>
                  {result.netSalary.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mt-4 text-xs text-gray-400 print:hidden">
            ※ 住民税は市区町村ごとに異なるため含まれていません。本明細は計算ツールによる参考値です。
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
