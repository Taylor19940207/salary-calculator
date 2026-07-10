# 日本薪資計算器實作計劃

## 專案目標
建立一個**即時更新費率**的日本薪資計算器，解決現有工具費率落後的問題。

## 核心問題分析
現有計算器（salaryagent.itbank.co.jp）的問題：
1. 費率靜態儲存，更新延遲
2. 健康保險費率過時（使用 9.85%，應為 10%+）
3. 無法追溯歷史費率
4. 缺乏透明度（不顯示使用的費率版本）

## 技術架構設計

### 方案選擇：全端 Web 應用

**技術棧：**
- **前端**: React + TypeScript + Tailwind CSS
- **後端**: Node.js + Express
- **資料庫**: PostgreSQL（費率版本管理）
- **費率更新**: 定期爬蟲 + 手動校驗機制

### 系統架構

```
┌─────────────────┐
│   React 前端    │
│  (計算介面)     │
└────────┬────────┘
         │ API
┌────────▼────────┐
│  Express 後端   │
│  - 計算邏輯     │
│  - 費率 API     │
└────────┬────────┘
         │
┌────────▼────────────────────┐
│      PostgreSQL             │
│  - insurance_rates (版本化) │
│  - prefectures             │
│  - rate_update_log         │
└────────┬────────────────────┘
         │
┌────────▼────────┐
│  費率更新系統    │
│  - 爬蟲排程     │
│  - 人工校驗介面 │
└─────────────────┘
```

## 資料庫設計

### 1. insurance_rates（保險費率表）
```sql
CREATE TABLE insurance_rates (
  id SERIAL PRIMARY KEY,
  prefecture_code VARCHAR(2) NOT NULL,
  rate_type VARCHAR(50) NOT NULL,  -- health_insurance, pension, unemployment, nursing_care
  rate_percentage DECIMAL(6,4) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  employee_burden_rate DECIMAL(6,4),  -- 勞工負擔比例
  source_url TEXT,
  verified_at TIMESTAMP,
  verified_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rates_lookup ON insurance_rates(prefecture_code, rate_type, effective_from);
```

### 2. prefectures（都道府縣）
```sql
CREATE TABLE prefectures (
  code VARCHAR(2) PRIMARY KEY,
  name_ja VARCHAR(50) NOT NULL,
  name_en VARCHAR(50)
);
```

### 3. rate_update_log（費率更新日誌）
```sql
CREATE TABLE rate_update_log (
  id SERIAL PRIMARY KEY,
  update_date DATE NOT NULL,
  rate_type VARCHAR(50),
  source VARCHAR(100),
  status VARCHAR(20),  -- pending, verified, rejected
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 核心功能模組

### 1. 費率查詢引擎
```typescript
interface RateQuery {
  prefecture: string;
  salaryDate: Date;
  age: number;
}

interface InsuranceRates {
  healthInsurance: number;      // 健康保險
  nursingCare: number;          // 介護保險（40歲以上）
  employeePension: number;      // 厚生年金
  unemployment: number;         // 雇用保險
  childSupport: number;         // 子育支援金
  effectiveDate: Date;          // 費率生效日期
  sourceUrls: string[];         // 資料來源
}

async function getRatesForDate(query: RateQuery): Promise<InsuranceRates>
```

### 2. 薪資計算引擎
```typescript
interface SalaryInput {
  baseSalary: number;
  commutingAllowance: number;
  otherAllowances: number;
  prefecture: string;
  salaryMonth: Date;
  age: number;
  dependents: number;
  overtimeHours?: {
    regular: number;    // 1.25x
    holiday: number;    // 1.35x
    night: number;      // 1.25x
  };
}

interface SalaryResult {
  grossSalary: number;
  standardMonthlyRemuneration: number;  // 標準報酬月額
  deductions: {
    healthInsurance: number;
    nursingCare: number;
    employeePension: number;
    unemployment: number;
    childSupport: number;
    incomeTax: number;
  };
  netSalary: number;
  ratesUsed: InsuranceRates;
}

async function calculateSalary(input: SalaryInput): Promise<SalaryResult>
```

### 3. 費率爬蟲系統
```typescript
// 協會けんぽ爬蟲
async function scrapeKyoukaiKenpoRates(): Promise<RateUpdate[]>

// 厚生勞動省爬蟲
async function scrapeMHLWRates(): Promise<RateUpdate[]>

// 年金機構爬蟲
async function scrapeNenkinRates(): Promise<RateUpdate[]>

interface RateUpdate {
  prefecture?: string;
  rateType: string;
  newRate: number;
  effectiveFrom: Date;
  sourceUrl: string;
  needsVerification: boolean;
}
```

### 4. 標準報酬月額計算
```typescript
// 根據日本法定級距表計算標準報酬月額
function calculateStandardRemuneration(totalSalary: number): number {
  // 實作 88,000 ~ 1,390,000 的級距對應
}
```

## 前端介面設計

### 主要頁面
1. **計算器頁面**（主要功能）
   - 左側：輸入表單
   - 右側：計算結果 + 費率明細
   - 底部：資料來源與更新時間

2. **費率查詢頁面**
   - 各都道府縣當前費率
   - 歷史費率趨勢圖表
   - 費率變更通知訂閱

3. **管理後台**（可選）
   - 費率更新審核
   - 手動新增/修改費率
   - 更新日誌

### 計算結果呈現
```
┌─────────────────────────────┐
│   手取額                    │
│   ¥256,822                 │
└─────────────────────────────┘

總支給額          ¥310,000
控除合計          ¥53,178
─────────────────────────────
支給內訳（計算過程付）

基本給            +¥300,000
通勤手当          +¥10,000

控除內訳（計算過程付）

健康保險          -¥15,760
  標準報酬月額 ¥320,000 × 4.925%
  📊 協會けんぽ 保險料率表 →

子ども・子育て支援金  -¥368
  基數 ¥320,000 × 0.115%

厚生年金          -¥29,280
  標準報酬月額 ¥320,000 × 9.15%
  📊 日本年金機構 厚生年金保險料額表 →

雇用保險          -¥1,550
  賃金總額 ¥310,000 × 0.5%
  📊 厚生勞動省 雇用保險料率 →

所得稅（源泉徴収）  -¥6,220
  課稅對象額¥253,042（通勤非課稅¥10,000控除後），扶養0人
  📊 國稅庁 源泉徴收稅額表 →

─────────────────────────────
⚠️ 本次計算使用 2026年5月 版費率
📅 費率最後更新：2026-04-01
📄 資料來源：協會けんぽ、厚生勞動省、日本年金機構
```

## 費率更新策略

### 自動更新流程
1. **定期爬蟲**（每日 3:00 AM）
   - 檢查官方網站是否有新公告
   - 解析 PDF/HTML 表格
   - 提取費率數據

2. **變更偵測**
   - 比對資料庫現有費率
   - 標記差異項目

3. **通知機制**
   - Email 通知管理員
   - 列出待審核項目

4. **人工校驗**
   - 管理員確認數據正確性
   - 核對官方公告日期
   - 批准後寫入資料庫

5. **自動生效**
   - 根據 effective_from 自動啟用
   - 不影響歷史計算（仍使用當時費率）

### 緊急更新機制
- 管理後台手動輸入
- 標記為「待驗證」狀態
- 爬蟲下次執行時交叉驗證

## 差異化優勢

與現有工具比較：

| 功能 | salaryagent.itbank | 我們的計算器 |
|------|-------------------|-------------|
| 費率更新 | 手動，有延遲 | 自動 + 人工校驗 |
| 費率透明度 | 不顯示 | 完整顯示來源 |
| 歷史查詢 | 不支援 | 支援任意日期 |
| 計算明細 | 簡略 | 詳細步驟 |
| 資料來源 | 不明 | 官方連結 |
| 開源 | 否 | 可考慮 |

## 實作階段

### Phase 1: MVP（最小可行產品）
- [ ] 資料庫建立與初始費率資料
- [ ] 基本計算引擎（月薪模式）
- [ ] 簡單前端介面
- [ ] 硬編碼 2026 年 4 月費率
- [ ] 部署測試

### Phase 2: 費率管理
- [ ] 費率版本化系統
- [ ] 歷史費率查詢
- [ ] 管理後台
- [ ] 手動費率更新介面

### Phase 3: 自動化
- [ ] 爬蟲系統開發
- [ ] 定期排程
- [ ] 變更通知
- [ ] Email 訂閱功能

### Phase 4: 增強功能
- [ ] 時薪模式
- [ ] 加班費計算
- [ ] 缺勤扣款
- [ ] 批量計算（CSV 匯入）
- [ ] API 開放

## 技術考量

### 資料來源
- 協會けんぽ：https://www.kyoukaikenpo.or.jp/
- 日本年金機構：https://www.nenkin.go.jp/
- 厚生勞動省：https://www.mhlw.go.jp/

### 爬蟲挑戰
1. PDF 解析（大部分費率表是 PDF）
2. 網站結構變更偵測
3. 反爬蟲機制

### 解決方案
- 使用 pdf-parse 或 pdfjs
- 定期人工檢查爬蟲狀態
- 設定合理請求間隔
- 提供手動備援機制

## 部署方案

### 選項 A: Vercel + Supabase
- 前端：Vercel（免費）
- 後端：Vercel Serverless Functions
- 資料庫：Supabase（PostgreSQL，免費額度）
- 優點：快速部署，成本低

### 選項 B: VPS (Linode/DigitalOcean)
- 完整控制
- 爬蟲排程容易
- 月費約 $5-10

### 推薦：選項 A（初期）→ 選項 B（流量增長後）

## 授權與開源

建議採用 MIT License，開源專案：
- 建立社群信任
- 接受 PR 貢獻
- 其他開發者可自行部署

## 時程估計

- **Phase 1 (MVP)**: 2-3 天
- **Phase 2 (費率管理)**: 2 天
- **Phase 3 (自動化)**: 3-4 天
- **Phase 4 (增強功能)**: 依需求

**總計：約 1-2 週完成核心功能**

## 立即開始

第一步：建立專案結構與資料庫 schema
