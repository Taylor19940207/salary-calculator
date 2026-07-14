import axios from 'axios';
import type {
  SalaryInput,
  SalaryCalculationResult,
  Prefecture,
  GradeInfo,
  BonusInput,
  BonusCalculationResult,
} from './types';

// 開発時はバックエンド(:3001)へ直接、本番は同一オリジンから配信されるため相対パス
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

const api = axios.create({
  baseURL: API_BASE_URL,
});

export async function calculateSalary(input: SalaryInput): Promise<SalaryCalculationResult> {
  const response = await api.post<SalaryCalculationResult>('/api/calculate', input);
  return response.data;
}

export async function calculateBonus(input: BonusInput): Promise<BonusCalculationResult> {
  const response = await api.post<BonusCalculationResult>('/api/calculate-bonus', input);
  return response.data;
}

export async function getPrefectures(): Promise<Prefecture[]> {
  const response = await api.get<Prefecture[]>('/api/prefectures');
  return response.data;
}

export async function getGrades(date?: string): Promise<GradeInfo[]> {
  const response = await api.get<GradeInfo[]>('/api/grades', { params: { date } });
  return response.data;
}

export async function getInsuranceRates(prefecture: string, date: string) {
  const response = await api.get('/api/rates', {
    params: { prefecture, date },
  });
  return response.data;
}

// ===== 複数人計算 =====

export async function calculateBatch(employees: unknown[]) {
  const response = await api.post('/api/calculate/batch', { employees });
  return response.data;
}

export async function importCsvAndCalculate(csvData: string) {
  const response = await api.post('/api/calculate/import-csv', { csvData });
  return response.data;
}

export async function exportResultsCsv(results: unknown[]): Promise<Blob> {
  const response = await api.post(
    '/api/calculate/export-csv',
    { results },
    { responseType: 'blob' }
  );
  return response.data;
}

// 給与/賞与明細書を PDF と同じテンプレートで Excel 出力する
export async function exportPayslipXlsx(payload: unknown): Promise<Blob> {
  const response = await api.post('/api/payslip-xlsx', payload, { responseType: 'blob' });
  return response.data;
}
