# 要件ドキュメント

## はじめに

本機能は、シネマスケジュールマネージャーの UI/UX を改善する2つの変更を含む。

1. **スケジュールタブの表示統合**: 現在は上映回ごとに個別カードが表示されているが、1作品1カードに統合し、カードクリックで作品詳細ページへ遷移できるようにする。
2. **作品詳細ページへの紹介文表示**: シネマシティ公式サイトの映画詳細ページ（`https://res.cinemacity.co.jp/TicketReserver/studio/movie/{movieId}`）から作品紹介文をスクレイピングし、作品詳細ページに表示する。

## 用語集

- **SchedulePage（スケジュールページ）**: 日付別の上映スケジュールを表示するタブ（現在の「スケジュール」タブ）
- **MoviesPage（作品ページ）**: 上映中・上映予定の作品一覧を表示するタブ（現在の「作品」タブ）
- **MovieDetailPage（作品詳細ページ）**: 特定の映画の詳細情報と上映スケジュールを表示するページ（`/movies/:id`）
- **MovieCard（作品カード）**: MoviesPage で使用する映画情報カードコンポーネント
- **ScheduleCard（スケジュールカード）**: SchedulePage で使用する上映回情報カードコンポーネント
- **MovieSummaryCard（作品サマリーカード）**: SchedulePage で新たに使用する、1作品1カードの統合表示コンポーネント
- **Scraper（スクレイパー）**: シネマシティ公式サイトからHTMLを取得するモジュール（`CinemaCityScheduleScraper`）
- **Parser（パーサー）**: 取得したHTMLを構造化データに変換するモジュール（`CinemaCityParser`）
- **MovieDescription（作品紹介文）**: シネマシティ公式サイトの映画詳細ページに掲載されている作品の説明テキスト
- **DataStore（データストア）**: スクレイピング結果を永続化するSQLiteデータベース層（`IDataStore`）

---

## 要件

### 要件1: スケジュールタブの作品単位カード表示

**ユーザーストーリー:** 映画ファンとして、スケジュールタブで同じ作品の上映回をまとめて1枚のカードで確認したい。そうすることで、その日に上映されている作品の全体像を素早く把握できる。

#### 受け入れ基準

1. WHEN SchedulePage が表示される時、THE SchedulePage SHALL 同一 `movieId` を持つ全上映回を1枚の MovieSummaryCard に統合して表示する
2. THE MovieSummaryCard SHALL 映画タイトルを表示する
3. THE MovieSummaryCard SHALL その作品の上映フォーマット（通常・極音・極爆）の一覧をバッジとして表示する
4. THE MovieSummaryCard SHALL その作品の上映時刻一覧（開始時刻）を表示する
5. THE MovieSummaryCard SHALL 劇場（シネマ・ワン / シネマ・ツー）ごとにセクションを分けて MovieSummaryCard を表示する
6. WHEN MovieSummaryCard がクリックされる時、THE SchedulePage SHALL `/movies/{movieId}` へ遷移する
7. WHEN `movieId` が存在しない上映回がある時、THE SchedulePage SHALL その上映回を MovieSummaryCard として表示し、クリック動作を無効にする
8. WHEN キーボードの Enter キーが MovieSummaryCard にフォーカスされた状態で押下される時、THE SchedulePage SHALL `/movies/{movieId}` へ遷移する

---

### 要件2: 作品タブからの作品詳細ページ遷移（既存動作の維持）

**ユーザーストーリー:** 映画ファンとして、作品タブの作品カードをクリックして作品詳細ページへ遷移したい。そうすることで、作品の詳細情報と上映スケジュールを確認できる。

#### 受け入れ基準

1. WHEN MovieCard がクリックされる時、THE MoviesPage SHALL `/movies/{movieId}` へ遷移する（既存動作を維持する）
2. WHEN キーボードの Enter キーが MovieCard にフォーカスされた状態で押下される時、THE MoviesPage SHALL `/movies/{movieId}` へ遷移する（既存動作を維持する）

---

### 要件3: 映画詳細ページの作品紹介文スクレイピング

**ユーザーストーリー:** 映画ファンとして、作品詳細ページで作品の紹介文を読みたい。そうすることで、映画を観るかどうかの判断材料にできる。

#### 受け入れ基準

1. WHEN `scrapeMovieDetail(movieId)` が呼び出される時、THE Scraper SHALL `https://res.cinemacity.co.jp/TicketReserver/studio/movie/{movieId}` のHTMLを取得する
2. WHEN 映画詳細ページのHTMLが取得できる時、THE Parser SHALL 作品紹介文テキストを抽出して `MovieDescription` として返す
3. IF 映画詳細ページのHTMLに紹介文要素が存在しない時、THEN THE Parser SHALL `MovieDescription` として空文字列を返す
4. IF 映画詳細ページの取得に失敗する時（HTTPエラー・ネットワークエラー）、THEN THE Scraper SHALL エラーをログに記録し、`success: false` の `ScrapeResult` を返す
5. THE Parser SHALL 映画詳細ページのパース処理で例外をスローしない（パースエラー時はデフォルト値を返す）
6. FOR ALL 有効な映画詳細ページHTML、THE Parser SHALL パース後に再度パースしても同一の `MovieDescription` を返す（冪等性）

---

### 要件4: 映画詳細データモデルへの紹介文フィールド追加

**ユーザーストーリー:** 開発者として、映画の紹介文をデータモデルに含めたい。そうすることで、フロントエンドが紹介文を表示できるようになる。

#### 受け入れ基準

1. THE DataStore SHALL `Movie` エンティティに `description` フィールド（文字列型、省略可能）を追加する
2. WHEN `saveMovies(movies)` が呼び出される時、THE DataStore SHALL `description` フィールドを含めて永続化する
3. WHEN `getMovieById(id)` が呼び出される時、THE DataStore SHALL `description` フィールドを含む `Movie` オブジェクトを返す
4. WHEN `getMovies(filter)` が呼び出される時、THE DataStore SHALL `description` フィールドを含む `Movie` オブジェクトの配列を返す
5. IF `description` が未取得の映画の場合、THE DataStore SHALL `description` フィールドを `undefined` または空文字列として返す

---

### 要件5: 映画詳細取得APIエンドポイントの追加

**ユーザーストーリー:** フロントエンド開発者として、映画IDを指定して映画の詳細情報（紹介文を含む）を取得するAPIを使いたい。そうすることで、作品詳細ページに紹介文を表示できる。

#### 受け入れ基準

1. THE Server SHALL `GET /api/movies/:id` エンドポイントを提供する
2. WHEN `GET /api/movies/:id` が有効な映画IDで呼び出される時、THE Server SHALL `description` フィールドを含む `Movie` オブジェクトを `ApiResponse<Movie>` 形式で返す
3. IF 指定された映画IDが存在しない時、THEN THE Server SHALL HTTP 404 と `MOVIE_NOT_FOUND` エラーコードを返す
4. WHEN `GET /api/movies/:id` が呼び出される時、THE Server SHALL レスポンスをメモリキャッシュに保存し、TTL内の再リクエストにはキャッシュから返す

---

### 要件6: 作品詳細ページへの紹介文表示

**ユーザーストーリー:** 映画ファンとして、作品詳細ページで作品の紹介文を読みたい。そうすることで、映画の内容を事前に把握できる。

#### 受け入れ基準

1. WHEN MovieDetailPage が表示される時、THE MovieDetailPage SHALL `GET /api/movies/:id` を呼び出して映画詳細情報を取得する
2. WHEN `description` フィールドが空でない文字列の場合、THE MovieDetailPage SHALL 作品紹介文セクションを表示する
3. IF `description` フィールドが空文字列または `undefined` の場合、THEN THE MovieDetailPage SHALL 作品紹介文セクションを表示しない
4. WHILE データ取得中の場合、THE MovieDetailPage SHALL ローディングインジケーターを表示する
5. IF データ取得に失敗した場合、THEN THE MovieDetailPage SHALL エラーメッセージを表示する

---

### 要件7: スクレイピング処理への紹介文取得の統合

**ユーザーストーリー:** システム管理者として、定期スクレイピング時に映画の紹介文も自動取得したい。そうすることで、常に最新の紹介文が表示される。

#### 受け入れ基準

1. WHEN `scrapeShowing()` が実行される時、THE Scraper SHALL 取得した各映画IDに対して `scrapeMovieDetail(movieId)` を呼び出して紹介文を取得する
2. WHEN 映画詳細スクレイピングが成功する時、THE Scraper SHALL 取得した `description` を `Movie` エンティティに含めて DataStore に保存する
3. IF 特定の映画IDの詳細スクレイピングが失敗する時、THEN THE Scraper SHALL その映画の `description` を空文字列として保存し、他の映画の処理を継続する
4. WHILE 複数映画の詳細スクレイピングを実行する時、THE Scraper SHALL リクエスト間隔を最低1000ミリ秒空けてサーバー負荷を抑制する

---

### 要件8: 全タブへの日付切り替え表示と2週間表示対応

**ユーザーストーリー:** 映画ファンとして、スケジュール・作品・タイムライン・ウォッチリストのどのタブを表示していても日付を切り替えたい。そうすることで、タブを移動せずに任意の日付のコンテンツを確認できる。

#### 受け入れ基準

1. THE App SHALL スケジュール・作品・タイムライン・ウォッチリストの全タブのヘッダー領域に DateNavigator を表示する
2. WHEN DateNavigator で日付が選択される時、THE App SHALL AppContext の `selectedDate` を更新し、全タブで同一の選択日付を共有する
3. THE DateNavigator SHALL 今日を起点とした14日間（2週間分）の日付ボタンを表示する
4. WHEN `availableDates` がバックエンドから取得できる時、THE DateNavigator SHALL `availableDates` の日付を表示する（`availableDates` が空の場合は `generateDateRangeFromToday()` による14日間をフォールバックとして使用する）
5. WHEN タブを切り替える時、THE App SHALL 切り替え前後で `selectedDate` を変更しない（日付選択状態はタブをまたいで維持される）
6. THE DateNavigator SHALL 現在選択中の日付ボタンを視覚的に強調表示する
7. WHEN DateNavigator の日付ボタンがキーボードでフォーカスされ Enter キーが押下される時、THE DateNavigator SHALL その日付を選択する
