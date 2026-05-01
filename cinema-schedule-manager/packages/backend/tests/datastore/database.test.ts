/**
 * データベース初期化モジュールのユニットテスト
 * SqliteDataStore クラスの各メソッドの動作を検証する
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteDataStore } from '../../src/datastore/database.js';
import type { Movie, Schedule } from '../../src/types/index.js';

// ============================================================
// テスト用ヘルパー関数
// ============================================================

/** テスト用の映画データを生成する */
function createTestMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'movie-001',
    title: 'テスト映画',
    status: 'showing',
    hasSubtitle: false,
    formats: ['通常'],
    detailUrl: 'https://example.com/movie/001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** テスト用のスケジュールデータを生成する */
function createTestSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 0, // 自動採番のため 0 を設定
    movieId: 'movie-001',
    movieTitle: 'テスト映画',
    date: '2024-01-15',
    theater: 'cinema-one',
    studio: 'a studio',
    startTime: '10:00',
    endTime: '12:00',
    format: '通常',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================
// テストスイート
// ============================================================

describe('SqliteDataStore', () => {
  let store: SqliteDataStore;

  beforeEach(() => {
    // テストごとにインメモリデータベースを使用する
    store = new SqliteDataStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  // ============================================================
  // マイグレーションのテスト
  // ============================================================

  describe('マイグレーション', () => {
    it('データベース初期化時にテーブルが作成される', () => {
      // テーブルが存在することを確認（エラーなく操作できれば OK）
      expect(() => store.getMovies()).not.toThrow();
      expect(() => store.getSchedulesByDate('2024-01-15')).not.toThrow();
      expect(() => store.getLastScrapedAt()).not.toThrow();
    });

    it('同じデータベースに対して複数回初期化しても問題ない（冪等性）', () => {
      // 2回目の初期化でエラーが発生しないことを確認
      expect(() => new SqliteDataStore(':memory:')).not.toThrow();
    });
  });

  // ============================================================
  // 映画データのテスト
  // ============================================================

  describe('saveMovies / getMovies', () => {
    it('映画データを保存して取得できる', () => {
      const movie = createTestMovie();
      store.saveMovies([movie]);

      const result = store.getMovies();
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(movie.id);
      expect(result[0]?.title).toBe(movie.title);
      expect(result[0]?.status).toBe(movie.status);
      expect(result[0]?.hasSubtitle).toBe(movie.hasSubtitle);
      expect(result[0]?.formats).toEqual(movie.formats);
    });

    it('formats 配列が正しくシリアライズ・デシリアライズされる', () => {
      const movie = createTestMovie({ formats: ['通常', '極音', '極爆'] });
      store.saveMovies([movie]);

      const result = store.getMovies();
      expect(result[0]?.formats).toEqual(['通常', '極音', '極爆']);
    });

    it('hasSubtitle フラグが正しく保存・取得される', () => {
      const movieWithSubtitle = createTestMovie({ id: 'sub-001', hasSubtitle: true });
      const movieWithoutSubtitle = createTestMovie({ id: 'nosub-001', hasSubtitle: false });
      store.saveMovies([movieWithSubtitle, movieWithoutSubtitle]);

      const result = store.getMovies();
      const sub = result.find(m => m.id === 'sub-001');
      const nosub = result.find(m => m.id === 'nosub-001');
      expect(sub?.hasSubtitle).toBe(true);
      expect(nosub?.hasSubtitle).toBe(false);
    });

    it('detailUrl が undefined の映画を保存・取得できる', () => {
      const movie = createTestMovie({ detailUrl: undefined });
      store.saveMovies([movie]);

      const result = store.getMovies();
      expect(result[0]?.detailUrl).toBeUndefined();
    });

    it('INSERT OR REPLACE で既存映画データを上書きできる', () => {
      const movie = createTestMovie({ title: '旧タイトル' });
      store.saveMovies([movie]);

      const updatedMovie = createTestMovie({ title: '新タイトル' });
      store.saveMovies([updatedMovie]);

      const result = store.getMovies();
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('新タイトル');
    });

    it('複数の映画データを一括保存できる', () => {
      const movies = [
        createTestMovie({ id: 'movie-001', title: '映画A' }),
        createTestMovie({ id: 'movie-002', title: '映画B' }),
        createTestMovie({ id: 'movie-003', title: '映画C' }),
      ];
      store.saveMovies(movies);

      const result = store.getMovies();
      expect(result).toHaveLength(3);
    });

    it('空の配列を保存してもエラーが発生しない', () => {
      expect(() => store.saveMovies([])).not.toThrow();
      expect(store.getMovies()).toHaveLength(0);
    });
  });

  describe('getMovies（フィルター）', () => {
    beforeEach(() => {
      store.saveMovies([
        createTestMovie({ id: 'm1', title: 'アクション映画', status: 'showing', hasSubtitle: false }),
        createTestMovie({ id: 'm2', title: 'ドラマ映画', status: 'upcoming', hasSubtitle: true }),
        createTestMovie({ id: 'm3', title: 'アクションドラマ', status: 'ending_soon', hasSubtitle: false }),
      ]);
    });

    it('status フィルターで絞り込みできる', () => {
      const result = store.getMovies({ status: 'showing' });
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('m1');
    });

    it('search フィルターでタイトル部分一致検索できる', () => {
      const result = store.getMovies({ search: 'アクション' });
      expect(result).toHaveLength(2);
      const ids = result.map(m => m.id);
      expect(ids).toContain('m1');
      expect(ids).toContain('m3');
    });

    it('hasSubtitle フィルターで絞り込みできる', () => {
      const result = store.getMovies({ hasSubtitle: true });
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('m2');
    });

    it('複数フィルターを組み合わせて絞り込みできる', () => {
      const result = store.getMovies({ status: 'upcoming', hasSubtitle: true });
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('m2');
    });

    it('フィルターなしで全件取得できる', () => {
      const result = store.getMovies();
      expect(result).toHaveLength(3);
    });

    it('一致しない search で空配列を返す', () => {
      const result = store.getMovies({ search: '存在しないタイトル' });
      expect(result).toHaveLength(0);
    });
  });

  describe('getMovieById', () => {
    it('存在する映画 ID で映画データを取得できる', () => {
      const movie = createTestMovie({ id: 'movie-001' });
      store.saveMovies([movie]);

      const result = store.getMovieById('movie-001');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('movie-001');
    });

    it('存在しない映画 ID で null を返す', () => {
      const result = store.getMovieById('non-existent');
      expect(result).toBeNull();
    });
  });

  // ============================================================
  // スケジュールデータのテスト
  // ============================================================

  describe('saveSchedules / getSchedulesByDate', () => {
    beforeEach(() => {
      // スケジュールの外部キー制約を満たすために映画データを先に保存する
      store.saveMovies([createTestMovie({ id: 'movie-001' })]);
    });

    it('スケジュールデータを保存して取得できる', () => {
      const schedule = createTestSchedule({ date: '2024-01-15' });
      store.saveSchedules('2024-01-15', [schedule]);

      const result = store.getSchedulesByDate('2024-01-15');
      expect(result).toHaveLength(1);
      expect(result[0]?.movieId).toBe(schedule.movieId);
      expect(result[0]?.movieTitle).toBe(schedule.movieTitle);
      expect(result[0]?.date).toBe(schedule.date);
      expect(result[0]?.theater).toBe(schedule.theater);
      expect(result[0]?.studio).toBe(schedule.studio);
      expect(result[0]?.startTime).toBe(schedule.startTime);
      expect(result[0]?.endTime).toBe(schedule.endTime);
      expect(result[0]?.format).toBe(schedule.format);
    });

    it('スケジュールが開始時刻の昇順で返される', () => {
      const schedules = [
        createTestSchedule({ startTime: '18:00', endTime: '20:00' }),
        createTestSchedule({ startTime: '10:00', endTime: '12:00' }),
        createTestSchedule({ startTime: '14:00', endTime: '16:00' }),
      ];
      store.saveSchedules('2024-01-15', schedules);

      const result = store.getSchedulesByDate('2024-01-15');
      expect(result[0]?.startTime).toBe('10:00');
      expect(result[1]?.startTime).toBe('14:00');
      expect(result[2]?.startTime).toBe('18:00');
    });

    it('同一日付のスケジュールを上書き保存できる（冪等性）', () => {
      const firstSchedules = [
        createTestSchedule({ startTime: '10:00', endTime: '12:00' }),
      ];
      store.saveSchedules('2024-01-15', firstSchedules);

      const secondSchedules = [
        createTestSchedule({ startTime: '14:00', endTime: '16:00' }),
        createTestSchedule({ startTime: '18:00', endTime: '20:00' }),
      ];
      store.saveSchedules('2024-01-15', secondSchedules);

      const result = store.getSchedulesByDate('2024-01-15');
      // 最後に保存したデータのみが残る
      expect(result).toHaveLength(2);
      expect(result[0]?.startTime).toBe('14:00');
      expect(result[1]?.startTime).toBe('18:00');
    });

    it('異なる日付のスケジュールは独立して管理される', () => {
      store.saveSchedules('2024-01-15', [createTestSchedule({ date: '2024-01-15' })]);
      store.saveSchedules('2024-01-16', [
        createTestSchedule({ date: '2024-01-16' }),
        createTestSchedule({ date: '2024-01-16' }),
      ]);

      expect(store.getSchedulesByDate('2024-01-15')).toHaveLength(1);
      expect(store.getSchedulesByDate('2024-01-16')).toHaveLength(2);
    });

    it('存在しない日付で空配列を返す', () => {
      const result = store.getSchedulesByDate('2099-12-31');
      expect(result).toHaveLength(0);
    });

    it('空のスケジュール配列を保存すると既存データが削除される', () => {
      store.saveSchedules('2024-01-15', [createTestSchedule()]);
      store.saveSchedules('2024-01-15', []);

      const result = store.getSchedulesByDate('2024-01-15');
      expect(result).toHaveLength(0);
    });

    it('自動採番された id が付与される', () => {
      store.saveSchedules('2024-01-15', [createTestSchedule()]);

      const result = store.getSchedulesByDate('2024-01-15');
      expect(result[0]?.id).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 映画ID別スケジュール取得のテスト
  // ============================================================

  describe('getSchedulesByMovieId', () => {
    beforeEach(() => {
      store.saveMovies([
        createTestMovie({ id: 'movie-001' }),
        createTestMovie({ id: 'movie-002', title: '別の映画' }),
      ]);
    });

    it('指定映画IDの全日付スケジュールを取得できる', () => {
      store.saveSchedules('2024-01-15', [
        createTestSchedule({ movieId: 'movie-001', date: '2024-01-15', startTime: '10:00', endTime: '12:00' }),
      ]);
      store.saveSchedules('2024-01-16', [
        createTestSchedule({ movieId: 'movie-001', date: '2024-01-16', startTime: '14:00', endTime: '16:00' }),
      ]);

      const result = store.getSchedulesByMovieId('movie-001');
      expect(result).toHaveLength(2);
      expect(result[0]?.date).toBe('2024-01-15');
      expect(result[1]?.date).toBe('2024-01-16');
    });

    it('日付・開始時刻の昇順で返される', () => {
      store.saveSchedules('2024-01-16', [
        createTestSchedule({ movieId: 'movie-001', date: '2024-01-16', startTime: '18:00', endTime: '20:00' }),
        createTestSchedule({ movieId: 'movie-001', date: '2024-01-16', startTime: '10:00', endTime: '12:00' }),
      ]);
      store.saveSchedules('2024-01-15', [
        createTestSchedule({ movieId: 'movie-001', date: '2024-01-15', startTime: '14:00', endTime: '16:00' }),
      ]);

      const result = store.getSchedulesByMovieId('movie-001');
      expect(result).toHaveLength(3);
      expect(result[0]?.date).toBe('2024-01-15');
      expect(result[0]?.startTime).toBe('14:00');
      expect(result[1]?.date).toBe('2024-01-16');
      expect(result[1]?.startTime).toBe('10:00');
      expect(result[2]?.date).toBe('2024-01-16');
      expect(result[2]?.startTime).toBe('18:00');
    });

    it('他の映画IDのスケジュールは含まれない', () => {
      store.saveSchedules('2024-01-15', [
        createTestSchedule({ movieId: 'movie-001', date: '2024-01-15' }),
        createTestSchedule({ movieId: 'movie-002', date: '2024-01-15' }),
      ]);

      const result = store.getSchedulesByMovieId('movie-001');
      expect(result).toHaveLength(1);
      expect(result[0]?.movieId).toBe('movie-001');
    });

    it('存在しない映画IDで空配列を返す', () => {
      const result = store.getSchedulesByMovieId('non-existent');
      expect(result).toHaveLength(0);
    });

    it('スケジュールが存在しない映画IDで空配列を返す', () => {
      // 映画は存在するがスケジュールがない場合
      const result = store.getSchedulesByMovieId('movie-001');
      expect(result).toHaveLength(0);
    });

    it('返されるスケジュールの movieId がすべて指定した映画IDと一致する', () => {
      store.saveSchedules('2024-01-15', [
        createTestSchedule({ movieId: 'movie-001', date: '2024-01-15', startTime: '10:00', endTime: '12:00' }),
        createTestSchedule({ movieId: 'movie-001', date: '2024-01-15', startTime: '14:00', endTime: '16:00' }),
      ]);
      store.saveSchedules('2024-01-16', [
        createTestSchedule({ movieId: 'movie-001', date: '2024-01-16', startTime: '10:00', endTime: '12:00' }),
      ]);

      const result = store.getSchedulesByMovieId('movie-001');
      expect(result.every(s => s.movieId === 'movie-001')).toBe(true);
    });
  });

  // ============================================================
  // メタデータのテスト
  // ============================================================

  describe('getLastScrapedAt / saveLastScrapedAt', () => {
    it('最終スクレイピング日時を保存して取得できる', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      store.saveLastScrapedAt(date);

      const result = store.getLastScrapedAt();
      expect(result).not.toBeNull();
      // ISO 文字列として比較する（ミリ秒精度）
      expect(result?.toISOString()).toBe(date.toISOString());
    });

    it('未保存の場合は null を返す', () => {
      const result = store.getLastScrapedAt();
      expect(result).toBeNull();
    });

    it('最終スクレイピング日時を上書き保存できる', () => {
      const firstDate = new Date('2024-01-15T10:00:00.000Z');
      const secondDate = new Date('2024-01-15T11:00:00.000Z');

      store.saveLastScrapedAt(firstDate);
      store.saveLastScrapedAt(secondDate);

      const result = store.getLastScrapedAt();
      expect(result?.toISOString()).toBe(secondDate.toISOString());
    });
  });

  // ============================================================
  // 古いデータのクリーンアップテスト
  // ============================================================

  describe('deleteOldSchedules', () => {
    it('指定日数より古いスケジュールを削除して削除件数を返す', () => {
      store.saveMovies([createTestMovie({ id: 'movie-001' })]);

      // 40日前のスケジュールを作成する
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      const oldSchedule = createTestSchedule({
        date: '2024-01-01',
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
      });

      // 新しいスケジュールを作成する（現在時刻）
      const newSchedule = createTestSchedule({
        date: '2024-01-02',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      store.saveSchedules('2024-01-01', [oldSchedule]);
      store.saveSchedules('2024-01-02', [newSchedule]);

      // 30日より古いデータを削除する
      const deletedCount = store.deleteOldSchedules(30);
      expect(deletedCount).toBe(1);

      // 古いデータが削除されていることを確認する
      expect(store.getSchedulesByDate('2024-01-01')).toHaveLength(0);
      // 新しいデータは残っていることを確認する
      expect(store.getSchedulesByDate('2024-01-02')).toHaveLength(1);
    });

    it('削除対象がない場合は 0 を返す', () => {
      const deletedCount = store.deleteOldSchedules(30);
      expect(deletedCount).toBe(0);
    });

    it('全データが新しい場合は削除されない', () => {
      store.saveMovies([createTestMovie({ id: 'movie-001' })]);
      store.saveSchedules('2024-01-15', [createTestSchedule()]);

      const deletedCount = store.deleteOldSchedules(30);
      expect(deletedCount).toBe(0);
      expect(store.getSchedulesByDate('2024-01-15')).toHaveLength(1);
    });
  });
});
