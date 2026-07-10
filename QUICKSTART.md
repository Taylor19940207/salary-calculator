# 快速啟動指南

## 🚀 5分鐘快速啟動

### 前提條件
- Node.js 18+ 已安裝
- 終端機/命令提示字元

### 步驟

```bash
# 1. 進入專案目錄
cd /Users/wutsohao/salary_calculator

# 2. 安裝依賴（如果還沒安裝）
npm install

# 3. 初始化資料庫
npm run db:migrate
npm run db:seed

# 4. 啟動開發伺服器
npm run dev
```

### 訪問應用

- **前端介面**: http://localhost:3000
- **後端 API**: http://localhost:3001
- **API 健康檢查**: http://localhost:3001/api/health

### 測試功能

1. 打開瀏覽器訪問 http://localhost:3000
2. 輸入測試數據:
   - 基本給: 300,000 円
   - 通勤手当: 10,000 円
   - 都道府県: 東京都
   - 給與年月: 2026-05
   - 年齡: 35
3. 點擊「計算する」
4. 查看詳細計算結果

---

## 📊 驗證結果正確性

### API 測試

```bash
# 測試計算 API
curl -X POST http://localhost:3001/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "salaryType": "monthly",
    "baseSalary": 300000,
    "commutingAllowance": 10000,
    "otherAllowances": 0,
    "prefecture": "13",
    "salaryMonth": "2026-05",
    "age": 35,
    "dependents": 0,
    "enrollInInsurance": true
  }'
```

### 預期結果

```json
{
  "grossSalary": 310000,
  "standardMonthlyRemuneration": 320000,
  "deductions": {
    "healthInsurance": 16000,
    "employeePension": 29280,
    "unemployment": 1550,
    "childSupport": 368,
    "incomeTax": 13000,
    "total": 60198
  },
  "netSalary": 249802
}
```

---

## 🔍 對比原計算器

| 項目 | 原計算器 | 我們的計算器 | 差異 |
|------|---------|------------|------|
| 健康保險費率 | 9.85% | 10.0% | **原計算器過時** |
| 手取額 | ¥256,822 | ¥249,802 | -¥7,020 |

**結論**: 原計算器使用過時費率，導致高估手取額約 7,020 円/月

---

## 🛠️ 其他指令

```bash
# 僅啟動後端
npm run dev:backend

# 僅啟動前端
npm run dev:frontend

# 重置資料庫
npm run db:migrate
npm run db:seed

# 查看資料庫內容
sqlite3 packages/backend/data/salary_calculator.db "SELECT * FROM insurance_rates;"
```

---

## 📁 重要文件

- `README.md` - 完整專案說明
- `PROJECT_SUMMARY.md` - 專案完成總結
- `COMPARISON.md` - 與原計算器的詳細對比
- `plan.md` - 原始技術規劃文件

---

## ⚠️ 疑難排解

### 問題: 端口已被占用
```bash
# 檢查端口使用情況
lsof -i :3000
lsof -i :3001

# 終止佔用的進程
kill -9 <PID>
```

### 問題: 資料庫文件不存在
```bash
# 重新初始化
rm -f packages/backend/data/salary_calculator.db
npm run db:migrate
npm run db:seed
```

### 問題: 依賴安裝失敗
```bash
# 清理並重新安裝
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules packages/*/package-lock.json
npm install
```

---

## ✨ 功能亮點

✅ **月薪/時薪雙模式** - 支援正職和兼職  
✅ **加班費計算** - 1.25x, 1.35x 倍率  
✅ **費率透明化** - 顯示完整計算過程  
✅ **資料來源** - 提供官方連結  
✅ **響應式設計** - 支援各種螢幕尺寸  
✅ **即時計算** - 無需刷新頁面  

---

## 📞 需要幫助？

查看詳細文檔:
- 技術架構: `README.md`
- 開發規劃: `plan.md`
- 對比分析: `COMPARISON.md`

**專案已就緒，立即開始使用！** 🎉
