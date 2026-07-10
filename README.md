# 日本給与手取り計算ツール

正確な保険料率で日本の給与手取り額を計算するWebアプリケーション。

## 🎯 特徴

- ✅ **2026年最新法令対応** - 令和8年度の保険料率を使用
- ✅ **料率透明化** - 使用する料率と計算過程を全て表示
- ✅ **都道府県別対応** - 健康保険料率は都道府県ごとに正確に計算
- ✅ **バージョン管理** - 過去の料率でも正確に計算可能
- ✅ **月給・時給両対応** - 正社員・アルバイト両方に対応
- ✅ **加班費計算** - 残業・休日労働・深夜労働の割増賃金計算

## 🚀 クイックスタート

### 必要環境

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd salary_calculator

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env
# .env ファイルを編集してデータベース接続情報を設定

# データベースをセットアップ
npm run db:migrate
npm run db:seed

# 開発サーバーを起動
npm run dev
```

アプリケーションが起動したら:
- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:3001

## 📁 プロジェクト構造

```
salary_calculator/
├── packages/
│   ├── backend/           # Express + PostgreSQL API
│   │   ├── src/
│   │   │   ├── db/       # データベース関連
│   │   │   ├── services/ # ビジネスロジック
│   │   │   └── types/    # TypeScript型定義
│   │   └── package.json
│   └── frontend/          # React + TypeScript UI
│       ├── src/
│       │   ├── components/
│       │   ├── api.ts
│       │   └── App.tsx
│       └── package.json
├── package.json           # ルート package.json (workspaces)
└── README.md
```

## 🗃️ データベース設計

### 主要テーブル

**insurance_rates** - 保険料率マスタ（バージョン管理対応）
- 都道府県別・料率種別ごとの料率
- effective_from / effective_to で期間管理
- 公式ソースURLと検証情報

**prefectures** - 都道府県マスタ

**standard_remuneration_grades** - 標準報酬月額等級表

## 💡 使用例

### 基本的な月給計算

```
基本給: 300,000円
通勤手当: 10,000円
都道府県: 東京都
年齢: 35歳
給与年月: 2026年5月

→ 手取り額: 約256,800円
```

### 時給 + 加班費計算

```
時給: 1,500円
総労働時間: 160時間
残業: 20時間（×1.25）
→ 手取り額が自動計算される
```

## 🔧 API エンドポイント

### `GET /api/prefectures`
都道府県一覧を取得

### `GET /api/rates?prefecture=13&date=2026-05-01`
指定日時点の保険料率を取得

### `POST /api/calculate`
給与計算を実行

リクエストボディ:
```json
{
  "salaryType": "monthly",
  "baseSalary": 300000,
  "commutingAllowance": 10000,
  "prefecture": "13",
  "salaryMonth": "2026-05",
  "age": 35,
  "dependents": 0,
  "enrollInInsurance": true
}
```

## 🎨 技術スタック

### フロントエンド
- React 18
- TypeScript
- Tailwind CSS
- Vite
- Axios

### バックエンド
- Node.js
- Express
- PostgreSQL
- TypeScript
- Zod (バリデーション)

## 📊 料率データソース

- **健康保険**: [協会けんぽ](https://www.kyoukaikenpo.or.jp/)
- **厚生年金**: [日本年金機構](https://www.nenkin.go.jp/)
- **雇用保険**: [厚生労働省](https://www.mhlw.go.jp/)

## 🔄 料率更新フロー

現在: 手動更新（seed.tsを編集）

将来実装予定:
1. 定期爬虫（毎日実行）
2. 変更検出
3. 管理者通知
4. 人工検証
5. 自動適用

## ⚠️ 注意事項

- 本ツールは**参考値**です
- 実際の給与計算は企業・自治体の通知書をご確認ください
- 住民税は市区町村ごとに異なるため含まれていません
- 所得税の計算は簡略化されています

## 🛠️ 開発コマンド

```bash
# 開発サーバー起動（フロント+バック同時）
npm run dev

# フロントエンドのみ
npm run dev:frontend

# バックエンドのみ
npm run dev:backend

# ビルド
npm run build

# データベースマイグレーション
npm run db:migrate

# データベースシード
npm run db:seed
```

## 📝 環境変数

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/salary_calculator

# Server
PORT=3001
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:3001
```

## 🚧 今後の予定

- [ ] 全47都道府県の料率データ追加
- [ ] 料率自動更新システム
- [ ] 住民税概算機能
- [ ] PDF出力機能
- [ ] 複数月比較機能
- [ ] 管理画面
- [ ] REST API公開

## 📄 ライセンス

MIT License

## 🤝 コントリビューション

Issue・PRを歓迎します！

1. Fork する
2. Feature ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Pull Request を作成

---

Made with ❤️ to provide accurate salary calculations for Japan
