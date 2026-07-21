import express from 'express';
import { z } from 'zod';
import { calculateSalary } from '../services/salaryCalculator.js';
import type { SalaryInput, SalaryCalculationResult } from '../types/index.js';

const router = express.Router();

// 批量計算的輸入驗證
const BatchCalculateSchema = z.object({
  employees: z.array(z.object({
    id: z.string().optional(), // 員工編號或識別碼
    name: z.string().optional(), // 員工姓名
    salaryType: z.enum(['monthly', 'hourly']),
    baseSalary: z.number().optional(),
    hourlyWage: z.number().optional(),
    totalWorkHours: z.number().optional(),
    commutingAllowance: z.number().default(0),
    businessTripAllowance: z.number().min(0).optional(),
    performancePay: z.number().min(0).optional(),
    otherAllowances: z.number().default(0),
    prefecture: z.string(),
    salaryMonth: z.string().regex(/^\d{4}-\d{2}$/),
    age: z.number().min(15).max(100),
    dependents: z.number().min(0).default(0),
    enrollInInsurance: z.boolean().default(true),
    enrollInUnemploymentInsurance: z.boolean().default(true), // 雇用保険加入（社会保険とは別判定）
    overtime: z.object({
      regular: z.number().default(0),
      holiday: z.number().default(0),
      night: z.number().default(0),
    }).optional(),
    absenceDays: z.number().optional(),
    scheduledMonthlyHours: z.number().min(1).max(250).optional(),
    manualGrade: z.number().int().min(1).max(50).optional(),
    residentTax: z.number().min(0).optional(), // 住民税（特別徴収・月額）
    priorMonthAdjustment: z.number().optional(), // 前月調整訂正分（正負可）
  })).min(1).max(100) // 最多一次處理 100 人
});

interface BatchCalculationResult {
  id?: string;
  name?: string;
  input: SalaryInput;
  result: SalaryCalculationResult;
  error?: string;
}

/**
 * 批量計算薪資
 * POST /api/calculate/batch
 */
router.post('/calculate/batch', async (req, res) => {
  try {
    const { employees } = BatchCalculateSchema.parse(req.body);

    const results: BatchCalculationResult[] = [];

    // 並行計算所有員工的薪資
    const promises = employees.map(async (employee) => {
      try {
        const input: SalaryInput = {
          salaryType: employee.salaryType,
          baseSalary: employee.baseSalary,
          hourlyWage: employee.hourlyWage,
          totalWorkHours: employee.totalWorkHours,
          commutingAllowance: employee.commutingAllowance,
          businessTripAllowance: employee.businessTripAllowance,
          performancePay: employee.performancePay,
          otherAllowances: employee.otherAllowances,
          prefecture: employee.prefecture,
          salaryMonth: employee.salaryMonth,
          age: employee.age,
          dependents: employee.dependents,
          enrollInInsurance: employee.enrollInInsurance,
          enrollInUnemploymentInsurance: employee.enrollInUnemploymentInsurance,
          overtime: employee.overtime,
          absenceDays: employee.absenceDays,
          scheduledMonthlyHours: employee.scheduledMonthlyHours,
          manualGrade: employee.manualGrade,
          residentTax: employee.residentTax,
          priorMonthAdjustment: employee.priorMonthAdjustment,
        };

        const result = await calculateSalary(input);

        return {
          id: employee.id,
          name: employee.name,
          input,
          result,
        };
      } catch (error) {
        return {
          id: employee.id,
          name: employee.name,
          input: employee as any,
          result: null as any,
          error: error instanceof Error ? error.message : 'Calculation failed',
        };
      }
    });

    const calculationResults = await Promise.all(promises);

    // 統計數據
    const summary = {
      total: calculationResults.length,
      successful: calculationResults.filter(r => !r.error).length,
      failed: calculationResults.filter(r => r.error).length,
      totalGrossSalary: calculationResults
        .filter(r => !r.error)
        .reduce((sum, r) => sum + r.result.grossSalary, 0),
      totalNetSalary: calculationResults
        .filter(r => !r.error)
        .reduce((sum, r) => sum + r.result.netSalary, 0),
      totalDeductions: calculationResults
        .filter(r => !r.error)
        .reduce((sum, r) => sum + r.result.deductions.total, 0),
    };

    res.json({
      summary,
      results: calculationResults,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }

    console.error('Batch calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate batch salaries' });
  }
});

/**
 * 從 CSV 匯入並計算
 * POST /api/calculate/import-csv
 */
router.post('/calculate/import-csv', async (req, res) => {
  try {
    const { csvData } = req.body;

    if (!csvData || typeof csvData !== 'string') {
      return res.status(400).json({ error: 'CSV data required' });
    }

    // 解析 CSV（簡單實作，生產環境應使用專門的 CSV parser）
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    const employees = lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim());
      const employee: any = {};

      headers.forEach((header, i) => {
        const value = values[i];

        // 根據欄位名稱解析對應的值
        switch (header.toLowerCase()) {
          case 'id':
          case '員工編號':
            employee.id = value;
            break;
          case 'name':
          case '姓名':
            employee.name = value;
            break;
          case 'salarytype':
          case '薪資類型':
            employee.salaryType = value === 'hourly' || value === '時給' ? 'hourly' : 'monthly';
            break;
          case 'basesalary':
          case '基本給':
            employee.baseSalary = parseFloat(value) || 0;
            break;
          case 'hourlywage':
          case '時給':
            employee.hourlyWage = parseFloat(value) || undefined;
            break;
          case 'totalworkhours':
          case '総労働時間':
            employee.totalWorkHours = parseFloat(value) || undefined;
            break;
          case 'commutingallowance':
          case '通勤手当':
            employee.commutingAllowance = parseFloat(value) || 0;
            break;
          case 'performancepay':
          case '業績給':
            employee.performancePay = parseFloat(value) || undefined;
            break;
          case 'residenttax':
          case '住民税':
            employee.residentTax = parseFloat(value) || undefined;
            break;
          case 'priormonthadjustment':
          case '前月調整訂正分':
            employee.priorMonthAdjustment = parseFloat(value) || undefined;
            break;
          case 'otherallowances':
          case 'その他手当':
            employee.otherAllowances = parseFloat(value) || 0;
            break;
          case 'prefecture':
          case '都道府県':
            employee.prefecture = value;
            break;
          case 'salarymonth':
          case '給与年月':
            employee.salaryMonth = value;
            break;
          case 'age':
          case '年齢':
            employee.age = parseInt(value) || 30;
            break;
          case 'dependents':
          case '扶養人数':
            employee.dependents = parseInt(value) || 0;
            break;
          case 'enrollininsurance':
          case '社会保険':
            employee.enrollInInsurance = value === 'true' || value === '1' || value === 'はい';
            break;
          case 'enrollinunemploymentinsurance':
          case '雇用保険':
            // 「未加入」「false」「0」「いいえ」以外は加入扱い（既定は一般被保険者）
            employee.enrollInUnemploymentInsurance =
              !(value === 'false' || value === '0' || value === 'いいえ' || value === '未加入');
            break;
        }
      });

      // 給与形態が未指定の CSV は月給とみなす（給与台帳の大半が月給のため）
      if (!employee.salaryType) {
        employee.salaryType = 'monthly';
      }

      return employee;
    });

    // 使用批量計算 API
    const { employees: validatedEmployees } = BatchCalculateSchema.parse({ employees });

    const promises = validatedEmployees.map(async (employee) => {
      try {
        const result = await calculateSalary(employee as SalaryInput);
        return {
          id: employee.id,
          name: employee.name,
          input: employee as SalaryInput,
          result,
        };
      } catch (error) {
        return {
          id: employee.id,
          name: employee.name,
          error: error instanceof Error ? error.message : 'Calculation failed',
        };
      }
    });

    const results = await Promise.all(promises);

    res.json({ results });

  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'Failed to import and calculate CSV' });
  }
});

/**
 * 匯出計算結果為 CSV
 * POST /api/calculate/export-csv
 */
router.post('/calculate/export-csv', async (req, res) => {
  try {
    const { results } = req.body;

    if (!Array.isArray(results)) {
      return res.status(400).json({ error: 'Results array required' });
    }

    // フロントが画面表示と同じ値（健保・介護・子育ては表の原生小数＋手動調整）を送ってくるため、
    // 値をそのまま出力する。整数は整数のまま、端数がある場合のみ小数点2桁で表示
    const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

    // 生成 CSV 標題
    const headers = [
      '員工編號',
      '姓名',
      '総支給額',
      '健康保険',
      '介護保険',
      '厚生年金',
      '雇用保険',
      '子育支援金',
      '所得税',
      '住民税',
      '前月調整訂正分',
      '控除合計',
      '手取額',
    ].join(',');

    // 生成 CSV 內容
    const rows = results.map((r: BatchCalculationResult) => {
      if (r.error) {
        return `${r.id || ''},${r.name || ''},ERROR,,,,,,,,,"${r.error}"`;
      }

      const d = r.result.deductions;
      const netSalary = r.result.netSalary;

      return [
        r.id || '',
        r.name || '',
        r.result.grossSalary,
        fmtNum(d.healthInsurance),
        fmtNum(d.nursingCare),
        fmtNum(d.employeePension),
        fmtNum(d.unemployment),
        fmtNum(d.childSupport),
        fmtNum(d.incomeTax),
        fmtNum(d.residentTax ?? 0),
        fmtNum(d.priorMonthAdjustment ?? 0),
        fmtNum(d.total),
        fmtNum(netSalary),
      ].join(',');
    });

    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=salary_results.csv');
    res.send('﻿' + csv); // BOM for Excel compatibility

  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

export default router;
