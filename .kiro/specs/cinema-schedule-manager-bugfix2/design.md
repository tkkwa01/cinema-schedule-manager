# Cinema Schedule Manager バグ修正2 設計ドキュメント

## 概要

本ドキュメントは、Cinema Schedule Manager アプリケーションで報告された以下の3つのバグを修正するための設計を定義する。

1. **バグ1**: 日付固定 — スクレイピングで保存されるスケジュールの日付がすべて同一になる
2. **バグ2**: ステータス欠落 — `upcoming`・`ending_soon` ステータスの映画が作品一覧に表示されない
3. **バグ3**: ウォッチリストタイトル欠落 — スケジュールがない映画のタイトルが映画IDになる

---

## 用語集

- **Bug_Condition (C)**: バグが発現する条件
- **Property (P)**: バグ条件が成立するときの期待される正しい動作
- **Preservation（保全）**: 修正によって変更されてはならない既存の動作
- **`actualDate`**: スクレイパーが HTML から取得した実際の日付（YYYY-MM-DD形式）
- **`requestedDate`**: スクレイパーに渡されたリクエスト日付（YYYY-MM-DD形式）
- **`parseScheduleDate`**: `parser.ts` のメソッド。HTML から実際の日付を取得する
- **`showingResult`**: `scrapeShowing()` の結果。`showing`・`upcoming`・`endingSoon` を含む
- **`scheduleMovies`**: `cronScheduler.ts` で movies テーブルに保存する映画データの配列

---

## バグ詳細

### バグ1: 日付固定

#### バグ条件

`parseScheduleDate()` が HTML 内の `date=YYYYMMDD` パターンにマッチし、ページ内に含まれる任意の日付（カレンダーリンクなど）を返す。その結果、`actualDate` が常に同じ日付（例: 2025-07-04）になる。

**形式的仕様:**
```
FUNCTION isBugCondition_DateFixed(requestedDate, parsedDate)
  INPUT: requestedDate は YYYY-MM-DD 形式のリクエスト日付
         parsedDate は parseScheduleDate() が返した日付（null の場合もある）
  OUTPUT: boolean

  RETURN parsedDate ≠ null AND parsedDate ≠ requestedDate
         -- HTML 内の別の日付にマッチして誤った日付が返される
END FUNCTION
```

**具体的な不具合箇所（`parser.ts` の `parseScheduleDate`）:**
```typescript
// 現在の不具合コード
const linkMatch = html.match(/[?&]date=(\d{8})/);
if (linkMatch?.[1]) {
  const d = linkMatch[1];
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}
```

HTML 内に `date=20250704` のようなパターンが複数存在する場合（カレンダーリンク等）、最初にマッチしたものを返すため、リクエストした日付と異なる日付が返される。

**修正方針:**
`parseScheduleDate()` が `null` を返した場合、`cronScheduler.ts` 側で `requestedDate` をそのまま `actualDate` として使用する。現在のコードは既に `?? date` でフォールバックしているが、`parseScheduleDate()` が誤った日付を返す場合に対応できていない。

修正後は `parseScheduleDate()` を廃止し、`actualDate` を常に `requestedDate`（スクレイパーに渡した日付）とする。

**修正後のコード（`cronScheduler.ts`）:**
```typescript
// 修正後: サイトが返した日付ではなくリクエストした日付を使用する
const actualDate = today; // parseScheduleDate() を使わない
```

#### 具体例

- **期待**: `scrapeSchedule('2025-07-05')` → `actualDate = '2025-07-05'`
- **現状**: `parseScheduleDate()` が HTML 内の `date=20250704` にマッチ → `actualDate = '2025-07-04'`

---

### バグ2: ステータス欠落

#### バグ条件

`cronScheduler.ts` の `scheduleMovies` 生成部分で `status: 'showing' as const` とハードコードされており、`showingResult` から取得した `upcoming`・`ending_soon` のステータスが無視される。

**形式的仕様:**
```
FUNCTION isBugCondition_StatusLost(movie)
  INPUT: movie は showingResult から取得した映画データ
  OUTPUT: boolean

  RETURN movie.status = 'upcoming' OR movie.status = 'ending_soon'
         -- showing 以外のステータスを持つ映画がバグ条件に該当する
END FUNCTION
```

**具体的な不具合箇所（`cronScheduler.ts` 行 ~160）:**
```typescript
// 現在の不具合コード
const scheduleMovies = Array.from(movieMap.entries()).map(([id, title]) => ({
  id,
  title,
  status: 'showing' as const,  // ← すべて 'showing' にハードコード
  hasSubtitle: false,
  formats: [],
  createdAt: updatedAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
}));
```

`showingResult.data.upcoming` や `showingResult.data.endingSoon` から取得した映画IDが `movieMap` に追加されるが、`status` は常に `'showing'` になる。

**修正方針:**
`movieMap` を `Map<string, { title: string; status: ShowingStatus }>` に変更し、`showingResult` から取得したステータスを保持する。

**修正後のコード（`cronScheduler.ts`）:**
```typescript
// movieMap を title と status を持つオブジェクトに変更する
const movieMap = new Map<string, { title: string; status: ShowingStatus }>();

// スケジュールから映画を追加する（デフォルトは 'showing'）
scheduleEntries.forEach(entry => {
  const movieId = /* ... */;
  movieMap.set(movieId, { title: entry.movieTitle, status: 'showing' });
});

// showingResult から正しいステータスで映画を追加する
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

// movies テーブルに正しいステータスで保存する
const scheduleMovies = Array.from(movieMap.entries()).map(([id, { title, status }]) => ({
  id,
  title,
  status,  // ← 正しいステータスを使用
  hasSubtitle: false,
  formats: [],
  createdAt: updatedAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
}));
```

#### 具体例

- **期待**: `upcoming` ステータスの映画 → `status: 'upcoming'` で保存される
- **現状**: `upcoming` ステータスの映画 → `status: 'showing'` で保存される

---

### バグ3: ウォッチリストタイトル欠落

#### バグ条件

`WatchlistPage.tsx` で、選択中の日付にスケジュールが存在しない映画のタイトルを `movieSchedules[0]?.movieTitle ?? movieId` で取得しているため、スケジュールが空の場合に映画IDがタイトルとして表示される。

**形式的仕様:**
```
FUNCTION isBugCondition_WatchlistTitle(movieId, schedulesForDate)
  INPUT: movieId はウォッチリストに登録された映画ID
         schedulesForDate は選択中の日付のスケジュール一覧
  OUTPUT: boolean

  RETURN schedulesForDate.filter(s => s.movieId = movieId).length = 0
         -- 選択中の日付にスケジュールが存在しない
END FUNCTION
```

**具体的な不具合箇所（`WatchlistPage.tsx` 行 ~80）:**
```tsx
// 現在の不具合コード
const movieTitle = movieSchedules[0]?.movieTitle ?? movieId;
// ↑ スケジュールが空のとき movieId（数字文字列）がタイトルになる
```

**修正方針:**
`WatchlistPage.tsx` に映画一覧を取得する処理を追加し、スケジュールが存在しない映画のタイトルを `fetchMovies()` の結果から補完する。

**修正後のコード（`WatchlistPage.tsx`）:**
```tsx
// 映画一覧を取得してタイトルを補完する
const [movies, setMovies] = useState<Movie[]>([]);

useEffect(() => {
  async function loadMovies() {
    const { data } = await fetchMovies();
    if (data) setMovies(data.data);
  }
  loadMovies();
}, []);

// タイトル取得: スケジュールから取得できない場合は映画一覧から補完する
const movieTitle =
  movieSchedules[0]?.movieTitle ??
  movies.find(m => m.id === movieId)?.title ??
  movieId; // 最終フォールバック
```

#### 具体例

- **期待**: スケジュールなし映画 → `movies` API から取得したタイトルを表示
- **現状**: スケジュールなし映画 → 映画ID（例: `"3742"`）を表示

---

## 期待される動作

### 保全要件

**変更されない動作:**
- スクレイパーが正常に動作している場合のスケジュール保存処理は変更しない
- `GET /api/schedules?date=YYYY-MM-DD` エンドポイントの動作は変更しない
- `showing` ステータスの映画の保存・表示は変更しない
- スケジュールが存在する映画のウォッチリスト表示は変更しない
- ウォッチリストへの追加・削除機能は変更しない

---

## 正確性プロパティ

**Property 1: バグ条件 — 日付固定**

任意のリクエスト日付に対して、修正後の `cronScheduler.ts` は `actualDate` として常にリクエスト日付を使用し、スケジュールを正しい日付で保存する。

**検証対象: 要件 2.1, 2.2, 2.3**

**Property 2: バグ条件 — ステータス欠落**

任意の映画に対して、修正後の `cronScheduler.ts` は `showingResult` から取得したステータス（`showing`・`upcoming`・`ending_soon`）を正しく保存する。

**検証対象: 要件 2.4, 2.5, 2.6, 2.7**

**Property 3: バグ条件 — ウォッチリストタイトル欠落**

任意のウォッチリスト登録映画に対して、修正後の `WatchlistPage.tsx` は選択中の日付にスケジュールが存在しない場合でも、映画IDではなく正しい映画タイトルを表示する。

**検証対象: 要件 2.8, 2.9**

**Property 4: 保全 — 日付正常時の動作不変**

スクレイパーが正常に動作している場合（バグ条件が成立しない入力）、修正前後でスケジュールの保存結果は変わらない。

**検証対象: 要件 3.1**

**Property 5: 保全 — `showing` ステータスの動作不変**

`showing` ステータスの映画（バグ条件が成立しない入力）は、修正前後で同じステータスで保存される。

**検証対象: 要件 3.2, 3.3**

**Property 6: 保全 — スケジュールあり映画のウォッチリスト表示不変**

スケジュールが存在する映画（バグ条件が成立しない入力）は、修正前後で同じタイトルが表示される。

**検証対象: 要件 3.4, 3.5**

---

## 修正実装

### 変更1: `cronScheduler.ts` — `actualDate` を `requestedDate` に固定する

**ファイル:** `cinema-schedule-manager/packages/backend/src/scheduler/cronScheduler.ts`

**変更箇所:** `runUpdate()` メソッド内の `actualDate` 取得部分

```typescript
// 修正前
const actualDate = scheduleResult.data.date;

// 修正後
// サイトが返す日付ではなくリクエストした日付を使用する
// （parseScheduleDate がページ内の別の日付にマッチする問題を回避）
const actualDate = today;
```

### 変更2: `cronScheduler.ts` — `movieMap` にステータスを保持する

**ファイル:** `cinema-schedule-manager/packages/backend/src/scheduler/cronScheduler.ts`

**変更箇所:** `movieMap` の型定義と `showingResult` の処理部分

```typescript
// 修正前
const movieMap = new Map<string, string>(); // movieId -> movieTitle
// ...
status: 'showing' as const,

// 修正後
const movieMap = new Map<string, { title: string; status: ShowingStatus }>();
// showingResult から正しいステータスで追加する
showingResult.data.showing.forEach(m => movieMap.set(m.id, { title: m.title, status: 'showing' }));
showingResult.data.upcoming.forEach(m => movieMap.set(m.id, { title: m.title, status: 'upcoming' }));
showingResult.data.endingSoon.forEach(m => movieMap.set(m.id, { title: m.title, status: 'ending_soon' }));
// ...
const scheduleMovies = Array.from(movieMap.entries()).map(([id, { title, status }]) => ({
  id, title, status, /* ... */
}));
```

### 変更3: `WatchlistPage.tsx` — 映画一覧からタイトルを補完する

**ファイル:** `cinema-schedule-manager/packages/frontend/src/pages/WatchlistPage.tsx`

**変更箇所:** 映画一覧の取得と `movieTitle` の取得ロジック

```tsx
// 追加: 映画一覧を取得する
const [movies, setMovies] = useState<Movie[]>([]);

useEffect(() => {
  async function loadMovies() {
    const { data } = await fetchMovies();
    if (data) setMovies(data.data);
  }
  loadMovies();
}, []);

// 修正前
const movieTitle = movieSchedules[0]?.movieTitle ?? movieId;

// 修正後
const movieTitle =
  movieSchedules[0]?.movieTitle ??
  movies.find(m => m.id === movieId)?.title ??
  movieId;
```

---

## テスト戦略

### 探索的バグ条件チェック

**バグ1探索テスト:**
- `cronScheduler.ts` の `runUpdate()` に `parseScheduleDate()` が誤った日付を返すモックを渡し、保存される `actualDate` がリクエスト日付と一致することを確認する

**バグ2探索テスト:**
- `showingResult` に `upcoming`・`ending_soon` の映画を含むモックを渡し、保存される映画のステータスが正しいことを確認する

**バグ3探索テスト:**
- スケジュールが空の状態で `WatchlistPage` をレンダリングし、映画IDではなく映画タイトルが表示されることを確認する

### 保全チェック

**保全テスト1:** `showing` ステータスの映画は修正前後で同じステータスで保存される
**保全テスト2:** スケジュールが存在する映画のウォッチリスト表示は変わらない
**保全テスト3:** `GET /api/schedules?date=YYYY-MM-DD` の動作は変わらない
