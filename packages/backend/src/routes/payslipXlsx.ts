import express from 'express';
import ExcelJS from 'exceljs';
import { z } from 'zod';

const router = express.Router();

// PDF明細（Payslip.tsx）と同じ青緑4段テンプレートを Excel で再現する。
// フロントが画面表示と同じ値（端数の手動調整込み）をレイアウト済みで送る。
// 金額は number のまま受け取り、includeInTotal が付いたセルだけを Excel の合計式に含める。
const CellSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  includeInTotal: z.boolean().optional(),
}).nullable();
const SectionSchema = z.object({
  title: z.string(),          // 勤怠 / 支給 / 控除
  rows: z.array(z.array(CellSchema)), // ラベル+値のペア行（PDFと同じ構造）
});
const SheetSchema = z.object({
  name: z.string().max(31),   // Excelのシート名は31文字まで
  title: z.string(),          // 例: 2026年5月分　給与支払明細書
  companyName: z.string(),
  employeeLine: z.string(),   // 例: 氏名: 山田 太郎（社員番号: EMP1）
  periodLine: z.string().optional(),  // 例: 給与計算期間: 2026年4月1日〜4月30日
  paymentLine: z.string().optional(), // 例: 支給日: 2026年5月25日
  netLabel: z.string(),       // 差引支給額
  netValue: z.number(),       // 256822（表示形式はExcel側で付ける）
  sections: z.array(SectionSchema),
  totals: z.object({
    grossLabel: z.string(),
    gross: z.number(),
    deductionLabel: z.string(),
    deduction: z.number(),
    netLabel: z.string(),
    net: z.number(),
  }),
  note: z.string().optional(),
});
const PayloadSchema = z.object({
  fileName: z.string(),
  sheets: z.array(SheetSchema).min(1).max(2), // 給与（＋賞与）
});

// PDFテンプレートと同じ配色
const TEAL = 'FF4DB6AC';
const TEAL_LIGHT = 'FFE0F2F1';
const BORDER = 'FFB2DFDB';
const AMOUNT_FORMAT = '#,##0.##';
const INTEGER_FORMAT = '#,##0';
const YEN_FORMAT = '"¥"#,##0.##';
const YEN_INTEGER_FORMAT = '"¥"#,##0';

const thin = { style: 'thin' as const, color: { argb: BORDER } };
const boxBorder = { top: thin, left: thin, bottom: thin, right: thin };

function renderSheet(wb: ExcelJS.Workbook, sheet: z.infer<typeof SheetSchema>) {
  // シート名に使えない文字を除去
  const ws = wb.addWorksheet(sheet.name.replace(/[\\/*?:\[\]]/g, ''), {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });

  // 列構成: A=セクション見出し、B〜G=6列（PDFと同じ）
  ws.getColumn(1).width = 10;
  for (let c = 2; c <= 7; c++) ws.getColumn(c).width = 16;

  let r = 1;
  const incomeRefs: string[] = [];
  const deductionRefs: string[] = [];
  let conditionalPriority = 1;

  // Excelでは #,##0.## が整数にも末尾の小数点を表示する場合がある。
  // 整数時だけ条件付き書式で小数点なしにし、編集後に小数が入れば通常書式へ戻す。
  const applyAdaptiveNumberFormat = (cell: ExcelJS.Cell, currency = false) => {
    cell.numFmt = currency ? YEN_FORMAT : AMOUNT_FORMAT;
    ws.addConditionalFormatting({
      ref: cell.address,
      rules: [{
        type: 'expression',
        priority: conditionalPriority++,
        formulae: [`MOD(${cell.address},1)=0`],
        style: { numFmt: currency ? YEN_INTEGER_FORMAT : INTEGER_FORMAT },
      }],
    });
  };

  // タイトル
  ws.mergeCells(r, 1, r, 7);
  const title = ws.getCell(r, 1);
  title.value = sheet.title;
  title.font = { size: 16, bold: true };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(r).height = 28;
  r += 2;

  // 期間・支給日
  if (sheet.periodLine || sheet.paymentLine) {
    ws.getCell(r, 1).value = sheet.periodLine ?? null;
    ws.mergeCells(r, 1, r, 4);
    if (sheet.paymentLine) {
      ws.mergeCells(r, 5, r, 7);
      const p = ws.getCell(r, 5);
      p.value = sheet.paymentLine;
      p.alignment = { horizontal: 'right' };
    }
    r += 1;
  }

  // 会社名
  ws.getCell(r, 1).value = sheet.companyName;
  ws.getCell(r, 1).font = { bold: true };
  ws.mergeCells(r, 1, r, 4);
  r += 1;

  // 氏名 + 差引支給額
  ws.getCell(r, 1).value = sheet.employeeLine;
  ws.mergeCells(r, 1, r, 4);
  ws.getCell(r, 5).value = sheet.netLabel;
  ws.getCell(r, 5).font = { bold: true };
  ws.getCell(r, 5).alignment = { horizontal: 'right', vertical: 'bottom' };
  ws.mergeCells(r, 6, r, 7);
  const netCell = ws.getCell(r, 6);
  // 底部の差引支給額セルが確定してから参照式を設定する。
  netCell.value = sheet.netValue;
  applyAdaptiveNumberFormat(netCell, true);
  netCell.font = { size: 14, bold: true };
  netCell.alignment = { horizontal: 'right', vertical: 'bottom' };
  netCell.border = { bottom: { style: 'medium', color: { argb: TEAL } } };
  ws.getCell(r, 5).border = { bottom: { style: 'medium', color: { argb: TEAL } } };
  r += 2;

  // セクション（勤怠 / 支給 / 控除）: PDFのrenderSectionと同じ
  // 左端に縦のセクション見出し、ラベル行(teal-light)＋値行(白)の繰り返し
  for (const section of sheet.sections) {
    const startRow = r;
    const cols = Math.max(...section.rows.map((row) => row.length), 1);
    for (const row of section.rows) {
      // ラベル行
      for (let c = 0; c < cols; c++) {
        const cell = ws.getCell(r, c + 2);
        cell.value = row[c]?.label ?? null;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_LIGHT } };
        cell.font = { size: 9, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = boxBorder;
      }
      r += 1;
      // 値行
      for (let c = 0; c < cols; c++) {
        const cell = ws.getCell(r, c + 2);
        const item = row[c];
        cell.value = item?.value ?? null;
        if (typeof item?.value === 'number') {
          applyAdaptiveNumberFormat(cell);
          if (item.includeInTotal) {
            if (section.title === '支給') incomeRefs.push(cell.address);
            if (section.title === '控除') deductionRefs.push(cell.address);
          }
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = boxBorder;
      }
      r += 1;
    }
    // セクション見出し（縦・teal）
    ws.mergeCells(startRow, 1, r - 1, 1);
    const head = ws.getCell(startRow, 1);
    head.value = section.title;
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
    head.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
    head.alignment = { horizontal: 'center', vertical: 'middle' };
    head.border = boxBorder;
    r += 1; // セクション間の空行
  }

  // 合計行（PDFと同じ: 右3列にラベル+値）
  const t = sheet.totals;
  const totalStart = r;
  // ラベル行
  const totalLabels = [null, null, t.grossLabel, t.deductionLabel, t.netLabel];
  for (let c = 0; c < 6; c++) {
    const cell = ws.getCell(r, c + 2);
    const label = c >= 3 ? totalLabels[c - 1] : null;
    cell.value = label;
    if (label) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_LIGHT } };
      cell.font = { size: 9, bold: true };
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = boxBorder;
  }
  r += 1;
  let grossCell: ExcelJS.Cell | null = null;
  let deductionCell: ExcelJS.Cell | null = null;
  let finalNetCell: ExcelJS.Cell | null = null;
  for (let c = 0; c < 6; c++) {
    const cell = ws.getCell(r, c + 2);
    if (c === 3) {
      cell.value = { formula: incomeRefs.length ? `SUM(${incomeRefs.join(',')})` : '0', result: t.gross };
      grossCell = cell;
    } else if (c === 4) {
      cell.value = { formula: deductionRefs.length ? `SUM(${deductionRefs.join(',')})` : '0', result: t.deduction };
      deductionCell = cell;
    } else if (c === 5) {
      // grossCell / deductionCell は同じ行の直前2セルで必ず設定済み。
      cell.value = {
        formula: `${grossCell!.address}-${deductionCell!.address}`,
        result: t.net,
      };
      finalNetCell = cell;
    } else {
      cell.value = null;
    }
    if (c >= 3) applyAdaptiveNumberFormat(cell);
    if (c === 5) cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = boxBorder;
  }
  r += 1;
  ws.mergeCells(totalStart, 1, r - 1, 1);
  const totalHead = ws.getCell(totalStart, 1);
  totalHead.value = '合計';
  totalHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  totalHead.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
  totalHead.alignment = { horizontal: 'center', vertical: 'middle' };
  totalHead.border = boxBorder;

  // 右上の差引支給額は底部の計算結果を参照し、控除額の編集に追従させる。
  netCell.value = { formula: finalNetCell!.address, result: sheet.netValue };

  // 7列目（合計行の右端）にもボーダーを揃える
  for (const row of [totalStart, totalStart + 1]) {
    const cell = ws.getCell(row, 7);
    cell.border = boxBorder;
  }

  if (sheet.note) {
    r += 1;
    ws.mergeCells(r, 1, r, 7);
    const note = ws.getCell(r, 1);
    note.value = sheet.note;
    note.font = { size: 8, color: { argb: 'FF9CA3AF' } };
  }
}

/**
 * 給与/賞与明細書を PDF と同じテンプレートで Excel 出力する
 * POST /api/payslip-xlsx
 */
router.post('/payslip-xlsx', async (req, res) => {
  try {
    const payload = PayloadSchema.parse(req.body);
    const wb = new ExcelJS.Workbook();
    wb.calcProperties.fullCalcOnLoad = true;
    for (const sheet of payload.sheets) {
      renderSheet(wb, sheet);
    }
    const buffer = await wb.xlsx.writeBuffer();
    const encoded = encodeURIComponent(payload.fileName.replace(/[\\/:*?"<>|]/g, ''));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Payslip xlsx error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid payload', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to generate xlsx' });
  }
});

export default router;
