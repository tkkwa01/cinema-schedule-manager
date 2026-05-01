# 実装計画: Cinema Schedule Manager バグ修正2

## 概要

本ドキュメントは、Cinema Schedule Manager アプリケーションで報告された以下の3つのバグを修正するための実装タスクリストである。

- **バグ1**: 日付固定 — スケジュールの日付がすべて同一になる
- **バグ2**: ステータス欠落 — `upcoming`・`ending_soon` の映画が表示されない
- **バグ3**: ウォッチリストタイトル欠落 — スケジュールがない映画のタイトルが映画IDになる

バグ条件探索テスト（修正前に失敗することを確認）→ 保全テスト（修正前にパスすることを確認）→ 実装 → 検証 の順序で進める。

---

## タスク

- [x] 1. バグ条件探索テストを作成する（修正前に実行・失敗を確認）
  - **CRITICAL**: このテストは修正前のコードで **FAIL** することが期待される — 失敗がバグの存在を証明する
  - **DO NOT** テストが失敗してもコードを修正しない（次のタスクで修正する）
  - **GOAL**: 反例（counterexample）を記録してバグの根本原因を確認する

  - バグ1探索: `cronScheduler.ts` の `runUpdate()` が `actualDate` としてリクエスト日付以外を使用することを確認する
    - `scrapeSchedule()` が `date: '2025-07-04'` を返すモックを用意し、`runUpdate('2025-07-05')` を呼び出す
    - `dataStore.saveSchedules` が `'2025-07-04'`（リクエスト日付 `'2025-07-05'` ではない）で呼ばれることを確認する
    - 修正前コード（`const actualDate = scheduleResult.data.date`）では `scheduleResult.data.date` がそのまま使われる
    - 期待される反例: `saveSchedules` が `'2025-07-05'` ではなく `'2025-07-04'` で呼ばれる
    - _要件: 1.1, 1.2, 1.3_

  - バグ2探索: `cronScheduler.ts` の `runUpdate()` が `upcoming`・`ending_soon` の映画を `showing` として保存することを確認する
    - `scrapeShowing()` が `upcoming: [{ id: 'movie-1', title: '上映予定映画' }]` を返すモックを用意する
    - `dataStore.saveMovies` に渡される映画データの `status` が `'showing'` になることを確認する
    - 修正前コード（`status: 'showing' as const`）ではすべて `'showing'` になる
    - 期待される反例: `upcoming` の映画が `status: 'showing'` で保存される
    - _要件: 1.4, 1.5_

  - バグ3探索: `WatchlistPage` がスケジュールなし映画のタイトルとして映画IDを表示することを確認する
    - ウォッチリストに `movieId = '3742'` が登録されており、スケジュールが空の状態をセットアップする
    - `movies` API が `{ id: '3742', title: '正しいタイトル' }` を返すモックを用意する
    - 修正前コード（`movieSchedules[0]?.movieTitle ?? movieId`）では `'3742'` が表示される
    - 期待される反例: `'3742'`（映画ID）がタイトルとして表示される
    - _要件: 1.8, 1.9_

  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 反例を記録して根本原因を確認する
  - テストを作成・実行・失敗を記録したらタスク完了とする

- [x] 2. 保全プロパティテストを作成する（修正前に実行・パスを確認）
  - **IMPORTANT**: 観察優先メソドロジーに従う — 修正前のコードで非バグ入力の実際の出力を観察してからテストを書く
  - **Scoped PBT アプローチ**: バグ条件が成立しない入力（`isBugCondition` が false の入力）に対してテストを書く

  - 保全テスト1: `cronScheduler.ts` の日付保存 — `scrapeSchedule()` が返す `date` とリクエスト日付が一致する場合の動作不変
    - `scrapeSchedule()` が `date: '2025-07-05'`（リクエスト日付と同じ）を返すモックを用意する
    - `dataStore.saveSchedules` が `'2025-07-05'` で呼ばれることを確認する（バグ条件が成立しない入力）
    - 修正前のコードでパスすることを確認する
    - _要件: 3.1_

  - 保全テスト2: `cronScheduler.ts` のステータス保存 — `showing` ステータスの映画の動作不変
    - `scrapeShowing()` が `showing: [{ id: 'movie-1', title: '上映中映画' }]` のみを返すモックを用意する
    - `dataStore.saveMovies` に渡される映画の `status` が `'showing'` であることを確認する
    - 修正前のコードでパスすることを確認する（`showing` はバグ条件が成立しない）
    - _要件: 3.2, 3.3_

  - 保全テスト3: `WatchlistPage` — スケジュールが存在する映画のタイトル表示不変
    - ウォッチリストに `movieId = '3742'` が登録されており、`movieTitle: '正しいタイトル'` を持つスケジュールが存在する状態をセットアップする
    - `'正しいタイトル'` が表示されることを確認する（バグ条件が成立しない入力）
    - 修正前のコードでパスすることを確認する
    - _要件: 3.4, 3.5_

  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（修正前の正常動作のベースラインを確立する）
  - テストを作成・実行・パスを確認したらタスク完了とする

- [x] 3. バグ修正の実装

  - [x] 3.1 `cronScheduler.ts` の `actualDate` をリクエスト日付に固定する
    - `cinema-schedule-manager/packages/backend/src/scheduler/cronScheduler.ts` を修正する
    - `runUpdate()` メソッド内の `actualDate` 取得部分を修正する
    - 修正前:
      ```typescript
      const actualDate = scheduleResult.data.date;
      ```
    - 修正後:
      ```typescript
      // サイトが返す日付ではなくリクエストした日付を使用する
      // （parseScheduleDate がページ内の別の日付にマッチする問題を回避）
      const actualDate = today;
      ```
    - `scheduleResult.data.date` への参照を削除する（`date` フィールドは `entries` の取得にのみ使用する）
    - _Bug_Condition: `parsedDate ≠ requestedDate`（design.md バグ1 isBugCondition_DateFixed 参照）_
    - _Expected_Behavior: `saveSchedules(today, schedules)` が呼ばれる_
    - _Preservation: スケジュールエントリの保存処理は変更しない_
    - _要件: 2.1, 2.2, 2.3_

  - [x] 3.2 `cronScheduler.ts` の `movieMap` にステータスを保持する
    - `cinema-schedule-manager/packages/backend/src/scheduler/cronScheduler.ts` を修正する
    - `movieMap` の型を `Map<string, string>` から `Map<string, { title: string; status: ShowingStatus }>` に変更する
    - `ShowingStatus` 型を `../types/index.js` からインポートする
    - スケジュールエントリから映画を追加する部分を修正する:
      ```typescript
      // 修正前
      movieMap.set(movieId, entry.movieTitle);
      // 修正後
      movieMap.set(movieId, { title: entry.movieTitle, status: 'showing' });
      ```
    - `showingResult` から映画を追加する部分を修正して正しいステータスを保持する:
      ```typescript
      // 修正後
      if (showingResult.success && showingResult.data) {
        showingResult.data.showing.forEach(m => {
          movieMap.set(m.id, { title: m.title, status: 'showing' });
        });
        showingResult.data.upcoming.forEach(m => {
          movieMap.set(m.id, { title: m.title, status: 'upcoming' });
        });
        showingResult.data.endingSoon.forEach(m => {
          movieMap.set(m.id, { title: m.title, status: 'ending_soon' });
        });
      }
      ```
    - `scheduleMovies` の生成部分を修正する:
      ```typescript
      // 修正前
      const scheduleMovies = Array.from(movieMap.entries()).map(([id, title]) => ({
        id, title, status: 'showing' as const, ...
      }));
      // 修正後
      const scheduleMovies = Array.from(movieMap.entries()).map(([id, { title, status }]) => ({
        id, title, status, ...
      }));
      ```
    - _Bug_Condition: `movie.status = 'upcoming' OR movie.status = 'ending_soon'`（design.md バグ2 isBugCondition_StatusLost 参照）_
    - _Expected_Behavior: `upcoming` の映画が `status: 'upcoming'` で保存される_
    - _Preservation: `showing` ステータスの映画の保存処理は変更しない_
    - _要件: 2.4, 2.5, 2.6, 2.7_

  - [x] 3.3 `WatchlistPage.tsx` に映画一覧取得を追加してタイトルを補完する
    - `cinema-schedule-manager/packages/frontend/src/pages/WatchlistPage.tsx` を修正する
    - `Movie` 型を `../types/index` からインポートする
    - `fetchMovies` を `../api/client` からインポートする
    - `movies` state を追加する:
      ```tsx
      const [movies, setMovies] = useState<Movie[]>([]);
      ```
    - 映画一覧を取得する `useEffect` を追加する:
      ```tsx
      useEffect(() => {
        async function loadMovies() {
          const { data } = await fetchMovies();
          if (data) setMovies(data.data);
        }
        loadMovies();
      }, []);
      ```
    - `movieTitle` の取得ロジックを修正する:
      ```tsx
      // 修正前
      const movieTitle = movieSchedules[0]?.movieTitle ?? movieId;
      // 修正後
      const movieTitle =
        movieSchedules[0]?.movieTitle ??
        movies.find(m => m.id === movieId)?.title ??
        movieId;
      ```
    - _Bug_Condition: `schedulesForDate.length = 0`（design.md バグ3 isBugCondition_WatchlistTitle 参照）_
    - _Expected_Behavior: スケジュールなし映画のタイトルが `movies` API から補完される_
    - _Preservation: スケジュールあり映画のタイトル表示は変更しない_
    - _要件: 2.8, 2.9_

- [x] 4. バグ条件探索テストが修正後にパスすることを確認する

  - [x] 4.1 バグ条件探索テスト（タスク1）を再実行して PASS することを確認する
    - **IMPORTANT**: タスク1で作成した **同じテスト** を再実行する — 新しいテストを書かない
    - 修正後のコードでテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _要件: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 2.9_

  - [x] 4.2 保全プロパティテスト（タスク2）を再実行してパスすることを確認する
    - **IMPORTANT**: タスク2で作成した **同じテスト** を再実行する — 新しいテストを書かない
    - 修正後のコードでテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - _要件: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. チェックポイント — すべてのテストがパスすることを確認する
  - バックエンドのテストをすべて実行する: `cinema-schedule-manager/packages/backend` で `npx vitest run`
  - フロントエンドのテストをすべて実行する: `cinema-schedule-manager/packages/frontend` で `npm test`
  - すべてのテストがパスすることを確認する
  - 疑問点があればユーザーに確認する
