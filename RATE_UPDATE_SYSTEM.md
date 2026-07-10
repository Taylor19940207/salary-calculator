# 費率自動更新系統設計文件

## 🎯 目標

建立自動化系統，定期檢查日本官方網站的保險費率更新，並通知管理員審核後自動更新資料庫。

---

## 🏗️ 系統架構

```
┌─────────────────────────────────────────────────────────┐
│                    定期排程 (Cron)                       │
│                   每天 3:00 AM 執行                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   爬蟲系統 (Crawler)                     │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ 協會けんぽ   │  │ 厚生勞動省   │  │ 日本年金機構 │    │
│  │  健康保險    │  │  雇用保險    │  │   厚生年金   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│               變更檢測 (Change Detection)                │
│  • 比對資料庫現有費率                                     │
│  • 識別新增/變更的費率                                    │
│  • 記錄到 rate_update_log                                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│               通知系統 (Notification)                     │
│  • Email 通知管理員                                       │
│  • Slack/Discord Webhook                                 │
│  • 管理後台紅點提示                                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│               人工審核 (Manual Review)                    │
│  • 管理員登入後台查看待審核項目                            │
│  • 確認費率來源和數值正確性                                │
│  • 批准或拒絕變更                                         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│               資料庫更新 (Auto Update)                    │
│  • 批准後自動寫入 insurance_rates                         │
│  • 設定舊費率的 effective_to                              │
│  • 新費率 effective_from 為當天或指定日期                  │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 實作方案

### 方案 A：爬蟲 + 人工審核（推薦）⭐

**優點：**
- ✅ 自動檢測更新
- ✅ 人工審核確保準確性
- ✅ 可追溯變更歷史
- ✅ 降低錯誤風險

**缺點：**
- ⚠️ 需要維護爬蟲（網站結構變更時）
- ⚠️ 仍需人工介入

**適合場景：** 生產環境，對準確性要求高

---

### 方案 B：官方 API（理想但不可行）

**說明：**
日本政府機構通常**不提供公開 API**，需要爬蟲解析。

**如果未來有 API：**
```typescript
// 理想狀態
const rates = await fetch('https://api.kyoukaikenpo.go.jp/rates/2026')
  .then(res => res.json());
```

---

### 方案 C：第三方資料服務

**說明：**
訂閱專業的稅務/人事法規資料服務。

**範例服務：**
- freee API（日本會計軟體）
- SmartHR API（人事系統）
- 專門的稅務資料供應商

**優點：**
- ✅ 即時更新
- ✅ 高準確性
- ✅ 無需維護爬蟲

**缺點：**
- ❌ 需要付費
- ❌ 依賴第三方

---

### 方案 D：手動更新 + 提醒（目前狀態）

**說明：**
設定日曆提醒，每年 3 月和 4 月手動檢查官網並更新。

**優點：**
- ✅ 簡單可靠
- ✅ 無技術複雜度

**缺點：**
- ❌ 完全依賴人工
- ❌ 容易遺漏

---

## 🔧 爬蟲技術細節

### 1. 爬取協會けんぽ（健康保險）

**挑戰：**
- 費率表通常是 **PDF 格式**
- 47 個都道府県各有不同費率
- 網站結構可能變更

**解決方案：**
```typescript
import pdf from 'pdf-parse';
import axios from 'axios';

async function parsePrefecturePDF(url: string) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const data = await pdf(response.data);
  
  // 使用正則表達式解析費率
  const rateMatch = data.text.match(/健康保険料率\s+(\d+\.\d+)%/);
  
  if (rateMatch) {
    return parseFloat(rateMatch[1]);
  }
  
  return null;
}
```

### 2. 爬取厚生勞動省（雇用保險）

**特點：**
- 通常在 HTML 頁面或 PDF
- 全國統一費率（分一般/農林/建設）

**解決方案：**
```typescript
import cheerio from 'cheerio';

async function scrapeUnemploymentRate() {
  const response = await axios.get(MHLW_URL);
  const $ = cheerio.load(response.data);
  
  // 查找特定文字模式
  const rateText = $('table:contains("一般の事業")').text();
  const match = rateText.match(/(\d+)\/1,000/);
  
  if (match) {
    return parseInt(match[1]) / 10; // 轉換為百分比
  }
  
  return null;
}
```

### 3. 反爬蟲對策

**問題：**
- 網站可能有 rate limiting
- 可能需要 cookies/session

**解決方案：**
```typescript
// 添加延遲
await sleep(2000); // 2秒延遲

// 使用真實的 User-Agent
axios.defaults.headers.common['User-Agent'] = 
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

// 設定請求間隔
const queue = new PQueue({ 
  interval: 5000,  // 每5秒
  intervalCap: 1   // 最多1個請求
});
```

---

## 📅 排程策略

### 定期排程

```typescript
import cron from 'node-cron';

// 每天凌晨 3:00 執行
cron.schedule('0 3 * * *', runCrawler);

// 每月 1 號 4:00 執行（費率通常月初更新）
cron.schedule('0 4 1 * *', runCrawler);

// 每年 2 月 28 日（3月費率發布前）
cron.schedule('0 5 28 2 *', runCrawler);
```

### 手動觸發

```bash
# CLI 指令
npm run crawler:run

# 或透過 API
curl -X POST http://localhost:3001/admin/crawler/run \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## 🔔 通知機制

### Email 通知

```typescript
import nodemailer from 'nodemailer';

async function sendEmailNotification(changes) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.ADMIN_EMAIL,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  await transporter.sendMail({
    from: 'salary-calculator@example.com',
    to: process.env.ADMIN_EMAIL,
    subject: `🔔 保險費率更新檢測 - ${changes.length} 項變更`,
    html: generateEmailHTML(changes)
  });
}
```

### Slack 通知

```typescript
async function sendSlackNotification(changes) {
  await axios.post(process.env.SLACK_WEBHOOK_URL, {
    text: `🔔 檢測到 ${changes.length} 項費率變更`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: changes.map(c => 
            `• ${c.rateType}: ${c.newRate}%`
          ).join('\n')
        }
      }
    ]
  });
}
```

---

## 🎛️ 管理後台介面

### 待審核清單

```
┌─────────────────────────────────────────────────────────┐
│ 待審核的費率變更                              🔴 3 項待審  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ▶ 健康保險（東京都）                                     │
│   舊費率: 9.85%  →  新費率: 10.00%                      │
│   生效日期: 2026-03-01                                   │
│   來源: https://www.kyoukaikenpo.or.jp/...              │
│   信心度: ⭐⭐⭐ Medium                                    │
│   爬取時間: 2026-07-04 03:05                             │
│                                                          │
│   [✅ 批准]  [❌ 拒絕]  [👁️ 查看來源]                      │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ ▶ 雇用保險（全國）                                       │
│   舊費率: 1.40%  →  新費率: 1.35%                       │
│   ...                                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 監控與日誌

### 關鍵指標

```typescript
interface CrawlerMetrics {
  lastRunTime: Date;
  successRate: number;
  averageRunDuration: number;
  ratesScraped: number;
  changesDetected: number;
  errorCount: number;
}
```

### 日誌範例

```
2026-07-04 03:00:00 [INFO] Starting rate crawler
2026-07-04 03:00:15 [INFO] Scraped Kyoukaikenpo: 47 prefectures
2026-07-04 03:00:45 [INFO] Scraped MHLW: 1 rate
2026-07-04 03:01:00 [INFO] Detected 2 changes
2026-07-04 03:01:05 [INFO] Sent notification to admin
2026-07-04 03:01:10 [INFO] Crawler completed successfully
```

---

## 🚀 實作步驟

### Phase 1: 基礎爬蟲（1-2天）
```bash
npm install cheerio axios pdf-parse node-cron
```

- [ ] 實作協會けんぽ爬蟲
- [ ] 實作厚生勞動省爬蟲
- [ ] 測試 PDF 解析

### Phase 2: 變更檢測（1天）
- [ ] 比對資料庫現有費率
- [ ] 記錄變更到 rate_update_log
- [ ] 單元測試

### Phase 3: 通知系統（0.5天）
- [ ] Email 通知
- [ ] Slack Webhook
- [ ] 測試通知機制

### Phase 4: 管理後台（1-2天）
- [ ] 待審核清單頁面
- [ ] 批准/拒絕 API
- [ ] 手動觸發爬蟲按鈕

### Phase 5: 排程與監控（0.5天）
- [ ] 設定 Cron Job
- [ ] 健康檢查端點
- [ ] 錯誤告警

**總計：4-6天開發時間**

---

## ⚠️ 風險與對策

| 風險 | 影響 | 對策 |
|------|------|------|
| 官網結構變更 | 爬蟲失效 | 監控錯誤率，人工備援 |
| PDF 格式變更 | 解析失敗 | 多種解析策略，降級處理 |
| 反爬蟲機制 | 被封鎖 | 合理請求頻率，使用代理 |
| 資料不準確 | 計算錯誤 | 人工審核，多來源交叉驗證 |

---

## 💡 最佳實踐

1. **冗餘設計** - 多個資料來源互相驗證
2. **人工審核** - 關鍵變更必須經過人工確認
3. **版本追溯** - 保留所有歷史費率和變更記錄
4. **降級策略** - 爬蟲失敗時仍能正常運作
5. **透明化** - 向用戶顯示費率更新日期

---

## 📖 參考資料

- [協會けんぽ](https://www.kyoukaikenpo.or.jp/)
- [厚生勞動省](https://www.mhlw.go.jp/)
- [日本年金機構](https://www.nenkin.go.jp/)

---

**結論：** 推薦使用**方案 A（爬蟲 + 人工審核）**，在自動化和準確性之間取得平衡。
