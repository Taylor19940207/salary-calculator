# 費率自動更新系統 - 快速總結

## 🎯 核心問題

**原計算器的問題：** 費率靜態儲存，手動更新有延遲，導致使用過時費率。

**我們的解決方案：** 自動爬蟲 + 人工審核 + 版本管理

---

## 🏗️ 系統流程

```
每天 3:00 AM
    ↓
🕷️ 爬蟲系統
   • 協會けんぽ（健康保險）
   • 厚生勞動省（雇用保險）
   • 日本年金機構（厚生年金）
    ↓
🔍 變更檢測
   比對資料庫現有費率
   記錄差異到 rate_update_log
    ↓
📧 通知管理員
   Email / Slack / 後台提示
    ↓
👨‍💼 人工審核
   管理員登入後台確認
   批准或拒絕
    ↓
✅ 自動更新資料庫
   舊費率設定 effective_to
   新費率設定 effective_from
   立即生效
```

---

## 💻 已建立的檔案

### 1. 系統設計文檔
📄 **RATE_UPDATE_SYSTEM.md**
- 完整架構說明
- 4 種方案比較
- 技術細節和風險評估

### 2. 爬蟲服務
📄 **packages/backend/src/services/rateCrawler.ts**
- `scrapeKyoukaiKenpoRates()` - 爬取健康保險
- `scrapeMHLWRates()` - 爬取雇用保險
- `compareWithCurrentRates()` - 變更檢測
- `notifyAdmin()` - 通知系統
- `runRateCrawler()` - 主要排程任務

### 3. 定期排程
📄 **packages/backend/src/services/scheduler.ts**
- 每天凌晨 3:00 自動執行
- 每月 1 號額外檢查

### 4. 管理 API
📄 **packages/backend/src/routes/admin.ts**
- `GET /admin/rates/pending` - 查看待審核
- `POST /admin/rates/approve/:id` - 批准費率
- `POST /admin/rates/reject/:id` - 拒絕費率
- `POST /admin/crawler/run` - 手動觸發爬蟲

---

## 🚀 如何啟用

### 方式 1：立即實作完整系統

**需要安裝的套件：**
```bash
npm install --workspace=packages/backend cheerio node-cron pdf-parse nodemailer
```

**在 index.ts 啟用排程：**
```typescript
import { setupCronJobs } from './services/scheduler.js';
import adminRoutes from './routes/admin.js';

// 啟用定期爬蟲
setupCronJobs();

// 掛載管理 API
app.use(adminRoutes);
```

**開發時間：** 約 4-6 天完整實作

---

### 方式 2：手動更新 + 日曆提醒（簡單）

**最簡單的做法：**
1. 設定日曆提醒（每年 2 月底、3 月初）
2. 手動訪問官網檢查新費率
3. 執行 SQL 更新資料庫

```sql
-- 結束舊費率
UPDATE insurance_rates 
SET effective_to = '2027-02-28'
WHERE rate_type = 'health_insurance' 
  AND prefecture_code = '13'
  AND effective_to IS NULL;

-- 新增新費率
INSERT INTO insurance_rates 
  (prefecture_code, rate_type, rate_percentage, 
   employee_burden_percentage, effective_from, source_url)
VALUES 
  ('13', 'health_insurance', 10.23, 5.115, 
   '2027-03-01', 'https://www.kyoukaikenpo.or.jp/...');
```

**優點：** 簡單可靠，無需額外開發  
**缺點：** 依賴人工記憶，可能遺漏

---

### 方式 3：使用第三方 API（付費）

**如果有預算：**
- 訂閱 freee API、SmartHR API 等服務
- 他們會提供即時更新的費率數據
- 無需自己維護爬蟲

**月費：** 約 $50-200 USD

---

## 📊 推薦方案比較

| 方案 | 成本 | 開發時間 | 準確性 | 維護成本 | 推薦度 |
|------|------|---------|--------|---------|--------|
| **手動更新** | 免費 | 0 | ⭐⭐⭐ | 低 | ⭐⭐⭐ 入門 |
| **爬蟲+審核** | 免費 | 4-6天 | ⭐⭐⭐⭐ | 中 | ⭐⭐⭐⭐⭐ 推薦 |
| **第三方API** | $50-200/月 | 1天 | ⭐⭐⭐⭐⭐ | 極低 | ⭐⭐⭐⭐ 預算充足 |

---

## 🎯 當前狀態 vs 完整系統

### 目前（已完成）✅
- ✅ 資料庫版本管理系統
- ✅ 費率查詢 API（支援歷史查詢）
- ✅ 手動更新資料庫的能力
- ✅ 費率透明化顯示

### 需要實作（可選）🔨
- ⏳ 自動爬蟲系統
- ⏳ 變更檢測邏輯
- ⏳ 通知機制（Email/Slack）
- ⏳ 管理後台審核介面
- ⏳ 定期排程

---

## 💡 實際建議

### 對於個人專案或 MVP
**使用手動更新** 
- 設定日曆提醒每年 2-3 月檢查
- 執行 SQL 更新資料庫
- 簡單可靠，成本為零

### 對於生產環境或商業應用
**實作完整爬蟲系統**
- 投資 4-6 天開發時間
- 自動檢測 + 人工審核雙保險
- 長期降低維護成本

### 對於企業級應用
**訂閱第三方 API**
- 最高準確性和可靠性
- 無需自己維護
- 專注核心業務邏輯

---

## 🔔 關鍵提醒

### 費率更新時間表（日本）
- **2月下旬**：協會けんぽ公布下年度費率
- **3月1日**：新健康保險費率生效
- **4月1日**：新雇用保險費率生效

### 監控重點
1. 協會けんぽ官網（都道府県別）
2. 厚生勞動省雇用保險頁面
3. 年金機構網站（厚生年金通常固定）

### 資料來源
- 協會けんぽ: https://www.kyoukaikenpo.or.jp/
- 厚生勞動省: https://www.mhlw.go.jp/
- 日本年金機構: https://www.nenkin.go.jp/

---

## ✅ 結論

你的計算器**已經有完整的費率版本管理基礎**，可以：

1. **現在立即使用**：手動更新足夠應付 MVP 階段
2. **未來擴展**：隨時可以加入自動爬蟲系統
3. **彈性選擇**：根據規模和預算選擇最適合的方案

**核心優勢已實現：** 資料庫設計支援版本管理，比原計算器強太多！🎉

---

**相關文檔：**
- 📄 完整設計：`RATE_UPDATE_SYSTEM.md`
- 💻 示範代碼：`packages/backend/src/services/rateCrawler.ts`
- 🔧 管理 API：`packages/backend/src/routes/admin.ts`
