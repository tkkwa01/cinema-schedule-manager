/**
 * 保全テスト3: WatchlistPage — スケジュールが存在する映画のタイトル表示不変
 *
 * **Validates: Requirements 3.4, 3.5**
 *
 * このテストは修正前のコードで PASS することが期待される。
 * バグ条件が成立しない入力（スケジュールが存在する映画）に対して、
 * 既存の動作が正しいことを確認する。
 *
 * 保全対象:
 *   - スケジュールが存在する映画のタイトル表示は変更されない
 *   - movieSchedules[0]?.movieTitle が正しく表示される
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WatchlistPage } from '../src/pages/WatchlistPage';
import { AppProvider } from '../src/store/AppContext';
import * as client from '../src/api/client';
import type { Schedule, Movie, ApiResponse } from '../src/types/index';

// ============================================================
// モックの作成
// ============================================================

/** テスト用スケジュールを生成する */
function createTestSchedule(movieId: string, movieTitle: string, date: string): Schedule {
  return {
    id: Math.floor(Math.random() * 10000),
    movieId,
    movieTitle,
    date,
    theater: 'cinema-one',
    studio: 'a studio',
    startTime: '10:00',
    endTime: '12:00',
    format: '通常',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  };
}

/** テスト用映画を生成する */
function createTestMovie(id: string, title: string): Movie {
  return {
    id,
    title,
    status: 'showing',
    hasSubtitle: false,
    formats: ['通常'],
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  };
}

// ============================================================
// 保全テスト3: WatchlistPage — スケジュールが存在する映画のタイトル表示不変
// ============================================================

describe('保全テスト3: WatchlistPage — スケジュールが存在する映画のタイトル表示不変', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // fetchAvailableDates のモック
    vi.spyOn(client, 'fetchAvailableDates').mockResolvedValue(['2025-07-05']);
    
    // triggerRefresh のモック
    vi.spyOn(client, 'triggerRefresh').mockResolvedValue({
      data: {
        data: { message: 'OK', updatedAt: '2025-07-05T10:00:00Z', actualDate: '2025-07-05' },
        lastUpdatedAt: '2025-07-05T10:00:00Z',
        cached: false,
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  /**
   * 保全テスト3（ユニットテスト）:
   * ウォッチリストに movieId = '3742' が登録されており、
   * movieTitle: '正しいタイトル' を持つスケジュールが存在する場合、
   * '正しいタイトル' が表示される（バグ条件が成立しない）
   *
   * 修正前コード: const movieTitle = movieSchedules[0]?.movieTitle ?? movieId;
   * → スケジュールが存在する場合、movieSchedules[0]?.movieTitle が使われる
   *
   * 期待される動作: '正しいタイトル' が表示される（修正前後で同じ）
   */
  it('スケジュールが存在する映画のタイトルが正しく表示される（保全確認）', async () => {
    // 準備: ウォッチリストに '3742' を登録する
    localStorage.setItem('cinema-schedule-watchlist', JSON.stringify(['3742']));

    // スケジュールが存在する状態をモックする
    const schedule = createTestSchedule('3742', '正しいタイトル', '2025-07-05');
    vi.spyOn(client, 'fetchSchedules').mockResolvedValue({
      data: {
        data: [schedule],
        lastUpdatedAt: '2025-07-05T10:00:00Z',
        cached: false,
      } as ApiResponse<Schedule[]>,
      error: null,
    });

    // レンダリング
    render(
      <AppProvider>
        <WatchlistPage />
      </AppProvider>
    );

    // 検証: '正しいタイトル' が h2 見出しとして表示される（修正前後で同じ）
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '正しいタイトル', level: 2 })).toBeInTheDocument();
    });

    // 映画IDが見出しとして表示されないことを確認する
    expect(screen.queryByRole('heading', { name: '3742', level: 2 })).not.toBeInTheDocument();
  });

  /**
   * 保全テスト3（ユニットテスト）:
   * 複数の映画がウォッチリストに登録されており、すべてスケジュールが存在する場合、
   * すべての映画タイトルが正しく表示される
   */
  it('複数の映画がウォッチリストに登録されており、すべてスケジュールが存在する場合、すべてのタイトルが正しく表示される（保全確認）', async () => {
    // 準備: ウォッチリストに複数の映画を登録する
    localStorage.setItem('cinema-schedule-watchlist', JSON.stringify(['movie-1', 'movie-2', 'movie-3']));

    // すべての映画にスケジュールが存在する状態をモックする
    const schedules = [
      createTestSchedule('movie-1', '映画タイトル1', '2025-07-05'),
      createTestSchedule('movie-2', '映画タイトル2', '2025-07-05'),
      createTestSchedule('movie-3', '映画タイトル3', '2025-07-05'),
    ];
    vi.spyOn(client, 'fetchSchedules').mockResolvedValue({
      data: {
        data: schedules,
        lastUpdatedAt: '2025-07-05T10:00:00Z',
        cached: false,
      } as ApiResponse<Schedule[]>,
      error: null,
    });

    // レンダリング
    render(
      <AppProvider>
        <WatchlistPage />
      </AppProvider>
    );

    // 検証: すべての映画タイトルが h2 見出しとして表示される
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '映画タイトル1', level: 2 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '映画タイトル2', level: 2 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '映画タイトル3', level: 2 })).toBeInTheDocument();
    });

    // 映画IDが見出しとして表示されないことを確認する
    expect(screen.queryByRole('heading', { name: 'movie-1', level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'movie-2', level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'movie-3', level: 2 })).not.toBeInTheDocument();
  });

  /**
   * 保全テスト3（ユニットテスト）:
   * スケジュールが存在する映画のタイトルは、
   * movieSchedules[0]?.movieTitle から取得される（修正前後で同じ）
   */
  it('スケジュールが存在する映画のタイトルは movieSchedules[0]?.movieTitle から取得される（保全確認）', async () => {
    // 準備: ウォッチリストに '5678' を登録する
    localStorage.setItem('cinema-schedule-watchlist', JSON.stringify(['5678']));

    // スケジュールが存在する状態をモックする
    const schedule = createTestSchedule('5678', 'スケジュールから取得したタイトル', '2025-07-05');
    vi.spyOn(client, 'fetchSchedules').mockResolvedValue({
      data: {
        data: [schedule],
        lastUpdatedAt: '2025-07-05T10:00:00Z',
        cached: false,
      } as ApiResponse<Schedule[]>,
      error: null,
    });

    // レンダリング
    render(
      <AppProvider>
        <WatchlistPage />
      </AppProvider>
    );

    // 検証: スケジュールから取得したタイトルが h2 見出しとして表示される
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'スケジュールから取得したタイトル', level: 2 })).toBeInTheDocument();
    });
  });

  /**
   * 保全テスト3（ユニットテスト）:
   * 同じ映画の複数のスケジュールが存在する場合、
   * 最初のスケジュールのタイトルが使用される（修正前後で同じ）
   */
  it('同じ映画の複数のスケジュールが存在する場合、最初のスケジュールのタイトルが使用される（保全確認）', async () => {
    // 準備: ウォッチリストに '9999' を登録する
    localStorage.setItem('cinema-schedule-watchlist', JSON.stringify(['9999']));

    // 同じ映画の複数のスケジュールをモックする
    const schedules = [
      createTestSchedule('9999', '最初のスケジュールタイトル', '2025-07-05'),
      createTestSchedule('9999', '2番目のスケジュールタイトル', '2025-07-05'),
      createTestSchedule('9999', '3番目のスケジュールタイトル', '2025-07-05'),
    ];
    vi.spyOn(client, 'fetchSchedules').mockResolvedValue({
      data: {
        data: schedules,
        lastUpdatedAt: '2025-07-05T10:00:00Z',
        cached: false,
      } as ApiResponse<Schedule[]>,
      error: null,
    });

    // レンダリング
    render(
      <AppProvider>
        <WatchlistPage />
      </AppProvider>
    );

    // 検証: 最初のスケジュールのタイトルが h2 見出しとして表示される
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '最初のスケジュールタイトル', level: 2 })).toBeInTheDocument();
    });

    // 他のスケジュールのタイトルは h2 見出しとして表示されない（h3 の ScheduleCard には表示される）
    expect(screen.queryByRole('heading', { name: '2番目のスケジュールタイトル', level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '3番目のスケジュールタイトル', level: 2 })).not.toBeInTheDocument();
  });

  /**
   * 保全テスト3（ユニットテスト）:
   * ウォッチリストが空の場合、タイトル表示のロジックは実行されない（保全確認）
   */
  it('ウォッチリストが空の場合、タイトル表示のロジックは実行されない（保全確認）', async () => {
    // 準備: ウォッチリストを空にする
    localStorage.setItem('cinema-schedule-watchlist', JSON.stringify([]));

    // fetchSchedules は呼ばれないはず
    const fetchSchedulesSpy = vi.spyOn(client, 'fetchSchedules');

    // レンダリング
    render(
      <AppProvider>
        <WatchlistPage />
      </AppProvider>
    );

    // 検証: 「ウォッチリストに映画が登録されていません」が表示される
    await waitFor(() => {
      expect(screen.getByText('ウォッチリストに映画が登録されていません')).toBeInTheDocument();
    });

    // fetchSchedules が呼ばれないことを確認する
    expect(fetchSchedulesSpy).not.toHaveBeenCalled();
  });
});
