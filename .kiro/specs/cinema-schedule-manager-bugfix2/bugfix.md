# バグ修正要件ドキュメント

## はじめに

本ドキュメントは、シネマスケジュールマネージャーで報告された以下の3つのバグを修正するための要件を定義する。

1. **日付固定バグ**: スクレイパーが取得・保存するスケジュールの日付がすべて同一の日付（例: 2025-07-04）になってしまう
2. **ステータス欠落バグ**: `upcoming`（上映予定）・`ending_soon`（終了間近）ステータスの映画が作品一覧に表示されない
3. **ウォッチリストタイトル欠落バグ**: スケジュールが存在しない映画をウォッチリストに追加した場合、映画タイトルの代わりに映画IDが表示される

---

## バグ分析

### 現在の動作（不具合）

**バグ1: 日付固定**

1.1 WHEN スクレイパーが特定の日付のスケジュールを取得する THEN システムはすべてのスケジュールを同一の固定日付（例: 2025-07-04）で保存する

1.2 WHEN 日付ナビゲーターで異なる日付を選択する THEN システムはすべての日付で同一のスケジュールデータを返す

1.3 WHEN `parseScheduleDate()` が HTML から日付を取得できない THEN システムはリクエストした日付ではなく誤った日付にフォールバックする

**バグ2: ステータス欠落**

1.4 WHEN スクレイパーが `upcoming`（上映予定）ステータスの映画を取得する THEN システムはその映画を `showing`（上映中）として保存する

1.5 WHEN スクレイパーが `ending_soon`（終了間近）ステータスの映画を取得する THEN システムはその映画を `showing`（上映中）として保存する

1.6 WHEN ユーザーが作品一覧で「上映予定」フィルターを選択する THEN システムは該当する映画を表示しない（0件になる）

1.7 WHEN ユーザーが作品一覧で「終了間近」フィルターを選択する THEN システムは該当する映画を表示しない（0件になる）

**バグ3: ウォッチリストタイトル欠落**

1.8 WHEN スケジュールが存在しない映画がウォッチリストに登録されている THEN システムは映画タイトルの代わりに映画ID（数字文字列）を表示する

1.9 WHEN 選択中の日付に上映スケジュールがない映画がウォッチリストに登録されている THEN システムは映画タイトルを正しく表示できない

---

### 期待される動作（正しい動作）

**バグ1: 日付固定**

2.1 WHEN スクレイパーが特定の日付のスケジュールを取得する THEN システムはリクエストした日付（またはサイトが返した実際の日付）でスケジュールを保存する SHALL

2.2 WHEN 日付ナビゲーターで異なる日付を選択する THEN システムはその日付に対応するスケジュールデータを返す SHALL

2.3 WHEN `parseScheduleDate()` が HTML から日付を取得できない THEN システムはリクエストした日付をそのまま使用する SHALL

**バグ2: ステータス欠落**

2.4 WHEN スクレイパーが `upcoming`（上映予定）ステータスの映画を取得する THEN システムはその映画を `upcoming` ステータスで保存する SHALL

2.5 WHEN スクレイパーが `ending_soon`（終了間近）ステータスの映画を取得する THEN システムはその映画を `ending_soon` ステータスで保存する SHALL

2.6 WHEN ユーザーが作品一覧で「上映予定」フィルターを選択する THEN システムは `upcoming` ステータスの映画を正しく表示する SHALL

2.7 WHEN ユーザーが作品一覧で「終了間近」フィルターを選択する THEN システムは `ending_soon` ステータスの映画を正しく表示する SHALL

**バグ3: ウォッチリストタイトル欠落**

2.8 WHEN スケジュールが存在しない映画がウォッチリストに登録されている THEN システムは映画IDではなく正しい映画タイトルを表示する SHALL

2.9 WHEN 選択中の日付に上映スケジュールがない映画がウォッチリストに登録されている THEN システムはバックエンドの映画データから映画タイトルを取得して表示する SHALL

---

### 変更してはならない動作（リグレッション防止）

3.1 WHEN スクレイパーが正常に日付付きスケジュールを取得できる THEN システムはそのスケジュールデータを引き続き正しく保存する SHALL CONTINUE TO

3.2 WHEN ユーザーが作品一覧で「上映中」フィルターを選択する THEN システムは `showing` ステータスの映画を引き続き正しく表示する SHALL CONTINUE TO

3.3 WHEN ユーザーが作品一覧で「すべて」フィルターを選択する THEN システムはすべてのステータスの映画を引き続き表示する SHALL CONTINUE TO

3.4 WHEN スケジュールが存在する映画がウォッチリストに登録されている THEN システムはその映画のスケジュールと映画タイトルを引き続き正しく表示する SHALL CONTINUE TO

3.5 WHEN ウォッチリストから映画を削除する THEN システムはその映画をウォッチリストから引き続き正しく削除する SHALL CONTINUE TO

3.6 WHEN スクレイパーが HTTP エラーを受け取る THEN システムは既存のデータを引き続き保持する SHALL CONTINUE TO

3.7 WHEN 映画をウォッチリストに追加する THEN システムはその映画IDをローカルストレージに引き続き正しく保存する SHALL CONTINUE TO

---

## バグ条件の定義

### バグ1: 日付固定

```pascal
FUNCTION isBugCondition_DateFixed(X)
  INPUT: X of type ScrapeRequest { requestedDate: string, parsedDate: string | null }
  OUTPUT: boolean

  // スクレイパーが返す日付がリクエストした日付と異なる場合にバグ条件が成立する
  RETURN X.parsedDate ≠ null AND X.parsedDate ≠ X.requestedDate
    OR X.parsedDate = null AND savedDate ≠ X.requestedDate
END FUNCTION

// Property: Fix Checking - 日付固定バグ修正
FOR ALL X WHERE isBugCondition_DateFixed(X) DO
  result ← scrapeAndSave'(X)
  ASSERT result.savedDate = X.requestedDate OR result.savedDate = X.parsedDate
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_DateFixed(X) DO
  ASSERT scrapeAndSave(X) = scrapeAndSave'(X)
END FOR
```

### バグ2: ステータス欠落

```pascal
FUNCTION isBugCondition_StatusLost(X)
  INPUT: X of type MovieFromShowing { id: string, status: ShowingStatus }
  OUTPUT: boolean

  // showing ページから取得した映画のステータスが 'showing' 以外の場合にバグ条件が成立する
  RETURN X.status = 'upcoming' OR X.status = 'ending_soon'
END FUNCTION

// Property: Fix Checking - ステータス欠落バグ修正
FOR ALL X WHERE isBugCondition_StatusLost(X) DO
  result ← saveMovie'(X)
  ASSERT result.status = X.status
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_StatusLost(X) DO
  ASSERT saveMovie(X).status = saveMovie'(X).status
END FOR
```

### バグ3: ウォッチリストタイトル欠落

```pascal
FUNCTION isBugCondition_WatchlistTitle(X)
  INPUT: X of type WatchlistEntry { movieId: string, schedulesForDate: Schedule[] }
  OUTPUT: boolean

  // 選択中の日付にスケジュールが存在しない場合にバグ条件が成立する
  RETURN X.schedulesForDate.length = 0
END FUNCTION

// Property: Fix Checking - ウォッチリストタイトル欠落バグ修正
FOR ALL X WHERE isBugCondition_WatchlistTitle(X) DO
  result ← renderWatchlistEntry'(X)
  ASSERT result.displayedTitle ≠ X.movieId
    AND result.displayedTitle ≠ ''
    AND result.displayedTitle = correctMovieTitle(X.movieId)
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_WatchlistTitle(X) DO
  ASSERT renderWatchlistEntry(X).displayedTitle = renderWatchlistEntry'(X).displayedTitle
END FOR
```
