import axios from 'axios';
import type { SalaryInput, SalaryCalculationResult, Prefecture, GradeInfo } from './types';

// 開発時はバックエンド(:3001)へ直接、本番は同一オリジンから配信されるため相対パス
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

const api = axios.create({
  baseURL: API_BASE_URL,
});

export async function calculateSalary(input: SalaryInput): Promise<SalaryCalculationResult> {
  const response = await api.post<SalaryCalculationResult>('/api/calculate', input);
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
