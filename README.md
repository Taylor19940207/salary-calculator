# 日本給与手取り計算ツール

日本の給与・賞与の手取り額を計算し、給与明細書（PDF / Excel）を出力する社内向けWebアプリケーション。

**最重要の設計方針: 紙の税額表・協会けんぽ保険料額表と1円単位で一致すること（逐円一致）。**

## 🎯 特徴

### 計算
- ✅ **令和8年度（2026）法令対応** — 全47都道府県の協会けんぽ健康保険料率
- ✅ **所得税は査表制** — 令和8年分 源泉徴収税額表（月額表・甲欄）を機械抽出して使用。電算機特例ではなく査表制のため、紙の税額表・年末調整と1円単位で一致
- ✅ **賞与（ボーナス）計算** — 給与とは別経路（標準賞与額・賞与算出率表・特例2種）。給与明細と賞与明細を1ファイル2ページで出力
- ✅ **健保＋介護の合算丸め** — 介護該当者（40〜64歳）は健康保険法156条どおり合算額で端数処理（減算法で分項表示）。保険料は全て整数演算で浮動小数点誤差を排除
- ✅ **端数（小数）の手動調整** — 健保・介護・子育て支援金は保険料額表の丸め前の値を表示し、各社の労使特約に合わせて金額を直接編集可能（合計・PDF・CSVに連動）
- ✅ **雇用保険は社会保険と独立** — 法人代表・役員（社保あり・雇用保険なし）に対応
- ✅ **住民税（特別徴収）** — 決定通知書の月割額を転記（計算はしない＝逐円一致）
- ✅ 月給・時給、残業（1.25/1.35/深夜1.25）、欠勤控除、月所定労働時間、通勤・出張・その他手当、社保等級の手動指定（1〜50級）

### 出力・UI
- ✅ **給与支払明細書 / 賞与支払明細書** — 青緑4段テンプレート、A4横1ページのPDF印刷
- ✅ **Excel出力** — PDFと同じレイアウトの .xlsx（顧客がExcel上で微調整できる）
- ✅ **複数人計算（最大100人）** — タブ式フォーム、CSV取込/出力、集計サマリー（給与・賞与分列）
- ✅ モバイル対応

## 🚀 クイックスタート

必要環境: **Node.js 20+**（データベースはSQLite・自動セットアップのため別途インストール不要）

```bash
git clone https://github.com/Taylor19940207/salary-calculator.git
cd salary-calculator
npm install
npm run dev   # フロント + バックエンド同時起動
```

- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:3001
- DBは起動時に自動で migrate + seed（冪等）。`.env` は不要（`DATABASE_PATH` で保存先を変更可能）

```bash
npm test          # バックエンドのテスト（vitest・インメモリDB）
npm run build     # ビルド
```

## 📁 プロジェクト構造

```
salary_calculator/
├── packages/
│   ├── backend/            # Express + SQLite + TypeScript (tsx)
│   │   └── src/
│   │       ├── db/         # スキーマ・自動migrate/seed（料率マスタはここ）
│   │       ├── routes/     # batch / payslip-xlsx
│   │       ├── services/   # salaryCalculator / bonusCalculator /
│   │       │               # incomeTaxTable2026 / bonusTaxRateTable2026（税額表oracle）
│   │       └── types/
│   └── frontend/           # React + TypeScript + Tailwind + Vite
│       └── src/components/ # SalaryForm / BatchCalculator / Payslip ほか
├── CLAUDE.md / AGENTS.md   # AIエージェント向けのプロジェクト全文脈
└── docs/使用説明.md         # エンドユーザー向け使用説明（繁体字中国語）
```

## 🔧 主なAPIエンドポイント

| エンドポイント | 内容 |
|---|---|
| `POST /api/calculate` | 給与計算 |
| `POST /api/calculate-bonus` | 賞与計算（標準賞与額・算出率表・特例） |
| `POST /api/calculate/batch` | 複数人一括計算（最大100人） |
| `POST /api/calculate/import-csv` / `export-csv` | CSV取込・出力 |
| `POST /api/payslip-xlsx` | 明細書のExcel出力（PDFと同テンプレート） |
| `GET /api/prefectures` / `GET /api/grades` | 都道府県・標準報酬月額等級 |

## 📊 計算の正確性（実測検証済み）

- 全47都道府県の健康保険料率を公式表と全件照合
- 協会けんぽ保険料額表の実値（該当者欄の合算折半額など）をテストに固定
- 国税庁の賞与計算例・境界値（1,000円切捨て、50銭両側、573万/150万上限、扶養7人超、特例10倍境界など）を単体テスト＋APIバッテリーで検証
- 料率データソース: [協会けんぽ](https://www.kyoukaikenpo.or.jp/) / [日本年金機構](https://www.nenkin.go.jp/) / [厚生労働省](https://www.mhlw.go.jp/) / [国税庁](https://www.nta.go.jp/)

## 🔄 年次の料率更新

- `packages/backend/src/db/setup.ts` を編集して再デプロイ（3月: 健保・介護 / 4月: 雇用保険）
- 税額表の年度改版時は `incomeTaxTable2026.ts` / `bonusTaxRateTable2026.ts` を差し替え

## ☁️ デプロイ（Render）

- `render.yaml` 設定済み。buildCommand は `npm ci --include=dev && npm run build`（RenderはNODE_ENV=productionを注入しdevDependenciesをスキップするため）
- 環境変数: `DATABASE_PATH=/tmp/salary_calculator.db`。Basic認証は `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` を設定すると有効化

## ⚠️ 注意事項

- 本ツールは**参考値**です。実際の給与計算は会社の決定等級・自治体の通知書をご確認ください
- 住民税は自前計算せず、特別徴収税額決定通知書の月割額を入力する方式です（前年所得ベースのため試算は逐円一致が不可能）

## 🚧 今後の予定

- [ ] 月所定労働時間の自動算出（営業日×8h＋日本の祝日）
- [ ] 住民税の参考試算（前年収入ベース・参考値明記）
- [ ] 料率の自動クロール・更新
- [ ] 明細テンプレートの空欄項目（資格手当・住宅手当等）

## 📄 ライセンス

MIT License
