## コミュニケーションと言語方針

- このリポジトリに関する設計・実装・レビュー・ドキュメント・コミットメッセージ・Issue/PR 上のやりとりは、基本的に「日本語」で行います。
- AI/エージェントを利用する場合も、日本語で思考し、日本語でコミュニケーションすることを原則とします（プロンプト・出力・要約・議事録など）。
- 例外として、外部サービスや OSS への報告など、英語が適切な場面では英語を用いて構いません。その場合も、必要であれば日本語で補足説明を添えてください。

---

## 開発規約（DB スキーマ命名）

- DB（PostgreSQL/Neon）上のテーブル名・カラム名は基本的に `snake_case` とします。
- アプリケーション（TypeScript/Prisma モデル）側は `camelCase` を用います。
- Prisma では、以下のとおり `@@map`（テーブル名）と `@map`（カラム名）で命名を対応させます。

例（抜粋）:

```prisma
model User {
  id              String    @id @default(cuid())  @map("id")
  email           String    @unique               @map("email")
  emailVerifiedAt DateTime?                       @map("email_verified_at")
  createdAt       DateTime  @default(now())       @map("created_at")
  updatedAt       DateTime  @updatedAt            @map("updated_at")

  @@map("users")
}
```

この方針により、

- DB 側は一般的な SQL 流儀（snake_case）に合わせた運用が可能
- アプリ側は TypeScript の慣習（camelCase）で読みやすく保てます

今後、新規テーブル/カラムを追加する際もこの方針を踏襲してください。

---

## DB 運用方針（フォールバック禁止）

- データベースの起動や接続に関して、フォールバック（例: 自動で `docker compose up -d` を実行、`DATABASE_URL` 未設定時にローカル値を自動補完 など）は原則禁止。
- DB が起動していない、または `DATABASE_URL` で接続できない環境では、処理を失敗させて原因を即時に顕在化させること。
- 必要な環境変数・起動手順は README やエラーメッセージで明示する。
- マイグレーションやシードは「接続可能な環境が前提」で手動または明示的なスクリプトから実行する。

### テスト環境（E2E）における方針（重要）

- 環境構築系のフォールバックは一切しない（DB/サーバ/ポート/CORS/better-auth origin 等）。
- テスト用Webサーバは専用設定で起動し、`E2E_BASE_URL` と `CORS_ALLOWED_ORIGINS` を一致させる（例: `http://localhost:3000`）。
- 認証はセットアップフェーズで UI 経由で一度だけログインし、`storageState` を使い回す。失敗時は即座にテスト失敗とする。

---

## 画面仕様ドキュメント化ルール

- 画面単位で仕様を `docs/specs/` に配置し、URL 構造に沿って分割する（Next.js の Page Router を参考）。
- 記述規約は `docs/specs/rule.md` を参照（Front Matter 必須キー: `title/description/route/status`。`route`は`page/`配下のみ必須）。
- 各ファイルには最低限、以下を記述すること:
  - 各画面でできること概要
  - 各種コンポーネントの機能/表示項目詳細
  - 表示項目の計算ロジック（参照 API や DB 式を明記）
- 仕様からの提案や差分がある場合は「提案」節を設け、背景・理由を明記の上、議論・意思決定の記録を適宜残す。

---

## ドキュメント先行の開発フロー（Issues/Specs）

本プロジェクトは「非エンジニアでも進められるドキュメント先行開発」を採用します。人間が要件を伝え、AI/エージェントが調査・設計・タスク分解を文書化した上で実装します。

### 1) 要件受領 → Issue ひな形作成（必須）

- ディレクトリ命名: `docs/issues/{NNN}_{slug}/`（`NNN`=3桁ゼロ詰め、`slug`=kebab-case）
- 初期ファイル（4点セット）を作成:
  - `requirements.md`（背景/目的/スコープ/入出力/受け入れ基準）
  - `design.md`（方針/データ流れ/API I/O/UI骨子/代替案/影響範囲）
  - `status.md`（議論ログ/決定事項/未決・確認事項/リスク）
  - `tasks.md`（フェーズ分割とチェックリスト）
- 採番ルール（自動）:
  - 新規Issue番号は、明示指定が無い場合に限り「既存の最大 `NNN` + 1」を自動採番する（3桁ゼロ詰め）。
  - 例: 既存の最大が `013_*` なら次は `014_{slug}`。
  - 競合回避: 生成直前に `docs/issues/*` を再スキャンし、重複があれば +1 して再試行。
  - 欠番は埋めない（整合性維持）。
- コミット例:
  - `chore(docs): 013_docs-update issue scaffold`
  - `docs(issues): 013 requirements/design 初期作成`

### 2) 事前調査 → 不明点の確認（合意前に立ち止まる）

- 既存コード・ドキュメント・関連Issueを横断調査して、`status.md` の「確認事項」に列挙。
- 影響が大きい不確実点は人間に確認してから次へ進む（質問と想定案をセットで提示）。

### 3) 仕様の具体化（SSOT: `docs/specs/*` を先に更新）

- 実装に先立ち、対応する `docs/specs/page/**` を更新。Front Matter（`title/description/route/status`）を満たすこと。
- 実装との差分や将来提案は、画面仕様内に「提案」節、または近傍の `status.md` に「確認ポイント」として明示。実装を先に変えない。

### 4) TDD で前進（Red→Green→Refactor）

- 仕様合意後、まず失敗するテストを追加（ユニット優先、結合/E2E は最小）。
- 最小実装でグリーン化し、リファクタはテストがグリーンのまま実施。

### 5) フェーズ毎にコミット（`tasks.md` と同期）

- `tasks.md` は「Phase 1/2/…」で段階分けし、完了時にチェックを入れる。
- 典型フェーズ:
  - Phase 1: 調査・ひな形作成（Issue 4点セット）
  - Phase 2: specs 更新・合意（必要なら `status.md` で論点整理）
  - Phase 3: 実装（最小）・テスト
  - Phase 4: ドキュメント最終化・振り返り
- コミットは小さく原子的に。例: `feat(api): operations/monthly GET 期間パラメータを厳格化`、`docs(specs): operations/monthly 提案(Factoryフィルタ)追記`

### 6) 人間確認のタイミング（まとめて効率的に）

- 実装段階では、人間の判断が必要になる直前までをまとめて進め、`status.md` の「確認事項」を根拠リンク付きで提示。
- 画面仕様の乖離がある場合は「実装せず、確認ポイントへ記録」が原則。

### 7) 画面仕様（page/）と確認ポイントの運用

- `docs/specs/page/**` は SSOT（仕様本文）。議論・未決・差分は `docs/issues/{NNN}_{slug}/status.md` に集約し、specs配下には置かない。
- 実装と乖離が出た際は、まず本Issueの `status.md` に論点を記録→合意→specs更新→実装の順で進める。

---

### docs/draft ディレクトリ（要件ドラフト保管庫）

- 目的: PM/開発で要件をたたき台として検討するためのドラフト文書置き場。
- 配置: `docs/draft/001_xxx.md` のように通番＋短いスラッグで作成（Front Matter: `title/status/owner` 推奨）。
- 内容: `issues/*/requirements.md` 相当（背景/目的/機能要件/非機能/API I/O/計算式/テスト/ロールアウト/未決事項）。
- フロー: draft で合意 → Issues へ正式展開（`docs/issues/<ID>/requirements.md` へ移動/コピー）→ specs 更新 → 実装/TDD。
- 注意: `docs/specs/*` が SSOT。draft は合意前の作業領域として扱い、実装の根拠には直接しない。

### 仕様先行・実装プロセス（重要・必ず遵守）

- 仕様（docs/specs/\*）は単なるメモではなく「唯一のソース・オブ・トゥルース」。実装やテストの根拠は常に specs を参照する。
- 変更リクエストが発生した場合は、まず specs を更新し、計算式・参照テーブル/カラム・入出力（API I/O）を具体化する。
- 仕様更新 → レビュー/合意 → テスト仕様（期待値）反映 → 実装変更 → 実装が specs に一致することを確認、の順で進める。
- PR には、該当する specs のパスと変更差分を必ず記載する。実装のみの変更は認めない（例外は緊急不具合の一時対応で、直後に specs を補筆する）。
- 仕様と実装に乖離が生じた場合は、実装を即修正せず、まず specs を正して差異の根拠を明文化し、合意後に実装を合わせる。

### テスト記述の指針

- 本プロジェクトのテスト方針は `docs/testing-guideline.md` を参照。ユニットはコード近傍（colocation）、DB を伴う結合/E2E は `apps/web/tests/{integration,e2e}` に集約する。

### DB 設計ドキュメント → Prisma スキーマ生成（運用）

- DB 設計の唯一のソースは `docs/db_design.md`。
- フロー:
  1. `docs/db_design.md` を更新（ERD/列/用途/制約/計算式を反映）
  2. レビュー/合意
  3. `packages/db/prisma/schema.prisma` を同期（`@@map/@map` による snake/camel 対応）。必要に応じ migration SQL へ部分ユニーク等を追記
  4. Seed/API/画面を順次更新
- 将来は doc→schema の自動生成も検討するが、合意ドキュメントが常に主となる。

### UIベース資産（旧 osada-push）の取り込み手順

- 目的: 画面デザイン/サンプルデータのベース資産を継続的に取り込む。ディレクトリ名に "osada" は含めない。
- 配置: `apps/ui-base/`（独立起動のUIベースアプリ）。必要に応じ `apps/web/components/*` や `apps/web/app/*` へ反映。
- 再取り込み（例）:
  1. `git fetch origin osada-push`
  2. `git subtree split --prefix=src/components --branch merge/osada-components origin/osada-push`
  3. `git checkout merge/osada-components`（比較/抽出）
  4. 必要ファイルのみ `apps/ui-base/components` および `apps/ui-base/app` 配下へコピー/更新（履歴保持が必要なら subtree add を併用）
  5. 同様に `src/app` → `apps/ui-base/app` を比較し、仕様に沿って取り込み
- 重要: 取り込み前に必ず `docs/specs/*` を最新化し、差分が仕様に反映済みであることを確認する。

#### 起動手順（apps/ui-base）

- 依存インストール: `pnpm install`
- 開発起動: `pnpm --filter ui-base dev`（デフォルトで `http://localhost:3100`）
- ビルド/本番起動: `pnpm --filter ui-base build && pnpm --filter ui-base start`

備考:

- `apps/ui-base` は DB 非依存のスタブデータで動作（DB フォールバック禁止方針の対象外）。
- Tailwind v4 を利用（`app/globals.css` に @import と @theme を定義）。

---

## エージェント運用ガイド（Kent Beck TDD のエッセンス）

本リポジトリで AI/エージェントを活用して開発を進める際は、以下を原則とします（出典: Kent Beck, BPlusTree3 の CLAUDE.md の考え方を要約）。

### TDD を原則とした開発プロセス（必須）

- 失敗するテストから着手（Red）: 新規/変更の期待挙動をテストで先に固定する。失敗テストなしの実装は禁止。
- 最小実装でグリーン（Green）: テストを通すための最小限のコードのみを書く。横展開はしない。
- リファクタ（Refactor）: テストがグリーンのまま、重複排除・命名改善・構造の単純化を行う。価値がないリファクタはしない。
- 小さな一歩・小さな差分: こまめに動く状態を維持し、原子的な変更単位で積み上げる。

本プロジェクトでは開発は原則として TDD（Red→Green→Refactor）で進めます。例外は「緊急不具合の一時対応」に限り、直後にテスト・仕様（`docs/specs/*`）・ドキュメントを補筆して整合させてください。

### 進め方の基準

- 仕様先行・単一のソース・オブ・トゥルース: 変更は必ず `docs/specs/*` を先に更新し、期待値を明文化してから実装する（本書冒頭のルールと同一）。
- 計画→実装の順: 変更前に簡潔な実行計画（やること/やらないこと/不確実点）を共有する。
- 公開 API 経由でテスト: 実装詳細に依存しない振る舞いテストを優先する。
- 透明性と合意形成: トレードオフや不確実性は明示し、質問をためらわない。ルールからの逸脱は背景・影響・戻し方を記述する。
- ドキュメント同期: 意味のある変更は README/`docs/*`/仕様に反映する（テストが示す期待と整合）。
- コミット方針: 小さく原子的、Conventional Commits 推奨。常にグリーンでコミットし、容易にリバート可能に保つ。

### 実務チェックリスト（抜粋）

- 着手前: 近傍コード・既存テスト・仕様を読み、影響範囲を見立てる。
- Red: まず失敗するテストを 1 件追加（最小の行動単位）。
- Green: 最小実装で通す。余計な分岐や最適化は追加しない。
- Refactor: 命名/重複/構造を見直し、テストグリーンを維持。
- 同期: `docs/specs/*` とテスト期待値が一致しているか再確認。
- PR: 仕様差分へのリンク、テスト結果、トレードオフを明記。

---

## CI 失敗のローカル再現（最優先）

- CI で失敗したら、まずローカルで「同じ失敗」を再現する。Vercel/CI の失敗コマンドを手元で実行し、同じログを出す。
- 最短は `pnpm verify:web`（= `pnpm -C apps/web build`）。`CI=1 VERCEL=1` を付けると近似度が上がる。Node/Pnpm は `.node-version` と `packageManager` を厳守。
- Next の型検査は `apps/web/tsconfig.build.json` を使用し、tests/\*\* 等は除外。Turbo の環境変数警告は `turbo.json` の env に追加して解消する。
- 根本原因を `docs/issues/012_testing/status.md` に記録（事象/原因/再現手順/修正/影響）。場当たり的な抑止（ignoreBuildErrors 等）は原則禁止。

### Git Hooks（禁止事項）

- `git commit --no-verify` の使用を禁止。
- `HUSKY=0` 等、フック無効化の環境変数の使用を禁止。
- 例外運用が必要な場合は、Issue/PR に背景・代替案・戻し条件を明記し、直後に元へ戻す。

### TypeScript 型ポリシー（any禁止）

- `any` の使用を原則禁止します。やむを得ず使用する場合は次を厳守してください。
  - 該当箇所に「なぜ `any` が必要か」を日本語コメントで明記する。
  - 代替案（`unknown` + 型ガード、型定義追加、DTOの厳密化等）を検討し、可能なら置換する。
  - テストコードの `as any` も原則回避。どうしても必要な場合は同様に理由をコメントする。
  - 外部ライブラリ由来の型不足は `@types/*` の導入または `apps/web/types/` などでローカル型を追加して解決する。

### 後回しタスクの取り扱い

- 直近スプリントで着手しない検討項目や v2 以降に回す事項は、`docs/tasks_overall.md` に「v2（YYYY-MM-DD 以降）」の節として集約します。
- エージェントは後回し判断時に、背景・意図・想定着手時期（例: クライアントMTG 2025-09-09 以降）を同ファイルへ追記し、必要に応じて `docs/specs/*` にプレースホルダ（-v2 アンカー等）を記します。
- 仕様が固まり次第、`docs/issues/<ID>/` へ正式展開し、実装・テストを TDD で進めます。

#### E2E テスト安定化に関する補足（2025-09-09 以降）

- 現時点（〜2025-09-09）は E2E（Playwright）が不安定なため、重大回 regressions の再現・検証には最小限のシナリオのみを運用します。
- 2025-09-09 以降に安定化タスクへ着手し、以下を順次整備します。
  - webServer/DB 準備の固定化（`E2E_DB_SETUP=dbpush` など）
  - `storageState` の再生成戦略（ログインフローの安定）
  - 画面ごとの安定したセレクタ・data-testid 整備
  - CI 実行時間の最適化（Chromium のみ・差分実行）

---

### 補足（オペレーション月次の工場フィルタ対応）

- 上表（集約テーブル）への工場フィルタ適用は 2025-09-09 以降に対応します。
  - 方針: `/api/operations/monthly` と上段集計の両方に `factory` クエリを追加し、UI の対象工場と同期。
  - 現時点（〜2025-09-08）は全社集計のまま運用します。最新仕様は `docs/specs/page/dashboard/operations/monthly.md` を参照。
