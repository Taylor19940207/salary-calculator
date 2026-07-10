import { useState } from 'react';
import type { SalaryInput } from '../types';

interface Employee extends SalaryInput {
  id: string;
  name: string;
}

interface BatchResult {
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalGrossSalary: number;
    totalNetSalary: number;
    totalDeductions: number;
  };
  results: Array<{
    id?: string;
    name?: string;
    result: any;
    error?: string;
  }>;
}

export default function BatchCalculator() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [csvInput, setCsvInput] = useState('');

  // 新增員工
  const addEmployee = () => {
    const newEmployee: Employee = {
      id: `EMP${employees.length + 1}`,
      name: `員工 ${employees.length + 1}`,
      salaryType: 'monthly',
      baseSalary: 300000,
      commutingAllowance: 10000,
      otherAllowances: 0,
      prefecture: '13',
      salaryMonth: '2026-05',
      age: 30,
      dependents: 0,
      enrollInInsurance: true,
    };

    setEmployees([...employees, newEmployee]);
  };

  // 更新員工資料
  const updateEmployee = (index: number, field: keyof Employee, value: any) => {
    const updated = [...employees];
    updated[index] = { ...updated[index], [field]: value };
    setEmployees(updated);
  };

  // 刪除員工
  const removeEmployee = (index: number) => {
    setEmployees(employees.filter((_, i) => i !== index));
  };

  // 批量計算
  const handleBatchCalculate = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/calculate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Batch calculation failed:', error);
      alert('批量計算失敗');
    } finally {
      setLoading(false);
    }
  };

  // CSV 匯入
  const handleCSVImport = async () => {
    if (!csvInput.trim()) {
      alert('請輸入 CSV 資料');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/calculate/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: csvInput }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('CSV import failed:', error);
      alert('CSV 匯入失敗');
    } finally {
      setLoading(false);
    }
  };

  // CSV 匯出
  const handleCSVExport = async () => {
    if (!result) {
      alert('請先執行計算');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/calculate/export-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: result.results }),
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salary_results_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error) {
      console.error('CSV export failed:', error);
      alert('CSV 匯出失敗');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">批量薪資計算</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左側：員工列表 */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">員工列表</h2>
            <button
              onClick={addEmployee}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              + 新增員工
            </button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {employees.map((employee, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="員工編號"
                      value={employee.id}
                      onChange={(e) => updateEmployee(index, 'id', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="姓名"
                      value={employee.name}
                      onChange={(e) => updateEmployee(index, 'name', e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <button
                    onClick={() => removeEmployee(index)}
                    className="ml-2 text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <label className="text-xs text-gray-600">基本給</label>
                    <input
                      type="number"
                      value={employee.baseSalary || ''}
                      onChange={(e) => updateEmployee(index, 'baseSalary', parseFloat(e.target.value))}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">通勤手当</label>
                    <input
                      type="number"
                      value={employee.commutingAllowance}
                      onChange={(e) => updateEmployee(index, 'commutingAllowance', parseFloat(e.target.value))}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">年齢</label>
                    <input
                      type="number"
                      value={employee.age}
                      onChange={(e) => updateEmployee(index, 'age', parseInt(e.target.value))}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">扶養</label>
                    <input
                      type="number"
                      value={employee.dependents}
                      onChange={(e) => updateEmployee(index, 'dependents', parseInt(e.target.value))}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </div>
                </div>
              </div>
            ))}

            {employees.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                點擊「新增員工」開始批量計算
              </div>
            )}
          </div>

          <button
            onClick={handleBatchCalculate}
            disabled={loading || employees.length === 0}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? '計算中...' : `批量計算 (${employees.length} 人)`}
          </button>

          {/* CSV 匯入區 */}
          <div className="mt-8 border-t pt-6">
            <h3 className="font-semibold mb-3">CSV 匯入</h3>
            <textarea
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              placeholder="貼上 CSV 資料...&#10;格式：員工編號,姓名,基本給,通勤手当,都道府県,給与年月,年齢,扶養人数"
              className="w-full h-32 px-3 py-2 border rounded-lg text-sm font-mono"
            />
            <button
              onClick={handleCSVImport}
              disabled={loading}
              className="mt-2 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              CSV 匯入並計算
            </button>
          </div>
        </div>

        {/* 右側：計算結果 */}
        <div>
          {result && (
            <div className="space-y-4">
              {/* 統計摘要 */}
              <div className="bg-gradient-to-r from-green-400 to-green-500 p-6 rounded-lg text-white">
                <h2 className="text-lg font-semibold mb-4">統計摘要</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm opacity-90">總人數</p>
                    <p className="text-2xl font-bold">{result.summary.total} 人</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">成功/失敗</p>
                    <p className="text-2xl font-bold">
                      {result.summary.successful} / {result.summary.failed}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">總支給額</p>
                    <p className="text-xl font-bold">
                      ¥{result.summary.totalGrossSalary.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">總手取額</p>
                    <p className="text-xl font-bold">
                      ¥{result.summary.totalNetSalary.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* 匯出按鈕 */}
              <button
                onClick={handleCSVExport}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                📥 匯出 CSV
              </button>

              {/* 詳細結果 */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b">
                  <h3 className="font-semibold">詳細結果</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">員工</th>
                        <th className="px-4 py-2 text-right">総支給</th>
                        <th className="px-4 py-2 text-right">控除</th>
                        <th className="px-4 py-2 text-right">手取</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.map((r, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <div className="font-medium">{r.name || r.id}</div>
                            {r.error && (
                              <div className="text-xs text-red-600">{r.error}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {r.error ? '-' : `¥${r.result.grossSalary.toLocaleString()}`}
                          </td>
                          <td className="px-4 py-2 text-right text-red-600">
                            {r.error ? '-' : `-¥${r.result.deductions.total.toLocaleString()}`}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">
                            {r.error ? '-' : `¥${r.result.netSalary.toLocaleString()}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              新增員工後點擊「批量計算」查看結果
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">計算中...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
