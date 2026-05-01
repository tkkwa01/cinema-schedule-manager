# 実装計画: Cinema Schedule Manager バグ修正

## 概要

本ドキュメントは、Cinema Schedule Manager アプリケーションにおいて「スケジュール」タブ以外の画面が正しく動作しない複数のバグを修正するための実装タスクリストである。

バグ条件探索テスト（修正前に失敗することを確認）→ 保全テスト（修正前にパスすることを確認）→ 実装 → 検証 の順序で進める。

---

## タスク

- [x] 1. バグ条件探索テストを作成する（修正前に実行・失敗を確認）
  - **Property 1: Bug Condition** — `onWatchlistToggle` 型不一致 / 映画別スケジュール全日付取得 / タイムライン初期化タイミング
  - **CRITICAL**: このテストは修正前のコードで **FAIL** することが期待される — 失敗がバグの存在を証明する
  - **DO NOT** テストが失敗してもコードを修正しない（次のタスクで修正する）
  - **GOAL**: 反例（counterexample）を記録してバグの根本原因を確認する
  - **Scoped PBT アプローチ**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - バグ1探索: `MoviesPage` が `MovieCard` に渡す `onWatchlistToggle` コールバックの型シグネチャを検証する
    - `onWatchlistToggle` の引数が `string` 型であることを確認する（`React.MouseEvent` ではないこと）
    - 修正前コード（`e => { e.stopPropagation?.(); handleWatchlistToggle(movie.id); }`）では型不一致が発生する
    - 期待される反例: コールバックの第1引数が `string` 型でない
  - バグ2探索: `GET /api/movies/:id/schedules` が今日以外の日付のスケジュールを返さないことを確認する
    - 今日以外の日付（例: 明日・明後日）のスケジュールをDBに保存した状態でエンドポイントを呼び出す
    - 修正前コード（`getSchedulesByDate(today).filter(s => s.movieId === movieId)`）では今日のスケジュールのみ返る
    - 期待される反例: 今日以外の日付のスケジュールが存在するのに空配列が返る
  - バグ3探索: `AppContext` の `isInitialized` フラグが存在しないことを確認する
    - `AppContext` の `state` に `isInitialized` プロパティが存在しないことを確認する
    - 修正前コード（`isInitialized` フラグなし）では初期化完了前にデータ取得が走る
    - 期待される反例: `state.isInitialized` が `undefined` である
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 反例を記録して根本原因を確認する
  - テストを作成・実行・失敗を記録したらタスク完了とする
  - _要件: 1.2, 1.3, 1.4_

- [x] 2. 保全プロパティテストを作成する（修正前に実行・パスを確認）
  - **Property 2: Preservation** — スケジュールタブ・作品一覧フィルタリング・ウォッチリスト操作の動作不変
  - **IMPORTANT**: 観察優先メソドロジーに従う — 修正前のコードで非バグ入力の実際の出力を観察してからテストを書く
  - **Scoped PBT アプローチ**: バグ条件が成立しない入力（`isBugCondition` が false の入力）に対してテストを書く
  - 保全テスト1: `GET /api/schedules?date=YYYY-MM-DD` エンドポイントの動作不変
    - 任意の有効な日付文字列（YYYY-MM-DD形式）に対して、エンドポイントが正しくスケジュールを返すことを確認する
    - fast-check で日付文字列を生成し、`getSchedulesByDate` の結果と一致することを検証する
    - 修正前のコードでパスすることを確認する（このエンドポイントはバグの影響を受けない）
  - 保全テスト2: `filterByStatus`・`searchMovies`・`sortByStatus` の動作不変
    - 任意の映画リストとフィルター条件に対して、フィルタリング・検索・ソート結果が正しいことを確認する
    - fast-check で映画データを生成し、各ユーティリティ関数の出力を検証する
    - 修正前のコードでパスすることを確認する（これらの関数はバグの影響を受けない）
  - 保全テスト3: `addToWatchlist`・`removeFromWatchlist` の動作不変
    - 任意の映画IDに対して、ウォッチリスト追加・削除が正しく機能することを確認する
    - fast-check で映画IDを生成し、ローカルストレージへの保存・削除を検証する
    - 修正前のコードでパスすることを確認する（ウォッチリスト操作自体はバグの影響を受けない）
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（修正前の正常動作のベースラインを確立する）
  - テストを作成・実行・パスを確認したらタスク完了とする
  - _要件: 3.1, 3.2, 3.3, 3.4_

- [x] 3. バグ修正の実装

  - [x] 3.1 `MoviesPage.tsx` の `onWatchlistToggle` 型不一致を修正する
    - `cinema-schedule-manager/packages/frontend/src/pages/MoviesPage.tsx` を修正する
    - 修正前（行 107-110 付近）:
      ```tsx
      onWatchlistToggle={e => {
        e.stopPropagation?.();
        handleWatchlistToggle(movie.id);
      }}
      ```
    - 修正後:
      ```tsx
      onWatchlistToggle={(movieId: string) => {
        handleWatchlistToggle(movieId);
      }}
      ```
    - `stopPropagation` の呼び出しを削除する（`MovieCard` 内部の `onClick` で `movie.id` を渡しているため不要）
    - `MovieCard` の `onWatchlistToggle` 型シグネチャ `(movieId: string) => void` に合わせる
    - _Bug_Condition: `typeof onWatchlistToggle の第1引数 !== 'string'`（design.md バグ1 isBugCondition_1 参照）_
    - _Expected_Behavior: `onWatchlistToggle("movie-123")` → `handleWatchlistToggle("movie-123")` が呼ばれる_
    - _Preservation: `MoviesPage` のフィルタリング・検索・ソート機能は変更しない_
    - _要件: 2.2, 3.3, 3.4_

  - [x] 3.2 `IDataStore` インターフェースに `getSchedulesByMovieId()` メソッドを追加する
    - `cinema-schedule-manager/packages/backend/src/types/index.ts` を修正する
    - `IDataStore` インターフェースに以下のメソッドを追加する:
      ```typescript
      /**
       * 指定映画IDの全日付スケジュールを取得する
       * @param movieId 映画ID
       * @returns スケジュールの配列（日付・開始時刻の昇順）
       */
      getSchedulesByMovieId(movieId: string): Schedule[];
      ```
    - _Bug_Condition: `schedulesInDB.length > 0 AND schedulesToday.length < schedulesInDB.length`（design.md バグ2 isBugCondition_2 参照）_
    - _Expected_Behavior: 映画IDに紐づく全日付のスケジュールを返す_
    - _Preservation: 既存の `getSchedulesByDate` メソッドは変更しない_
    - _要件: 2.3_

  - [x] 3.3 `SqliteDataStore` に `getSchedulesByMovieId()` を実装する
    - `cinema-schedule-manager/packages/backend/src/datastore/database.ts` を修正する
    - `SqliteDataStore` クラスに以下のメソッドを追加する:
      ```typescript
      getSchedulesByMovieId(movieId: string): Schedule[] {
        const stmt = this.db.prepare(`
          SELECT * FROM schedules
          WHERE movie_id = ?
          ORDER BY date ASC, start_time ASC
        `);
        const rows = stmt.all(movieId) as ScheduleRow[];
        return rows.map(this.rowToSchedule.bind(this));
      }
      ```
    - 日付・開始時刻の昇順で返す（`MovieDetailPage` の日付別グループ化表示に対応）
    - `idx_schedules_movie_id` インデックスが既に存在するため追加不要
    - _Bug_Condition: `getSchedulesByDate(today).filter(s => s.movieId === movieId)` が今日以外を返さない_
    - _Expected_Behavior: `getSchedulesByMovieId(movieId)` が全日付のスケジュールを返す_
    - _Preservation: `getSchedulesByDate` の実装は変更しない_
    - _要件: 2.3_

  - [x] 3.4 `server.ts` の `GET /api/movies/:id/schedules` を全日付取得に変更する
    - `cinema-schedule-manager/packages/backend/src/api/server.ts` を修正する
    - 修正前（行 130-133 付近）:
      ```typescript
      const today = new Date().toISOString().split('T')[0] as string;
      const schedules = dataStore.getSchedulesByDate(today)
        .filter(s => s.movieId === movieId);
      ```
    - 修正後:
      ```typescript
      const schedules = dataStore.getSchedulesByMovieId(movieId);
      ```
    - `today` 変数の宣言も削除する
    - _Bug_Condition: `getSchedulesByDate(today)` が今日のスケジュールのみ返す_
    - _Expected_Behavior: `getSchedulesByMovieId(movieId)` が全日付のスケジュールを返す_
    - _Preservation: `GET /api/schedules?date=YYYY-MM-DD` エンドポイントは変更しない_
    - _要件: 2.1, 2.3_

  - [x] 3.5 `AppContext.tsx` に `isInitialized` フラグを追加する
    - `cinema-schedule-manager/packages/frontend/src/store/AppContext.tsx` を修正する
    - `AppState` 型（`packages/frontend/src/types/index.ts`）に `isInitialized: boolean` フィールドを追加する
    - `AppAction` 型に `{ type: 'SET_INITIALIZED'; payload: boolean }` を追加する
    - `initialState` に `isInitialized: false` を追加する
    - `appReducer` に `case 'SET_INITIALIZED'` を追加する
    - 起動時の非同期初期化（`initialLoad` / `initialFetch`）の `finally` ブロックで `dispatch({ type: 'SET_INITIALIZED', payload: true })` を呼び出す
    - _Bug_Condition: `mountTime < initCompleteTime AND selectedDateAtMount !== selectedDateAfterInit`（design.md バグ3 isBugCondition_3 参照）_
    - _Expected_Behavior: `isInitialized` が `true` になってからデータ取得を開始する_
    - _Preservation: `selectedDate`・`watchlist` などの既存状態管理は変更しない_
    - _要件: 2.4_

  - [x] 3.6 `TimelinePage.tsx` の初期化タイミングを修正する
    - `cinema-schedule-manager/packages/frontend/src/pages/TimelinePage.tsx` を修正する
    - `useAppContext` から `isInitialized` を取得する:
      ```typescript
      const { selectedDate, isInitialized } = state;
      ```
    - `useEffect` の先頭に初期化チェックを追加する:
      ```typescript
      useEffect(() => {
        if (!isInitialized) return;  // 初期化完了前はスキップ
        // ... 既存のデータ取得処理 ...
      }, [selectedDate, isInitialized]);
      ```
    - `useEffect` の依存配列に `isInitialized` を追加する
    - _Bug_Condition: `isInitialized` フラグなしで `selectedDate` の初期値でリクエストが飛ぶ_
    - _Expected_Behavior: `isInitialized = true` になってから `selectedDate` でスケジュールを取得する_
    - _Preservation: `selectedDate` 変更時のスケジュール再取得ロジックは変更しない_
    - _要件: 2.4_

- [x] 4. バグ条件探索テストが修正後にパスすることを確認する

  - [x] 4.1 バグ条件探索テスト（タスク1）を再実行して PASS することを確認する
    - **Property 1: Expected Behavior** — `onWatchlistToggle` 型整合性 / 映画別スケジュール全日付取得 / タイムライン初期化
    - **IMPORTANT**: タスク1で作成した **同じテスト** を再実行する — 新しいテストを書かない
    - タスク1のテストはバグ修正後の期待動作をエンコードしている
    - このテストがパスすれば、バグが修正されたことを証明する
    - 修正後のコードでテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _要件: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 保全プロパティテスト（タスク2）を再実行してパスすることを確認する
    - **Property 2: Preservation** — スケジュールタブ・作品一覧フィルタリング・ウォッチリスト操作の動作不変
    - **IMPORTANT**: タスク2で作成した **同じテスト** を再実行する — 新しいテストを書かない
    - 修正後のコードでテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - すべてのテストがパスすることを確認する
    - _要件: 3.1, 3.2, 3.3, 3.4_

- [x] 5. チェックポイント — すべてのテストがパスすることを確認する
  - バックエンドのテストをすべて実行する: `cinema-schedule-manager/packages/backend` で `npm test`
  - フロントエンドのテストをすべて実行する: `cinema-schedule-manager/packages/frontend` で `npm test`
  - すべてのテストがパスすることを確認する
  - 疑問点があればユーザーに確認する
