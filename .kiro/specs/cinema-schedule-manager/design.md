# Cinema Schedule Manager バグ修正設計ドキュメント

## 概要

本ドキュメントは、Cinema Schedule Manager アプリケーションにおいて「スケジュール」タブ以外の画面が正しく動作しない複数のバグを修正するための設計を定義する。

### バグの概要

以下の4つのバグが連鎖的に発生しており、「作品詳細」「タイムライン」「ウォッチリスト」の各ページが正常に動作していない：

1. **バグ1**: `MoviesPage` → `MovieCard` の `onWatchlistToggle` 型不一致
   - `React.MouseEvent` オブジェクトを `movieId` 文字列として渡している
2. **バグ2**: バックエンドの `GET /api/movies/:id/schedules` が今日の日付のスケジュールしか返さない
   - `getSchedulesByDate(today)` で今日のみ取得し、全日付を返していない
3. **バグ3**: タイムラインページの `selectedDate` 初期化タイミング問題
   - `AppContext` の非同期初期化が完了する前に `useEffect` が実行される
4. **バグ4**: ウォッチリスト機能への波及
   - バグ1・2の影響でウォッチリスト操作とスケジュール表示が正しく機能しない

### 修正方針

各バグを独立して修正し、既存の「スケジュール」タブの動作を一切変更しない。修正は最小限の変更に留め、リグレッションを防ぐ。

---

## 用語集

- **Bug_Condition (C)**: バグが発現する条件 — 型不一致のコールバック呼び出し、または今日以外の日付のスケジュール取得要求
- **Property (P)**: バグ条件が成立するときの期待される正しい動作
- **Preservation（保全）**: 修正によって変更されてはならない既存の動作
- **`onWatchlistToggle`**: `MovieCard` コンポーネントが受け取るコールバック。シグネチャは `(movieId: string) => void`
- **`handleWatchlistToggle`**: `MoviesPage` で定義されたウォッチリスト操作関数。`movieId: string` を引数に取る
- **`getSchedulesByDate`**: `IDataStore` インターフェースのメソッド。指定日付のスケジュールのみを返す
- **`getSchedulesByMovieId`**: 修正後に追加する `IDataStore` の新メソッド。映画IDに紐づく全日付のスケジュールを返す
- **`selectedDate`**: `AppContext` が管理するグローバル状態。現在選択中の日付（YYYY-MM-DD形式）
- **`refreshTrigger`**: `AppContext` の状態変数。インクリメントされるとページがデータを再取得する

---

## バグ詳細

### バグ1: `onWatchlistToggle` 型不一致

#### バグ条件

ユーザーが `MoviesPage` の映画カードのウォッチリストボタンをクリックしたとき、`MovieCard` の `onWatchlistToggle` コールバックに `movieId` 文字列ではなく `React.MouseEvent` オブジェクトが渡される。

**形式的仕様:**
```
FUNCTION isBugCondition_1(input)
  INPUT: input は MoviesPage が MovieCard に渡す onWatchlistToggle の引数
  OUTPUT: boolean

  RETURN typeof input === 'object'
         AND input !== null
         AND 'stopPropagation' IN input   -- React.MouseEvent オブジェクトである
         AND typeof input !== 'string'    -- movieId 文字列ではない
END FUNCTION
```

**具体的な不具合箇所（`MoviesPage.tsx` 行 107-110）:**
```tsx
// 現在の不具合コード
onWatchlistToggle={e => {
  e.stopPropagation?.();          // e は React.MouseEvent
  handleWatchlistToggle(movie.id); // movie.id は正しく渡されている
}}
```

`MovieCard` の `onWatchlistToggle` の型は `(movieId: string) => void` であるが、
`MoviesPage` は `(e: React.MouseEvent) => void` 型のラムダを渡している。
`MovieCard` 内部では `onClick={() => onWatchlistToggle(movie.id)}` と呼び出すため、
実際には `movie.id` が正しく渡されているように見えるが、型定義の不一致により
TypeScript の型チェックが機能せず、将来的なリファクタリングで壊れるリスクがある。

**実際の動作確認:**
`MovieCard.tsx` の `onClick={() => onWatchlistToggle(movie.id)}` を見ると、
`MovieCard` 側で `movie.id` を渡しているため、現状では `handleWatchlistToggle` に
正しい `movieId` が届いている。しかし `MoviesPage` が渡すコールバックの型シグネチャが
`(movieId: string) => void` ではなく `(e: React.MouseEvent) => void` になっており、
型の不整合が存在する。

#### 具体例

- **期待**: `onWatchlistToggle("movie-123")` → `handleWatchlistToggle("movie-123")` が呼ばれる
- **現状**: 型シグネチャの不一致により型安全性が損なわれている
- **エッジケース**: `movie.id` が空文字列の場合でも型は一致すべき

---

### バグ2: `GET /api/movies/:id/schedules` が今日のスケジュールしか返さない

#### バグ条件

`GET /api/movies/:id/schedules` エンドポイントが呼び出されたとき、今日以外の日付のスケジュールが存在しても空配列を返す。

**形式的仕様:**
```
FUNCTION isBugCondition_2(movieId, currentDate)
  INPUT: movieId は有効な映画ID文字列
         currentDate は現在の日付（YYYY-MM-DD）
  OUTPUT: boolean

  schedulesInDB := dataStore.getAllSchedulesForMovie(movieId)
  schedulesToday := schedulesInDB.filter(s => s.date === currentDate)

  RETURN schedulesInDB.length > 0
         AND schedulesToday.length < schedulesInDB.length
         -- 今日以外のスケジュールが存在するのに返されない
END FUNCTION
```

**具体的な不具合箇所（`server.ts` 行 130-133）:**
```typescript
// 現在の不具合コード
const today = new Date().toISOString().split('T')[0] as string;
const schedules = dataStore.getSchedulesByDate(today)  // 今日のみ取得
  .filter(s => s.movieId === movieId);
```

`getSchedulesByDate(today)` は指定日付のスケジュールのみを返すため、
明日以降や昨日以前のスケジュールが取得されない。
`MovieDetailPage` では全日付のスケジュールを日付別にグループ化して表示しようとするが、
今日のスケジュールしか返ってこないため、他の日付のスケジュールが表示されない。

#### 具体例

- **期待**: 映画ID `"movie-abc"` のスケジュールが 2025-07-10、2025-07-11、2025-07-12 に存在する場合、3日分すべてを返す
- **現状**: 今日が 2025-07-10 の場合、2025-07-10 のスケジュールのみ返す
- **エッジケース**: 今日のスケジュールが存在しない場合、空配列を返す（現状）→ 全日付のスケジュールを返すべき

---

### バグ3: タイムラインページの `selectedDate` 初期化タイミング問題

#### バグ条件

`TimelinePage` がマウントされたとき、`AppContext` の非同期初期化（`fetchAvailableDates` や `triggerRefresh`）が完了する前に `useEffect` が実行され、初期値の `selectedDate`（今日の日付）でスケジュールを取得してしまう。その後 `selectedDate` が更新されても `useEffect` の依存配列に `selectedDate` が含まれているため再取得は行われるが、初回取得が無駄になる。

**形式的仕様:**
```
FUNCTION isBugCondition_3(mountTime, initCompleteTime)
  INPUT: mountTime はコンポーネントがマウントされた時刻
         initCompleteTime は AppContext の非同期初期化が完了した時刻
  OUTPUT: boolean

  RETURN mountTime < initCompleteTime
         -- コンポーネントが初期化完了前にマウントされている
         AND selectedDateAtMount !== selectedDateAfterInit
         -- 初期化前後で selectedDate が変わる
END FUNCTION
```

**具体的な不具合箇所（`AppContext.tsx`）:**

`AppContext` は起動時に2つの非同期処理を実行する：
1. `fetchAvailableDates()` → 利用可能な日付を取得し、最初の日付を `selectedDate` にセット
2. `triggerRefresh()` → スクレイピングを実行し、`actualDate` を `selectedDate` にセット

`TimelinePage` は `selectedDate` を依存配列に持つ `useEffect` でスケジュールを取得するが、
初期化完了前に `selectedDate = getTodayString()` でリクエストが飛ぶ。
データが存在しない場合は空表示になり、その後 `selectedDate` が更新されると再取得される。
この二重リクエストと初期表示の空状態がユーザー体験を損なう。

#### 具体例

- **期待**: `selectedDate` が確定してからスケジュールを取得する
- **現状**: 初期値（今日）でリクエスト → データなし表示 → `selectedDate` 更新 → 再リクエスト
- **エッジケース**: ネットワークが遅い場合、古いリクエストのレスポンスが新しいリクエストのレスポンスを上書きする可能性がある

---

### バグ4: ウォッチリスト機能への波及

バグ1・2の影響により、ウォッチリスト機能も正常に動作しない。

- バグ1の型不一致により、ウォッチリスト操作の型安全性が損なわれる
- `WatchlistPage` は `fetchSchedules(selectedDate)` を使用しているため、バグ2の直接的な影響は受けないが、バグ3の初期化タイミング問題の影響を受ける

---

## 期待される動作

### 保全要件

**変更されない動作:**
- 「スケジュール」タブ（`SchedulePage`）の日付別スケジュール表示は変更しない
- `GET /api/schedules?date=YYYY-MM-DD` エンドポイントの動作は変更しない
- `DateNavigator` による日付切り替え機能は変更しない
- 作品一覧ページ（`MoviesPage`）のフィルタリング・検索機能は変更しない
- 手動更新ボタンのトースト通知は変更しない
- ナビゲーションバーのタブ切り替えは変更しない

**スコープ:**
バグ条件が成立しない入力（スケジュールタブの操作、日付ナビゲーション、テキスト検索など）は、
この修正によって一切影響を受けてはならない。

---

## 仮説的根本原因

### バグ1の根本原因

`MoviesPage` が `MovieCard` に渡す `onWatchlistToggle` のコールバック実装が誤っている。

```tsx
// 誤った実装（現状）
onWatchlistToggle={e => {          // e は React.MouseEvent 型として推論される
  e.stopPropagation?.();
  handleWatchlistToggle(movie.id);
}}
```

`MovieCard` の `onWatchlistToggle` の型は `(movieId: string) => void` であるが、
`MoviesPage` は `(e: React.MouseEvent) => void` 型のラムダを渡している。
`stopPropagation` の呼び出しは `div` の `onClick` ハンドラで行うべきであり、
`onWatchlistToggle` コールバックの責務ではない。

### バグ2の根本原因

`server.ts` の `GET /api/movies/:id/schedules` ハンドラに「簡易実装」のコメントがあり、
`getSchedulesByDate(today)` で今日のスケジュールのみを取得している。
`IDataStore` インターフェースには映画ID別に全スケジュールを取得するメソッドが存在しない。

修正には以下のいずれかのアプローチが必要：
1. `IDataStore` に `getSchedulesByMovieId(movieId: string): Schedule[]` メソッドを追加する
2. `SqliteDataStore` に映画ID別クエリを実装する
3. `server.ts` で全日付を取得してフィルタリングする（非効率だが最小変更）

### バグ3の根本原因

`AppContext` の非同期初期化（`fetchAvailableDates` と `triggerRefresh`）が完了するまでの間、
`selectedDate` は `getTodayString()` の初期値を持つ。
`TimelinePage` はマウント時に `selectedDate` を使ってスケジュールを取得するが、
この時点では初期化が完了していない可能性がある。

根本的な問題は `AppContext` に「初期化完了フラグ」が存在しないことである。
各ページは `selectedDate` が確定したかどうかを判断できない。

---

## 正確性プロパティ

Property 1: バグ条件 — `onWatchlistToggle` コールバックの型整合性

_任意の_ 映画カードのウォッチリストボタンクリックに対して、修正後の `MoviesPage` は
`MovieCard` の `onWatchlistToggle` に `(movieId: string) => void` 型のコールバックを渡し、
`handleWatchlistToggle(movieId)` が正しい `movieId` 文字列で呼び出される。

**検証対象: 要件 2.2**

Property 2: バグ条件 — 映画別スケジュールの全日付取得

_任意の_ 有効な映画IDに対して、修正後の `GET /api/movies/:id/schedules` エンドポイントは
データストアに保存されている全日付のスケジュールを返す（今日の日付に限定しない）。

**検証対象: 要件 2.1, 2.3**

Property 3: バグ条件 — タイムラインの `selectedDate` 依存取得

_任意の_ `selectedDate` の値に対して、修正後の `TimelinePage` は `selectedDate` が
変更されるたびに正しい日付でスケジュールを取得し、古いリクエストのレスポンスで
新しいリクエストのレスポンスが上書きされない。

**検証対象: 要件 2.4**

Property 4: 保全 — スケジュールタブの動作不変

_任意の_ 日付に対して、修正後の `GET /api/schedules?date=YYYY-MM-DD` エンドポイントは
修正前と同一の結果を返す。`SchedulePage` の動作は変更されない。

**検証対象: 要件 3.1, 3.2**

Property 5: 保全 — 作品一覧フィルタリングの動作不変

_任意の_ フィルター条件（ステータス・検索クエリ）に対して、修正後の `MoviesPage` は
修正前と同一のフィルタリング・ソート結果を返す。

**検証対象: 要件 3.3, 3.4**

---

## 修正実装

### 変更1: `MoviesPage.tsx` — `onWatchlistToggle` コールバックの修正

**ファイル:** `cinema-schedule-manager/packages/frontend/src/pages/MoviesPage.tsx`

**変更箇所:** `MovieCard` に渡す `onWatchlistToggle` プロパティ（行 107-110 付近）

**具体的な変更:**
```tsx
// 修正前（不具合あり）
<div
  key={movie.id}
  onClick={() => navigate(`/movies/${movie.id}`)}
  className="cursor-pointer"
  role="link"
  tabIndex={0}
  onKeyDown={e => e.key === 'Enter' && navigate(`/movies/${movie.id}`)}
  aria-label={`${movie.title}の詳細を見る`}
>
  <MovieCard
    movie={movie}
    isWatchlisted={watchlist.includes(movie.id)}
    onWatchlistToggle={e => {
      e.stopPropagation?.();
      handleWatchlistToggle(movie.id);
    }}
  />
</div>

// 修正後（型整合性を確保）
<div
  key={movie.id}
  onClick={() => navigate(`/movies/${movie.id}`)}
  className="cursor-pointer"
  role="link"
  tabIndex={0}
  onKeyDown={e => e.key === 'Enter' && navigate(`/movies/${movie.id}`)}
  aria-label={`${movie.title}の詳細を見る`}
>
  <MovieCard
    movie={movie}
    isWatchlisted={watchlist.includes(movie.id)}
    onWatchlistToggle={(movieId: string) => {
      // stopPropagation は MovieCard 内部の onClick で処理されるため不要
      handleWatchlistToggle(movieId);
    }}
  />
</div>
```

**変更の理由:**
- `onWatchlistToggle` の型シグネチャ `(movieId: string) => void` に合わせる
- `stopPropagation` は `MovieCard` 内部の `onClick={() => onWatchlistToggle(movie.id)}` が
  `div` の `onClick` に伝播しないよう、`MovieCard` 内部で処理するか、
  `div` の `onClick` ハンドラで `event.target` を確認する方式に変更する

---

### 変更2: `IDataStore` インターフェースへのメソッド追加

**ファイル:** `cinema-schedule-manager/packages/backend/src/types/index.ts`

**具体的な変更:**
```typescript
// IDataStore インターフェースに追加
interface IDataStore {
  // ... 既存のメソッド ...

  /**
   * 指定映画IDの全日付スケジュールを取得する（要件4.1）
   * @param movieId 映画ID
   * @returns スケジュールの配列（日付・開始時刻の昇順）
   */
  getSchedulesByMovieId(movieId: string): Schedule[];
}
```

---

### 変更3: `SqliteDataStore` への `getSchedulesByMovieId` 実装

**ファイル:** `cinema-schedule-manager/packages/backend/src/datastore/database.ts`

**具体的な変更:**
```typescript
/**
 * 指定映画IDの全日付スケジュールを取得する
 * 日付・開始時刻の昇順で返す
 * @param movieId 映画ID
 * @returns スケジュールの配列（日付・開始時刻の昇順）
 */
getSchedulesByMovieId(movieId: string): Schedule[] {
  const stmt = this.db.prepare(`
    SELECT * FROM schedules
    WHERE movie_id = ?
    ORDER BY date ASC, start_time ASC
  `);

  const rows = stmt.all(movieId) as ScheduleRow[];
  return rows.map(this.rowToSchedule);
}
```

---

### 変更4: `server.ts` の `GET /api/movies/:id/schedules` ハンドラ修正

**ファイル:** `cinema-schedule-manager/packages/backend/src/api/server.ts`

**具体的な変更:**
```typescript
// 修正前（不具合あり）
const today = new Date().toISOString().split('T')[0] as string;
const schedules = dataStore.getSchedulesByDate(today)
  .filter(s => s.movieId === movieId);

// 修正後（全日付のスケジュールを取得）
const schedules = dataStore.getSchedulesByMovieId(movieId);
```

---

### 変更5: `AppContext.tsx` の初期化タイミング修正

**ファイル:** `cinema-schedule-manager/packages/frontend/src/store/AppContext.tsx`

**具体的な変更:**

`AppState` に `isInitialized` フラグを追加し、非同期初期化完了後に `true` にセットする。
各ページは `isInitialized` が `true` になってからデータを取得する。

```typescript
// AppState に追加
interface AppState {
  // ... 既存フィールド ...
  isInitialized: boolean;  // 非同期初期化が完了したかどうか
}

// 初期状態
const initialState: AppState = {
  // ... 既存フィールド ...
  isInitialized: false,
};

// アクション追加
type AppAction =
  | // ... 既存アクション ...
  | { type: 'SET_INITIALIZED'; payload: boolean };

// リデューサーに追加
case 'SET_INITIALIZED':
  return { ...state, isInitialized: action.payload };

// 非同期初期化の完了後に SET_INITIALIZED をディスパッチ
useEffect(() => {
  async function initialLoad() {
    try {
      // ... 既存の初期化処理 ...
    } catch {
      // 失敗は無視する
    } finally {
      dispatch({ type: 'SET_INITIALIZED', payload: true });
    }
  }
  initialLoad();
}, []);
```

**`TimelinePage.tsx` の修正:**
```typescript
// isInitialized が true になってからデータを取得する
const { state, setLastUpdatedAt } = useAppContext();
const { selectedDate, isInitialized } = state;

useEffect(() => {
  if (!isInitialized) return;  // 初期化完了前はスキップ
  // ... 既存のデータ取得処理 ...
}, [selectedDate, isInitialized]);
```

---

## テスト戦略

### 検証アプローチ

テスト戦略は2フェーズで構成する：
1. **探索フェーズ**: 修正前のコードでバグを再現するテストを書き、根本原因を確認する
2. **修正検証フェーズ**: 修正後のコードでバグが解消され、既存動作が保全されることを確認する

---

### 探索的バグ条件チェック

**目標**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。
反証された場合は根本原因を再仮説する。

**テスト計画**: 各バグに対応するテストを修正前のコードで実行し、失敗を観察する。

**テストケース:**

1. **バグ1探索テスト**: `MoviesPage` の `onWatchlistToggle` に渡されるコールバックの型を検証する
   （修正前のコードで型不一致を確認）

2. **バグ2探索テスト**: `GET /api/movies/:id/schedules` に対して、今日以外の日付のスケジュールが
   存在する映画IDでリクエストし、空配列が返ることを確認する
   （修正前のコードで失敗することを確認）

3. **バグ3探索テスト**: `AppContext` の初期化完了前に `TimelinePage` がマウントされたとき、
   初期値の `selectedDate` でリクエストが飛ぶことを確認する
   （修正前のコードで二重リクエストを確認）

**期待される反例:**
- バグ2: `GET /api/movies/movie-abc/schedules` が `[]` を返す（今日のスケジュールが存在しない場合）
- バグ3: `selectedDate` が `getTodayString()` の初期値でリクエストが飛ぶ

---

### 修正チェック

**目標**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**疑似コード:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

---

### 保全チェック

**目標**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同一の結果を返すことを検証する。

**疑似コード:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**テストアプローチ**: 保全チェックにはプロパティベーステストを推奨する。理由：
- 入力ドメイン全体にわたって多数のテストケースを自動生成できる
- 手動ユニットテストでは見落としがちなエッジケースを検出できる
- 非バグ入力に対する動作不変性を強力に保証できる

**テストケース:**
1. **スケジュールタブ保全**: `GET /api/schedules?date=YYYY-MM-DD` が修正前後で同一の結果を返すことを検証
2. **作品一覧フィルタリング保全**: `filterByStatus`・`searchMovies`・`sortByStatus` が修正前後で同一の結果を返すことを検証
3. **ウォッチリスト操作保全**: `addToWatchlist`・`removeFromWatchlist` が修正前後で同一の動作をすることを検証

---

### ユニットテスト

- `getSchedulesByMovieId` が全日付のスケジュールを日付・開始時刻昇順で返すことを検証
- `GET /api/movies/:id/schedules` が全日付のスケジュールを返すことを検証
- `MoviesPage` の `onWatchlistToggle` が正しい `movieId` 文字列でコールバックを呼び出すことを検証
- `AppContext` の `isInitialized` フラグが非同期初期化完了後に `true` になることを検証
- `TimelinePage` が `isInitialized = false` のときにデータ取得をスキップすることを検証

### プロパティベーステスト

- 任意の映画IDに対して、`getSchedulesByMovieId` が返すスケジュールはすべて同じ `movieId` を持つ（フィルタリング正確性）
- 任意の映画IDに対して、`getSchedulesByMovieId` が返すスケジュールは日付・開始時刻の昇順に並んでいる（ソート正確性）
- 任意の日付に対して、`GET /api/schedules?date=YYYY-MM-DD` の結果は修正前後で変わらない（保全）
- 任意のウォッチリスト状態に対して、`filterByWatchlist` の結果は修正前後で変わらない（保全）

### インテグレーションテスト

- `MovieDetailPage` が全日付のスケジュールを日付別にグループ化して表示することを検証
- `TimelinePage` が `selectedDate` 変更後に正しい日付でスケジュールを取得することを検証
- `MoviesPage` でウォッチリストボタンをクリックしたとき、ウォッチリストが正しく更新されることを検証
- `WatchlistPage` が `selectedDate` に対応するスケジュールを正しく表示することを検証
