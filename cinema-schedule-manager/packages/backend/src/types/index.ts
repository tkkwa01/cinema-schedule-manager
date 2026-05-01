/**
 * バックエンド共通型定義
 * シネマスケジュールマネージャーで使用する全型定義をエクスポートする
 */

// ============================================================
// 基本型
// ============================================================

/** 上映ステータス: 上映中・上映予定・終了間近 */
export type ShowingStatus = 'showing' | 'upcoming' | 'ending_soon';

/** 劇場: シネマ・ワンまたはシネマ・ツー */
export type Theater = 'cinema-one' | 'cinema-two';

/** 上映フォーマット: 通常・極音・極爆またはその他の文字列 */
export type Format = '通常' | '極音' | '極爆' | string;

// ============================================================
// エンティティ型
// ============================================================

/** 映画作品 */
export interface Movie {
  /** 公式サイトの映画ID */
  id: string;
  /** 映画タイトル */
  title: string;
  /** 上映ステータス */
  status: ShowingStatus;
  /** 日本語字幕フラグ */
  hasSubtitle: boolean;
  /** 上映フォーマット一覧 */
  formats: Format[];
  /** 映画詳細ページURL（任意） */
  detailUrl?: string;
  /** 作品紹介文（任意） */
  description?: string;
  /** 作成日時（ISO 8601形式） */
  createdAt: string;
  /** 更新日時（ISO 8601形式） */
  updatedAt: string;
}

/** 上映スケジュール */
export interface Schedule {
  /** スケジュールID（自動採番） */
  id: number;
  /** 映画ID */
  movieId: string;
  /** 映画タイトル（非正規化） */
  movieTitle: string;
  /** 上映日（YYYY-MM-DD形式） */
  date: string;
  /** 劇場 */
  theater: Theater;
  /** スタジオ名（例: a studio, b studio） */
  studio: string;
  /** 上映開始時刻（HH:MM形式） */
  startTime: string;
  /** 上映終了時刻（HH:MM形式） */
  endTime: string;
  /** 上映フォーマット */
  format: Format;
  /** 作成日時（ISO 8601形式） */
  createdAt: string;
  /** 更新日時（ISO 8601形式） */
  updatedAt: string;
}

// ============================================================
// フィルター型
// ============================================================

/** 映画作品フィルター条件 */
export interface MovieFilter {
  /** 上映ステータスによるフィルター（任意） */
  status?: ShowingStatus;
  /** タイトル部分一致検索文字列（任意） */
  search?: string;
  /** 日本語字幕フラグによるフィルター（任意） */
  hasSubtitle?: boolean;
}

// ============================================================
// スクレイピング生データ型
// ============================================================

/** スクレイピングで取得した生のスケジュールデータ（パース前） */
export interface RawScheduleData {
  /** 上映日（YYYY-MM-DD形式） */
  date: string;
  /** 劇場名 */
  theater: string;
  /** スケジュールエントリ一覧 */
  entries: Array<{
    movieTitle: string;
    studio: string;
    timeSlot: string;
    format: string;
    theater?: string;
    startTime?: string;
    endTime?: string;
    movieId?: string;
  }>;
}

/** スクレイピングで取得した生の上映作品データ */
export interface RawShowingData {
  /** 上映中の作品一覧 */
  showing: Array<{ id: string; title: string; formats: string[] }>;
  /** 上映予定の作品一覧 */
  upcoming: Array<{ id: string; title: string; formats: string[] }>;
  /** 終了間近の作品一覧 */
  endingSoon: Array<{ id: string; title: string; formats: string[] }>;
  /** 日本語字幕付き作品一覧 */
  withSubtitle: Array<{ id: string; title: string }>;
}

/** スクレイピングで取得した生の映画詳細データ */
export interface RawMovieDetail {
  /** 映画ID */
  id: string;
  /** 映画タイトル */
  title: string;
  /** 上映フォーマット一覧 */
  formats: string[];
  /** 上映ステータス */
  status: ShowingStatus;
  /** 映画詳細ページURL（任意） */
  detailUrl?: string;
  /** 作品紹介文（任意） */
  description?: string;
}

// ============================================================
// ユーティリティ型
// ============================================================

/** スクレイピング結果のラッパー型 */
export interface ScrapeResult<T> {
  /** 成功フラグ */
  success: boolean;
  /** スクレイピングデータ（失敗時はnull） */
  data: T | null;
  /** エラーメッセージ（失敗時のみ） */
  error?: string;
  /** スクレイピング実行日時 */
  scrapedAt: Date;
}

/** データ更新結果 */
export interface UpdateResult {
  /** 成功フラグ */
  success: boolean;
  /** 更新日時 */
  updatedAt: Date;
  /** エラーメッセージ（失敗時のみ） */
  error?: string;
  /** 実際にスクレイピングされた日付（YYYY-MM-DD形式） */
  actualDate?: string;
}

/** APIレスポンスの共通ラッパー型 */
export interface ApiResponse<T> {
  /** レスポンスデータ */
  data: T;
  /** 最終更新日時（ISO 8601形式、未取得時はnull） */
  lastUpdatedAt: string | null;
  /** キャッシュから返されたデータかどうか */
  cached: boolean;
}

/** APIエラーレスポンス */
export interface ApiError {
  /** ユーザー向けエラーメッセージ */
  error: string;
  /** エラーコード（例: 'SCRAPING_IN_PROGRESS', 'DATA_NOT_FOUND'） */
  code: string;
  /** エラー発生日時（ISO 8601形式） */
  timestamp: string;
}

// ============================================================
// パーサー出力型
// ============================================================

/** パーサーが出力するスケジュールデータ */
export interface ParsedSchedule {
  movieTitle: string;
  studio: string;
  startTime: string;
  endTime: string;
  format: string;
  theater?: Theater;
  /** スケジュールページのリンクから取得した映画ID */
  movieId?: string;
}

/** パーサーが出力する上映作品データ */
export interface ParsedShowing {
  /** 映画ID */
  id: string;
  /** 映画タイトル */
  title: string;
  /** 上映フォーマット一覧 */
  formats: string[];
  /** 上映ステータス */
  status: ShowingStatus;
}

/** パーサーが出力する映画詳細データ */
export interface ParsedMovieDetail {
  /** 映画タイトル */
  title: string;
  /** 上映フォーマット一覧 */
  formats: string[];
  /** 上映ステータス */
  status: ShowingStatus;
  /** 作品紹介文（任意） */
  description?: string;
}

// ============================================================
// インターフェース型
// ============================================================

/** データストアのインターフェース */
export interface IDataStore {
  /** 指定日付のスケジュールデータを保存する */
  saveSchedules(date: string, schedules: Schedule[]): void;
  /** 指定日付のスケジュールデータを取得する */
  getSchedulesByDate(date: string): Schedule[];
  /**
   * 指定映画IDの全日付スケジュールを取得する
   * @param movieId 映画ID
   * @returns スケジュールの配列（日付・開始時刻の昇順）
   */
  getSchedulesByMovieId(movieId: string): Schedule[];
  /** 映画作品データを保存する */
  saveMovies(movies: Movie[]): void;
  /** フィルター条件に合致する映画作品一覧を取得する */
  getMovies(filter?: MovieFilter): Movie[];
  /** 指定IDの映画作品を取得する（存在しない場合はnull） */
  getMovieById(id: string): Movie | null;
  /** 最後にスクレイピングが成功した日時を取得する（未実行の場合はnull） */
  getLastScrapedAt(): Date | null;
  /** 最後にスクレイピングが成功した日時を保存する */
  saveLastScrapedAt(date: Date): void;
  /** 指定日数より古いスケジュールデータを削除し、削除件数を返す */
  deleteOldSchedules(olderThanDays: number): number;
}

/** スケジュールスクレイパーのインターフェース */
export interface IScheduleScraper {
  /** 指定日付の上映スケジュールをスクレイピングする */
  scrapeSchedule(date: string): Promise<ScrapeResult<RawScheduleData>>;
  /** 上映中・上映予定作品一覧をスクレイピングする */
  scrapeShowing(): Promise<ScrapeResult<RawShowingData>>;
  /** 指定IDの映画詳細情報をスクレイピングする */
  scrapeMovieDetail(movieId: string): Promise<ScrapeResult<RawMovieDetail>>;
}

/** HTMLパーサーのインターフェース */
export interface IParser {
  /** スケジュールページのHTMLをパースしてスケジュール一覧を返す */
  parseSchedulePage(html: string): ParsedSchedule[];
  /** 上映作品ページのHTMLをパースして作品一覧を返す */
  parseShowingPage(html: string): ParsedShowing[];
  /** 映画詳細ページのHTMLをパースして映画詳細を返す */
  parseMovieDetailPage(html: string): ParsedMovieDetail;
  /** "HH:MM (HH:MM)" 形式の時刻文字列を開始時刻と終了時刻に分解する */
  parseTimeSlot(timeStr: string): { startTime: string; endTime: string };
}

/** スケジューラーのインターフェース */
export interface IScheduler {
  /** スケジューラーを開始する */
  start(): void;
  /** スケジューラーを停止する */
  stop(): void;
  /** 手動更新を即時実行し、完了後に結果を返す */
  triggerManualUpdate(date?: string): Promise<UpdateResult>;
  /** 最後に更新が実行された日時を取得する（未実行の場合はnull） */
  getLastUpdateTime(): Date | null;
}
