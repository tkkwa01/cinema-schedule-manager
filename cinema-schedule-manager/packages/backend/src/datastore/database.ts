/**
 * データベース初期化モジュール
 * better-sqlite3 を使用して SQLite データベースへの接続・マイグレーション・
 * IDataStore インターフェースの実装を提供する
 */

import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import type {
  IDataStore,
  Movie,
  Schedule,
  MovieFilter,
} from '../types/index.js';

// ============================================================
// データベースファイルパスの解決
// ============================================================

/** ESM環境での __dirname 相当のパスを取得する */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * データベースファイルのパスを解決する
 * 環境変数 DATABASE_PATH が設定されている場合はそのパスを使用し、
 * 未設定の場合はプロジェクトルートからの相対パス `data/cinema-schedule.db` を使用する
 */
function resolveDatabasePath(): string {
  if (process.env['DATABASE_PATH']) {
    return process.env['DATABASE_PATH'];
  }
  // プロジェクトルート（packages/backend/src/datastore から4階層上）
  const projectRoot = resolve(__dirname, '../../../../');
  return resolve(projectRoot, 'data/cinema-schedule.db');
}

// ============================================================
// データベース行の型定義（SQLite から取得した生データ）
// ============================================================

/** movies テーブルの行型 */
interface MovieRow {
  id: string;
  title: string;
  status: string;
  has_subtitle: number;
  formats: string;
  detail_url: string | null;
  /** 作品紹介文（未設定の場合は null） */
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** schedules テーブルの行型 */
interface ScheduleRow {
  id: number;
  movie_id: string;
  movie_title: string;
  date: string;
  theater: string;
  studio: string;
  start_time: string;
  end_time: string;
  format: string;
  created_at: string;
  updated_at: string;
}

/** metadata テーブルの行型 */
interface MetadataRow {
  key: string;
  value: string;
  updated_at: string;
}

// ============================================================
// SQLite データベースクラス
// ============================================================

/**
 * SQLite データストアの実装クラス
 * IDataStore インターフェースを実装し、better-sqlite3 の同期 API を使用する
 */
export class SqliteDataStore implements IDataStore {
  /** better-sqlite3 のデータベースインスタンス */
  private readonly db: Database.Database;

  /**
   * コンストラクタ
   * データベースファイルへの接続を確立し、マイグレーションを実行する
   * @param dbPath データベースファイルのパス（省略時は環境変数またはデフォルトパスを使用）
   */
  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? resolveDatabasePath();

    // データベースファイルのディレクトリが存在しない場合は作成する
    const dbDir = dirname(resolvedPath);
    try {
      mkdirSync(dbDir, { recursive: true });
    } catch (err) {
      // ディレクトリが既に存在する場合は無視する
      const error = err as NodeJS.ErrnoException;
      if (error.code !== 'EEXIST') {
        throw err;
      }
    }

    // データベース接続を確立する（ファイルが存在しない場合は自動作成）
    this.db = new Database(resolvedPath);

    // WAL モードを有効化してパフォーマンスを向上させる
    this.db.pragma('journal_mode = WAL');
    // 外部キー制約を有効化する
    this.db.pragma('foreign_keys = ON');

    // マイグレーションを実行してテーブルとインデックスを作成する
    this.runMigrations();
  }

  // ============================================================
  // マイグレーション
  // ============================================================

  /**
   * データベースマイグレーションを実行する
   * テーブルとインデックスが存在しない場合のみ作成する（冪等性を保証）
   */
  private runMigrations(): void {
    // トランザクション内でマイグレーションを実行して原子性を保証する
    const migrate = this.db.transaction(() => {
      // 映画作品テーブルの作成
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS movies (
          id          TEXT PRIMARY KEY,
          title       TEXT NOT NULL,
          status      TEXT NOT NULL,
          has_subtitle INTEGER DEFAULT 0,
          formats     TEXT NOT NULL,
          detail_url  TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        )
      `);

      // 上映スケジュールテーブルの作成
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schedules (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          movie_id    TEXT NOT NULL,
          movie_title TEXT NOT NULL,
          date        TEXT NOT NULL,
          theater     TEXT NOT NULL,
          studio      TEXT NOT NULL,
          start_time  TEXT NOT NULL,
          end_time    TEXT NOT NULL,
          format      TEXT NOT NULL,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL,
          FOREIGN KEY (movie_id) REFERENCES movies(id)
        )
      `);

      // メタデータテーブルの作成
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS metadata (
          key         TEXT PRIMARY KEY,
          value       TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        )
      `);

      // インデックスの作成
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
        CREATE INDEX IF NOT EXISTS idx_schedules_movie_id ON schedules(movie_id);
        CREATE INDEX IF NOT EXISTS idx_schedules_date_theater ON schedules(date, theater);
        CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(status);
      `);

      // description カラムの追加（既に存在する場合はエラーを無視する）
      try {
        this.db.exec(`ALTER TABLE movies ADD COLUMN description TEXT DEFAULT ''`);
      } catch {
        // カラムが既に存在する場合は無視する
      }
    });

    migrate();
  }

  // ============================================================
  // スケジュールデータの操作
  // ============================================================

  /**
   * 指定日付のスケジュールデータを保存する
   * 既存の同日付スケジュールをすべて削除してから新しいデータを挿入する（上書き冪等性）
   * トランザクションを使用して原子性を保証する
   * @param date 上映日（YYYY-MM-DD形式）
   * @param schedules 保存するスケジュールの配列
   */
  saveSchedules(date: string, schedules: Schedule[]): void {
    const now = new Date().toISOString();

    const save = this.db.transaction(() => {
      // 指定日付の既存スケジュールをすべて削除する
      const deleteStmt = this.db.prepare(
        'DELETE FROM schedules WHERE date = ?'
      );
      deleteStmt.run(date);

      // 新しいスケジュールデータを挿入する
      const insertStmt = this.db.prepare(`
        INSERT INTO schedules (
          movie_id, movie_title, date, theater, studio,
          start_time, end_time, format, created_at, updated_at
        ) VALUES (
          @movieId, @movieTitle, @date, @theater, @studio,
          @startTime, @endTime, @format, @createdAt, @updatedAt
        )
      `);

      for (const schedule of schedules) {
        insertStmt.run({
          movieId: schedule.movieId,
          movieTitle: schedule.movieTitle,
          date: schedule.date,
          theater: schedule.theater,
          studio: schedule.studio,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          format: schedule.format,
          createdAt: schedule.createdAt || now,
          updatedAt: schedule.updatedAt || now,
        });
      }
    });

    try {
      save();
    } catch (err) {
      // 書き込みエラー時はログに記録し、既存データを破壊しない（要件7.4）
      console.error('[DataStore] スケジュールデータの保存に失敗しました:', err);
      throw err;
    }
  }

  /**
   * 指定日付のスケジュールデータを取得する
   * 開始時刻の昇順で返す
   * @param date 上映日（YYYY-MM-DD形式）
   * @returns スケジュールの配列（開始時刻昇順）
   */
  getSchedulesByDate(date: string): Schedule[] {
    const stmt = this.db.prepare(`
      SELECT * FROM schedules
      WHERE date = ?
      ORDER BY start_time ASC
    `);

    const rows = stmt.all(date) as ScheduleRow[];
    return rows.map(this.rowToSchedule);
  }

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
    return rows.map(this.rowToSchedule.bind(this));
  }

  // ============================================================
  // 映画作品データの操作
  // ============================================================

  /**
   * 映画作品データを保存する
   * INSERT OR REPLACE を使用して既存データを上書きする
   * formats フィールドは JSON.stringify() でシリアライズして保存する
   * @param movies 保存する映画作品の配列
   */
  saveMovies(movies: Movie[]): void {
    const now = new Date().toISOString();

    const save = this.db.transaction(() => {
      const insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO movies (
          id, title, status, has_subtitle, formats,
          detail_url, description, created_at, updated_at
        ) VALUES (
          @id, @title, @status, @hasSubtitle, @formats,
          @detailUrl, @description, @createdAt, @updatedAt
        )
      `);

      for (const movie of movies) {
        insertStmt.run({
          id: movie.id,
          title: movie.title,
          status: movie.status,
          // SQLite には BOOLEAN 型がないため 0/1 で保存する
          hasSubtitle: movie.hasSubtitle ? 1 : 0,
          // formats 配列を JSON 文字列にシリアライズして保存する
          formats: JSON.stringify(movie.formats),
          detailUrl: movie.detailUrl ?? null,
          // description が未設定の場合は空文字列として保存する
          description: movie.description ?? '',
          createdAt: movie.createdAt || now,
          updatedAt: movie.updatedAt || now,
        });
      }
    });

    try {
      save();
    } catch (err) {
      // 書き込みエラー時はログに記録し、既存データを破壊しない（要件7.4）
      console.error('[DataStore] 映画データの保存に失敗しました:', err);
      throw err;
    }
  }

  /**
   * フィルター条件に合致する映画作品一覧を取得する
   * フィルター条件（status, search, hasSubtitle）に応じて WHERE 句を動的に構築する
   * @param filter フィルター条件（省略時は全件取得）
   * @returns 映画作品の配列
   */
  getMovies(filter?: MovieFilter): Movie[] {
    // WHERE 句の条件と対応するパラメータを動的に構築する
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.status !== undefined) {
      conditions.push('status = ?');
      params.push(filter.status);
    }

    if (filter?.search !== undefined && filter.search.length > 0) {
      // タイトルの部分一致検索（大文字小文字を区別しない）
      conditions.push('title LIKE ?');
      params.push(`%${filter.search}%`);
    }

    if (filter?.hasSubtitle !== undefined) {
      conditions.push('has_subtitle = ?');
      params.push(filter.hasSubtitle ? 1 : 0);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const stmt = this.db.prepare(`
      SELECT * FROM movies ${whereClause}
    `);

    const rows = stmt.all(...params) as MovieRow[];
    return rows.map(this.rowToMovie);
  }

  /**
   * 指定 ID の映画作品を取得する
   * @param id 映画 ID
   * @returns 映画作品（存在しない場合は null）
   */
  getMovieById(id: string): Movie | null {
    const stmt = this.db.prepare('SELECT * FROM movies WHERE id = ?');
    const row = stmt.get(id) as MovieRow | undefined;

    if (!row) {
      return null;
    }

    return this.rowToMovie(row);
  }

  // ============================================================
  // メタデータの操作
  // ============================================================

  /**
   * 最後にスクレイピングが成功した日時を取得する
   * metadata テーブルの key='last_scraped_at' から取得する
   * @returns 最終スクレイピング日時（未実行の場合は null）
   */
  getLastScrapedAt(): Date | null {
    const stmt = this.db.prepare(
      "SELECT value FROM metadata WHERE key = 'last_scraped_at'"
    );
    const row = stmt.get() as Pick<MetadataRow, 'value'> | undefined;

    if (!row) {
      return null;
    }

    const date = new Date(row.value);
    // 無効な日付の場合は null を返す
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  /**
   * 最後にスクレイピングが成功した日時を保存する
   * metadata テーブルに INSERT OR REPLACE で保存する
   * @param date 保存する日時
   */
  saveLastScrapedAt(date: Date): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO metadata (key, value, updated_at)
      VALUES ('last_scraped_at', ?, ?)
    `);

    try {
      stmt.run(date.toISOString(), now);
    } catch (err) {
      // 書き込みエラー時はログに記録する（要件7.4）
      console.error('[DataStore] 最終スクレイピング日時の保存に失敗しました:', err);
      throw err;
    }
  }

  // ============================================================
  // クリーンアップ
  // ============================================================

  /**
   * 指定日数より古いスケジュールデータを削除する
   * created_at が olderThanDays 日より古いスケジュールを削除する
   * @param olderThanDays 削除対象の経過日数（この日数より古いデータを削除）
   * @returns 削除したレコード数
   */
  deleteOldSchedules(olderThanDays: number): number {
    // 削除対象の基準日時を計算する（現在時刻から olderThanDays 日前）
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffIso = cutoffDate.toISOString();

    const stmt = this.db.prepare(
      'DELETE FROM schedules WHERE created_at < ?'
    );

    try {
      const result = stmt.run(cutoffIso);
      return result.changes;
    } catch (err) {
      // 削除エラー時はログに記録する（要件7.4）
      console.error('[DataStore] 古いスケジュールデータの削除に失敗しました:', err);
      throw err;
    }
  }

  // ============================================================
  // データベース接続の管理
  // ============================================================

  /**
   * データベース接続を閉じる
   * アプリケーション終了時に呼び出す
   */
  close(): void {
    this.db.close();
  }

  // ============================================================
  // 行データの変換ヘルパー
  // ============================================================

  /**
   * schedules テーブルの行データを Schedule 型に変換する
   * @param row データベースから取得した行データ
   * @returns Schedule 型のオブジェクト
   */
  private rowToSchedule(row: ScheduleRow): Schedule {
    return {
      id: row.id,
      movieId: row.movie_id,
      movieTitle: row.movie_title,
      date: row.date,
      theater: row.theater as Schedule['theater'],
      studio: row.studio,
      startTime: row.start_time,
      endTime: row.end_time,
      format: row.format,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * movies テーブルの行データを Movie 型に変換する
   * formats フィールドは JSON.parse() でデシリアライズする
   * @param row データベースから取得した行データ
   * @returns Movie 型のオブジェクト
   */
  private rowToMovie(row: MovieRow): Movie {
    let formats: string[] = [];
    try {
      formats = JSON.parse(row.formats) as string[];
    } catch {
      // JSON パースに失敗した場合は空配列を使用する
      console.error('[DataStore] formats フィールドの JSON パースに失敗しました:', row.formats);
      formats = [];
    }

    return {
      id: row.id,
      title: row.title,
      status: row.status as Movie['status'],
      // SQLite の 0/1 を boolean に変換する
      hasSubtitle: row.has_subtitle !== 0,
      formats,
      detailUrl: row.detail_url ?? undefined,
      // description が空文字列または null の場合は undefined として返す
      description: row.description ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ============================================================
// シングルトンインスタンスのエクスポート
// ============================================================

/**
 * デフォルトのデータストアインスタンス
 * アプリケーション全体で共有するシングルトンインスタンス
 */
export const dataStore: IDataStore = new SqliteDataStore();
