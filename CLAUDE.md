# CLAUDE.md — 日本給与手取り計算ツール

> 給 Claude Code 的專案脈絡。換電腦 clone 後，這份會自動被讀進 context。
> 用戶用**繁體中文**溝通（夾雜簡體），公司內部使用的工具，最重視「與紙本稅額表逐円一致」。

## 專案概觀
- 用途：日本給与的手取り（實領）計算 + 給与明細書出力，公司內部使用
- 架構：npm workspaces monorepo
  - `packages/backend` — Express + SQLite + tsx
  - `packages/frontend` — React + Vite + Tailwind
- GitHub: https://github.com/Taylor19940207/salary-calculator （main 分支）
- 部署：Render（Golf/Hobby workspace、免費 instance、**目前無 Basic Auth**，開放試用中）

## 換電腦 / 首次啟動
```bash
git clone https://github.com/Taylor19940207/salary-calculator.git
cd salary-calculator
npm install
npm run dev        # 前後端一起起（背景執行）
```
- 需要 **Node 20+**
- `.env` 非必要（不在 git 內，內容只有 localhost 佔位值，無機密）。實際跑用 SQLite，靠 `DATABASE_PATH`。
- 本地 dev server 常被外部停掉，重啟就再 `npm run dev`

## 已完成功能
- 單一計算 + 批量計算（最多 100 人）
- 總費率 + 員工負擔並列顯示；健保/厚年等級顯示
- 加班（1.25 / 1.35 / 深夜 1.25）、欠勤控除（日割 = 月給 ÷ 所定日數）、**月所定労働時間可調**（預設 160h，影響基準時給與欠勤日割）
- 通勤手当（非課稅・計入社保基數）、**出張手当（非課稅・不計入社保與雇用保險基數）**、その他手当
- **社保等級手動選擇**（下拉 1–50 級，`/api/grades`，`manualGrade` 參數）
- **給与支払明細書出力**（`Payslip.tsx`，青綠色四段式模板，React portal + `@page margin:0` 實現單頁乾淨 PDF 列印）

## 費率與計算的正確性基準（都經實測驗證，令和8年度 / R8-2026）
- 厚生年金 18.3%、雇用保險 1.35%（勞 0.5%）、介護保險 1.62%、子育て支援金 0.23%
- **全 47 都道府縣**健保費率（協会けんぽ R8，新潟 9.21%～佐賀 10.55%），47 縣全件用 API 對照官方表驗證過
- 所得稅：**令和8年分 源泉徴収税額表（月額表甲欄）查表制** — 資料在 `packages/backend/src/services/incomeTaxTable2026.ts`（從國稅廳官方 Excel 機械抽取，231 級距 × 8 扶養 + 高額 anchor）。**特意選查表制**（非電算機特例）以與紙本稅額表 / 年末調整逐円一致。
- 標準報酬月額等級表全 50 級；厚生年金等級 = 健保等級 − 3（夾 1–32），上限 65 萬
- 保險費尾數：50 銭以下切捨て・50 銭超切上げ
- 介護保險 40～64 歲限定（65 歲起不從給与扣），邊界已實測

## 每年費率更新方法
- 改 `packages/backend/src/db/setup.ts` 後重新部署
- 時程：3 月健保/介護、4 月雇用保險；稅額表年度改版時 `incomeTaxTable2026.ts` 也要換
- DB 無需持久化：啟動時自動 migrate + seed（冪等，靠 `schema.sql` 的 unique index 防重複）

## 部署踩過的坑（Render）
- Render 會自動注入 `NODE_ENV=production`，害 `npm ci` 跳過 devDependencies → build 失敗
- 解法：buildCommand 必須是 `npm ci --include=dev && npm run build`（已寫入 `render.yaml`）
- Render 環境變數目前只設 `DATABASE_PATH=/tmp/salary_calculator.db`
- 要綁認證：程式已支援，Render Environment 加 `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` 兩個變數即啟用

## 待辦 / 下一步
- 月所定時間自動帶入（依該月營業日 × 8h ＋日本祝日表）
- 住民稅
- rateCrawler / scheduler 自動更新費率（有雛形未完成）
- 明細模板的空欄位（資格手当 / 住宅手当等）
- 試用回饋後可能綁 Basic Auth

## 驗證偏好
- 抓官方 PDF/Excel 當 oracle、用 API 全件對照、playwright 模擬操作驗證列印
- 對照競品：salaryagent.itbank.co.jp（其高薪所得稅 74 萬以上有 bug、尾數處理不合規，不可盲信）
