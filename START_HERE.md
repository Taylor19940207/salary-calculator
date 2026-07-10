# 🚀 從這裡開始

歡迎使用**日本給與手取り計算ツール**！

## ⚡ 3 步驟快速啟動

### 步驟 1：啟動服務
```bash
cd /Users/wutsohao/salary_calculator
npm run dev
```

### 步驟 2：訪問應用
打開瀏覽器訪問：**http://localhost:3000**

### 步驟 3：開始計算
- 點擊「単一計算」進行個人薪資計算
- 點擊「批量計算」進行多人薪資計算

---

## 📚 需要更多幫助？

- **快速指南：** QUICKSTART.md
- **完整說明：** README.md
- **批量功能：** BATCH_CALCULATION.md
- **所有文檔：** INDEX.md

---

## ✅ 系統檢查

確認以下服務正常運行：

```bash
# 檢查後端
curl http://localhost:3001/api/health

# 應該看到：{"status":"ok",...}
```

---

## 🎯 快速測試

測試單一計算：
```bash
curl -X POST http://localhost:3001/api/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "salaryType": "monthly",
    "baseSalary": 300000,
    "commutingAllowance": 10000,
    "prefecture": "13",
    "salaryMonth": "2026-05",
    "age": 35,
    "dependents": 0,
    "enrollInInsurance": true
  }'
```

測試批量計算：查看 BATCH_CALCULATION.md

---

## ❓ 遇到問題？

1. 確認 Node.js 18+ 已安裝
2. 確認端口 3000 和 3001 未被佔用
3. 查看 QUICKSTART.md 的疑難排解部分

---

**開始使用吧！** 🎉
