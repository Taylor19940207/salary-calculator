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
- **雇用保険獨立於社保開關**：`enrollInUnemploymentInsurance`（單人/多人/CSV `雇用保険` 欄，省略＝加入・後方互換）。雇用保険與健保/厚年/介護（`enrollInInsurance`）是不同制度，法人代表・役員原則上有社保但不能加入雇用保険，UI 用獨立下拉「一般被保険者／未加入（法人代表・役員など）」。`salaryCalculator.ts`（月給）與 `bonusCalculator.ts`（賞与）內雇用保険計算都已從 `enrollInInsurance` 判斷拆出（賞与端原本也綁在一起，是這次一併修的缺口）；単人表單的雇用保険下拉值會沿用給賞与共用（賞与不單獨再問一次）
- **住民税（特別徴収・轉記制）**：`residentTax` 月額輸入欄（單人/多人/CSV `住民税` 欄），照決定通知書填、照扣進控除、印上明細。**刻意不做試算**（住民稅依前年所得由市區町村核定，試算做不到逐円一致；前年收入推定計算器記在待辦，僅在有 offer 試算需求時再評估）。不影響所得稅/社保計算，vitest 有隔離性測試
- **健保・介護・子育て支援金＝表內原生小數顯示＋金額可手動編輯**（客戶需求：協会けんぽ料額表折半額原生帶小數，各家客戶端數處理不同——法源是「給与天引き=50銭以下切捨て・超切上げ／労使特約があれば特約優先」三規並存，所以不存在唯一取整正解）。實作：後端 `deductionsRaw`（取整前原生值，`round2()` 防浮點誤差）＋ `breakdown.deductions[].rawAmount`；前端 `format.ts` 的 `mergedSalaryDeductions()`/`mergedBonusDeductions()` 合成顯示值（三項＝原生值或用戶上書き、其餘＝法定值），`EditableAmount.tsx` 讓三項金額**直接可編輯**（附「表の値に戻す」），合計/手取/PDF/CSV 全部跟編輯後的值走，再計算時重置。**厚年（月給等級全偶數千×91.5円/千＝必為整數，全32級驗證過）・雇用（50銭規則取整後＝徵收額）・所得税・住民税固定不可編輯**；所得税依法永遠用法定取整後社保算課稅所得，顯示編輯不影響稅額。賞与厚年端數恆為 .5（91.5×奇數千）恆切捨て。多人版 overrides 給与按行、賞与按従業員コード各自記憶。CSV 匯出＝前端先套用 merged 值再送後端，整數印整數、有端數印小數2位
- **給与支払明細書出力**（`Payslip.tsx`，青綠色四段式模板，React portal + `@page margin:0` 實現單頁乾淨 PDF 列印）
- **明細書 Excel 出力**：Payslip toolbar「Excel出力」鈕 → `POST /api/payslip-xlsx`（`routes/payslipXlsx.ts`，exceljs）產出**與 PDF 同版面**的 .xlsx（teal 四段模板、合併儲存格、A4 橫式 fit-to-page），有賞与時第 2 個工作表。值與畫面/PDF/CSV 同一套 merged 值（含端數手動調整）。前端只送 layout 好的 payload（`Payslip.tsx` handleExcel 複用畫面同一份 rows、賞与行用 `buildBonusRows` 共用），後端純渲染不計算。動機：客戶原本自己手工維護醜 Excel 版明細，給他們一份跟 PDF 一樣漂亮、又能在 Excel 上微調的檔案
- **賞与（ボーナス）計算**：單人/多人表單內「今月は賞与あり」開關（基本情報與給与共用、計算完全分離）。後端 `bonusCalculator.ts` + `POST /api/calculate-bonus`：標準賞与額 1,000 円未満切捨て、健保/介護/子育て年度累計上限 573 萬（`priorFiscalBonusTotal` 手動輸入既払累計）、厚年單次上限 150 萬、雇用保險對**賞与實額**×0.5%、所得稅走「賞与算出率表」甲欄（oracle: `bonusTaxRateTable2026.ts`，國稅廳 15-16.xls 機械抽取，8 扶養×21 帶，全率=基本率×1.021 驗證過）＋特例（前月給与なし/10 倍超 → 月額表÷6×6、期間>6 月÷12×12）。所得稅用整數運算 `floor(x×round(rate×1000)/100000)` 避免浮點逐円誤差。明細＝給与+賞与 1 檔 2 頁（`.payslip-break` 改頁、`BonusPayslipBody.tsx` 無勤怠欄）、賞与支給日為公司層級欄位（可在 Payslip toolbar 逐人覆寫，純顯示不進計算）。批量版集計サマリー給与/賞与分列、賞与靠従業員コード（唯一性有驗證）與行對應。CSV 匯入不支援賞与。

## 費率與計算的正確性基準（都經實測驗證，令和8年度 / R8-2026）
- **健保＋介護＝合算丸め（減算法）**：40〜64 歲該当者的法定「健康保険の保険料」是健保＋介護合算一筆（健康保険法156条），50 銭取整只做一次。實作＝介護單獨取整、健保＝合算取整−介護（業界標準減算法，保持分項顯示）。修正前個別取整在月給 142/1645、賞与約 24% 的組合差 1 円。**已對照 R8 協会けんぽ官方表（東京 R8_13tokyo.pdf）逐欄確認**：該当者欄＝11.47%（健保9.85＋介護1.62，**不含支援金**）、**子育て支援金是官方表獨立一欄 → 單獨取整正確**、573萬上限含支援金/150萬厚年的註記與實作一致、134,000級該当折半額7,684.9等實值已寫入 vitest。
- **保険料全面整數運算**：`employeePremium()`（率×1000 整數、剰余判定 50 銭）。舊的 `base×(rate/100)` 浮點式在恰好 50 銭的邊界會誤進位（例 5,000×0.81%＝40.5 浮點成 40.500000000000006 → 誤切上げ 41），全費率×千円基數掃描有 4,502 個組合中招。與賞与所得稅的整數運算修法同款。
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
- 住民稅試算器（做法 B：前年收入推定、標明參考值。轉記制已完成，B 僅在有 offer 試算需求時做）
- rateCrawler / scheduler 自動更新費率（有雛形未完成）
- 明細模板的空欄位（資格手当 / 住宅手当等）
- 試用回饋後可能綁 Basic Auth

## 驗證偏好
- 抓官方 PDF/Excel 當 oracle、用 API 全件對照、playwright 模擬操作驗證列印
- **vitest**（`packages/backend`，root 跑 `npm test`）：賞与計算 14 案例，in-memory DB（`DATABASE_PATH=':memory:'`）自動 seed。改計算邏輯必跑
- 對照競品：salaryagent.itbank.co.jp（其高薪所得稅 74 萬以上有 bug、尾數處理不合規，不可盲信）
