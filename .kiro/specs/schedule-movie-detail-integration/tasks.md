# 実装計画: schedule-movie-detail-integration

## 概要

本実装計画は、以下の3つの改善をインクリメンタルに実装する。

1. **`description` フィールドのデータモデル全体への追加**（バックエンド型定義 → DB → パーサー → スクレイパー → スケジューラー → API）
2. **`MovieSummaryCard` の新規作成と `SchedulePage` への統合**（作品単位カード表示）
3. **`DateNavigator` の `App.tsx` への移動**（全タブ共有・14日間表示）

各タスクは前のタスクの成果物を前提として積み上げる構造になっている。

---

## タスク

- [x] 1. バックエンド型定義の拡張
  - `packages/backend/src/types/index.ts` の `Movie` インターフェースに `description?: string` フィールドを追加する
  - `ParsedMovieDetail` インターフェースに `description?: string` フィールドを追加する
  - `RawMovieDetail` インターフェースに `description?: string` フィールドを追加する
  - _要件: 4.1_

- [x] 2. DBマイグレーションと `database.ts` の拡張
  - [x] 2.1 `MovieRow` 型に `description: string | null` フィールドを追加する
    - `packages/backend/src/datastore/database.ts` の `MovieRow` インターフェースを更新する
    - _要件: 4.1_
  - [x] 2.2 `runMigrations()` に `ALTER TABLE movies ADD COLUMN description TEXT DEFAULT ''` を追加する
    - 既存カラムへの重複追加を防ぐため `try/catch` で囲む（冪等マイグレーション）
    - _要件: 4.1, 4.2_
  - [x] 2.3 `saveMovies()` の INSERT 文に `description` カラムを追加する
    - `INSERT OR REPLACE INTO movies` の列リストと `VALUES` に `description` を追加する
    - `insertStmt.run()` 時に `description: movie.description ?? ''` を渡す
    - _要件: 4.2_
  - [x] 2.4 `rowToMovie()` の戻り値に `description: row.description ?? undefined` を追加する
    - _要件: 4.3, 4.4_
  - [ ]* 2.5 `description` フィールドのラウンドトリップ保存プロパティテストを書く
    - **プロパティ6: description フィールドのラウンドトリップ保存**
    - **Validates: 要件4.2, 4.3, 4.4**
    - `packages/backend/tests/datastore/database.property.test.ts` を新規作成する
    - 任意の `description` 文字列を持つ `Movie` を `saveMovies` で保存し、`getMovieById` で取得した場合に `description` が保持されることを検証する

- [x] 3. パーサーの拡張（`description` 抽出追加）
  - [x] 3.1 `parseMovieDetailPage` に `description` 抽出ロジックを追加する
    - `packages/backend/src/scraper/parser.ts` の `parseMovieDetailPage` メソッドを更新する
    - `.movie-description, .movie-intro, .story, [class*="description"], [class*="intro"]` セレクターで紹介文を取得する
    - 戻り値の `ParsedMovieDetail` に `description` フィールドを含める
    - _要件: 3.2, 3.3_
  - [ ]* 3.2 `parseMovieDetailPage` の例外非スロー保証プロパティテストを更新する
    - **プロパティ4: パーサーの例外非スロー保証**
    - **Validates: 要件3.5**
    - `packages/backend/tests/scraper/parser.test.ts` の既存プロパティテストを更新し、`description` フィールドの存在も検証する
  - [ ]* 3.3 `parseMovieDetailPage` の冪等性プロパティテストを更新する
    - **プロパティ5: パーサーの冪等性**
    - **Validates: 要件3.6**
    - `packages/backend/tests/scraper/parser.test.ts` の既存冪等性テストを更新し、`description` フィールドも比較対象に含める

- [x] 4. スクレイパーの拡張（`RawMovieDetail` に `description` 追加）
  - `packages/backend/src/scraper/scheduleScraper.ts` の `scrapeMovieDetail` メソッドを更新する
  - `data: RawMovieDetail` の構築時に `description: parsedDetail.description` を追加する
  - _要件: 3.1, 3.2_

- [x] 5. `cronScheduler` の拡張（`description` 取得統合）
  - [x] 5.1 `movieMap` の値型を `{ title: string; status: ShowingStatus; description?: string }` に拡張する
    - `packages/backend/src/scheduler/cronScheduler.ts` の `movieMap` 宣言を更新する
    - _要件: 7.1, 7.2_
  - [x] 5.2 詳細取得ループを拡張してタイトル補完と同時に `description` も取得・保存する
    - `moviesToFetch` ループ内で `detailResult.data.description` を `movieMap` に格納する
    - 失敗時は `description: ''` として継続する（他の映画の処理を止めない）
    - _要件: 7.2, 7.3_
  - [x] 5.3 `saveMovies` 呼び出し時に `description` フィールドを含める
    - `scheduleMovies` の `map` 内で `description: description ?? ''` を追加する
    - _要件: 7.2_

- [x] 6. APIエンドポイント追加（`GET /api/movies/:id`）
  - [x] 6.1 `packages/backend/src/api/server.ts` に `GET /api/movies/:id` エンドポイントを追加する
    - 既存の `GET /api/movies/:id/schedules` パターンを踏襲して実装する
    - `movieId` が未指定の場合は HTTP 400 + `INVALID_ID` を返す
    - 映画が存在しない場合は HTTP 404 + `MOVIE_NOT_FOUND` を返す
    - 正常時は `ApiResponse<Movie>` 形式で返す
    - レスポンスをメモリキャッシュ（キー: `movie-detail:{movieId}`）に保存する
    - _要件: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 6.2 `GET /api/movies/:id` エンドポイントのユニットテストを書く
    - `packages/backend/tests/api/server.test.ts` に正常系・404・400 のテストケースを追加する
    - `description` フィールドがレスポンスに含まれることを確認する
    - _要件: 5.2, 5.3_

- [x] 7. チェックポイント — バックエンドの全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 8. フロントエンド型定義の拡張
  - `packages/frontend/src/types/index.ts` の `Movie` インターフェースに `description?: string` フィールドを追加する
  - _要件: 4.1_

- [x] 9. APIクライアント拡張（`fetchMovieById` 追加）
  - `packages/frontend/src/api/client.ts` に `fetchMovieById(movieId: string)` 関数を追加する
  - `apiFetch<Movie>` を使用して `GET /api/movies/${encodeURIComponent(movieId)}` を呼び出す
  - _要件: 5.1, 6.1_

- [x] 10. `scheduleUtils.ts` にグループ化ロジックを追加する
  - [x] 10.1 `MovieSummaryData` インターフェースを `scheduleUtils.ts` に追加する
    - `movieId: string | null`、`title: string`、`formats: string[]`、`startTimes: string[]` フィールドを定義する
    - _要件: 1.1_
  - [x] 10.2 `groupSchedulesByMovieId(schedules: Schedule[]): MovieSummaryData[]` 関数を実装する
    - 同一 `movieId` の上映回を1エントリに統合する
    - `movieId` が存在しない場合は `__no_id__{movieTitle}` をキーとして使用する
    - `formats` と `startTimes` は重複除去し、`startTimes` は昇順ソートする
    - _要件: 1.1, 1.3, 1.4_
  - [ ]* 10.3 `groupSchedulesByMovieId` の movieId 一意性プロパティテストを書く
    - **プロパティ1: スケジュールの movieId グループ化の一意性**
    - **Validates: 要件1.1**
    - `packages/frontend/tests/utils/scheduleUtils.test.ts` にプロパティテストを追加する
    - 任意の `Schedule[]` に対して結果の各エントリの `movieId`（または `title`）が一意であり、元のスケジュール数以下のエントリ数になることを検証する

- [x] 11. `MovieSummaryCard` コンポーネントの新規作成
  - [x] 11.1 `packages/frontend/src/components/schedule/MovieSummaryCard.tsx` を新規作成する
    - `MovieSummaryCardProps`（`movieId`, `title`, `formats`, `startTimes`, `onClick`）を定義する
    - 映画タイトル（`h3`）、フォーマットバッジ（既存 `FormatBadge` を再利用）、上映時刻一覧を表示する
    - `movieId` が存在する場合は `cursor-pointer`、`role="button"`、`tabIndex={0}` を適用する
    - `onKeyDown` で Enter キー押下時に `onClick` を呼び出す
    - `movieId` が存在しない場合はクリック動作を無効化し `cursor-default` を適用する
    - _要件: 1.2, 1.3, 1.4, 1.6, 1.7, 1.8_
  - [ ]* 11.2 `MovieSummaryCard` のフォーマット網羅性プロパティテストを書く
    - **プロパティ2: MovieSummaryCard のフォーマット網羅性**
    - **Validates: 要件1.3**
    - `packages/frontend/tests/components/MovieSummaryCard.test.tsx` を新規作成する
    - 任意のフォーマット一覧を持つ `MovieSummaryData` に対して、レンダリング結果にすべてのフォーマットが含まれることを検証する
  - [ ]* 11.3 `MovieSummaryCard` の上映時刻網羅性プロパティテストを書く
    - **プロパティ3: MovieSummaryCard の上映時刻網羅性**
    - **Validates: 要件1.4**
    - 任意の上映時刻一覧を持つ `MovieSummaryData` に対して、レンダリング結果にすべての開始時刻が含まれることを検証する

- [x] 12. `SchedulePage` の変更（`MovieSummaryCard` 統合・`DateNavigator` 削除）
  - [x] 12.1 `SchedulePage` から `DateNavigator` のインポートと JSX を削除する
    - `packages/frontend/src/pages/SchedulePage.tsx` を更新する
    - 日付ナビゲーション用の `<div>` ブロック全体を削除する
    - _要件: 8.1_
  - [x] 12.2 `SchedulePage` のスケジュール表示を `ScheduleCard` から `MovieSummaryCard` に変更する
    - `groupSchedulesByMovieId` を使用してスケジュールを作品単位にグループ化する
    - `TheaterSection` 内の表示を `MovieSummaryCard` に置き換える
    - カードクリック時に `useNavigate` で `/movies/{movieId}` へ遷移する
    - 既存の「並び順切り替えボタン」（時刻順/タイトル別）は削除する（`MovieSummaryCard` が統合表示するため不要）
    - _要件: 1.1, 1.2, 1.5, 1.6, 1.7, 1.8_
  - [ ]* 12.3 `SchedulePage` の `MovieSummaryCard` 統合表示ユニットテストを書く
    - `packages/frontend/tests/pages/SchedulePage.test.tsx` を新規作成する
    - 同一 `movieId` の複数スケジュールが1枚の `MovieSummaryCard` にまとめられることを確認する
    - _要件: 1.1_

- [x] 13. `App.tsx` の変更（`DateNavigator` を `NavBar` に移動・14日間表示）
  - [x] 13.1 `App.tsx` の `NavBar` コンポーネントに `DateNavigator` を追加する
    - `packages/frontend/src/App.tsx` を更新する
    - ナビゲーションタブ（`<nav>`）の直下に `DateNavigator` を配置する
    - `navDates` は `state.availableDates` が空の場合は `generateDateRangeFromToday()` でフォールバックする
    - `selectedDate` と `setDate` は `useAppContext` から取得する
    - _要件: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
  - [ ]* 13.2 `generateDateRangeFromToday` の14日間表示プロパティテストを書く
    - **プロパティ9: DateNavigator の14日間表示**
    - **Validates: 要件8.3**
    - `packages/frontend/tests/utils/scheduleUtils.test.ts` にテストを追加する
    - `generateDateRangeFromToday()` が常に14個の日付を返し、最初の要素が今日の日付（`YYYY-MM-DD` 形式）であることを検証する

- [x] 14. `MovieDetailPage` の変更（`description` 表示追加・`fetchMovieById` 使用）
  - [x] 14.1 `MovieDetailPage` のデータ取得を `fetchMovies` から `fetchMovieById` に変更する
    - `packages/frontend/src/pages/MovieDetailPage.tsx` を更新する
    - `fetchMovies()` の全件取得をやめ、`fetchMovieById(id)` で単一映画を取得する
    - ローディング中は `LoadingIndicator` を表示する
    - 取得失敗時は `ErrorMessage` を表示する
    - _要件: 6.1, 6.4, 6.5_
  - [x] 14.2 `description` フィールドの条件付き表示を追加する
    - `description` が空でない文字列の場合のみ「作品紹介」セクションを表示する
    - `description` が `undefined` または空文字列の場合はセクションを非表示にする
    - _要件: 6.2, 6.3_
  - [ ]* 14.3 `MovieDetailPage` の `description` 表示条件プロパティテストを書く
    - **プロパティ8: description 表示の条件分岐**
    - **Validates: 要件6.2**
    - `packages/frontend/tests/pages/MovieDetailPage.test.tsx` を新規作成する
    - 非空文字列の `description` を持つ映画データを渡した場合に紹介文セクションが表示されることを検証する
    - `description` が空または `undefined` の場合に紹介文セクションが非表示になることを検証する

- [x] 15. 最終チェックポイント — 全テストが通ることを確認する
  - バックエンド・フロントエンド両方の全テストが通ることを確認する。問題があればユーザーに確認する。

---

## 備考

- `*` が付いたサブタスクはオプションであり、MVP として省略可能
- 各タスクは前のタスクの成果物を前提とするため、順序通りに実装すること
- プロパティテストには `@fast-check/vitest`（バックエンド）および `fast-check`（フロントエンド）を使用する
- テスト実行コマンド:
  - バックエンド: `cd cinema-schedule-manager && npm run test --workspace=packages/backend -- --run`
  - フロントエンド: `cd cinema-schedule-manager && npm run test --workspace=packages/frontend -- --run`
