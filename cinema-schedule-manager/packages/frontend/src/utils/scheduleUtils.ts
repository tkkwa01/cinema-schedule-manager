/**
 * スケジュールユーティリティ関数
 * スケジュールデータの変換・グループ化・ソートを行う
 */

import type { Schedule, Theater } from '../types/index';

// ============================================================
// ヘルパー
// ============================================================

/** 今日の日付をローカル時刻でYYYY-MM-DD形式で返す */
function getTodayLocalString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================================
// グループ化
// ============================================================

export function groupByTheater(schedules: Schedule[]): Record<Theater, Schedule[]> {
  const result: Record<Theater, Schedule[]> = {
    'cinema-one': [],
    'cinema-two': [],
  };
  for (const schedule of schedules) {
    if (schedule.theater === 'cinema-one' || schedule.theater === 'cinema-two') {
      result[schedule.theater].push(schedule);
    }
  }
  return result;
}

// ============================================================
// ソート
// ============================================================

export function sortByStartTime(schedules: Schedule[]): Schedule[] {
  return [...schedules].sort((a, b) => {
    if (a.startTime < b.startTime) return -1;
    if (a.startTime > b.startTime) return 1;
    return 0;
  });
}

// ============================================================
// 日付ナビゲーション
// ============================================================

/**
 * 基準日を含む前後7日分の合計15日間の日付リストを生成する（要件3.4）
 */
export function generateDateRange(baseDate: string): string[] {
  const [year, month, day] = baseDate.split('-').map(Number);
  if (!year || !month || !day) {
    return generateDateRange(getTodayLocalString());
  }
  const dates: string[] = [];
  for (let i = -7; i <= 7; i++) {
    const d = new Date(year, month - 1, day + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${dd}`);
  }
  return dates;
}

/**
 * 今日から始まる14日間の日付リストを生成する
 */
export function generateDateRangeFromToday(): string[] {
  const today = new Date();
  const dates: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${dd}`);
  }
  return dates;
}

// ============================================================
// 映画単位グループ化
// ============================================================

/** MovieSummaryCard 表示用の映画サマリーデータ */
export interface MovieSummaryData {
  /** 映画ID（存在しない場合は null） */
  movieId: string | null;
  /** 映画タイトル */
  title: string;
  /** 上映フォーマット一覧（重複除去済み） */
  formats: string[];
  /** 上映開始時刻一覧（重複除去・昇順ソート済み） */
  startTimes: string[];
}

/** スケジュール配列を movieId + タイトルでグループ化して MovieSummaryCard 用データに変換する */
export function groupSchedulesByMovieId(schedules: Schedule[]): MovieSummaryData[] {
  const map = new Map<string, MovieSummaryData>();
  for (const s of schedules) {
    // movieId が存在しない場合はタイトルをキーとして使用する
    // 同じ movieId でもタイトルが異なる場合（字幕版・吹替版など）は別エントリとして扱う
    const baseKey = s.movieId ?? `__no_id__`;
    const key = `${baseKey}__${s.movieTitle}`;
    if (!map.has(key)) {
      map.set(key, {
        movieId: s.movieId ?? null,
        title: s.movieTitle,
        formats: [],
        startTimes: [],
      });
    }
    const entry = map.get(key)!;
    // フォーマットの重複除去
    if (!entry.formats.includes(s.format)) entry.formats.push(s.format);
    // 上映時刻の重複除去
    if (!entry.startTimes.includes(s.startTime)) entry.startTimes.push(s.startTime);
  }
  // 開始時刻を昇順ソート
  for (const entry of map.values()) {
    entry.startTimes.sort();
  }
  return Array.from(map.values());
}

// ============================================================
// タイムライン計算
// ============================================================

export function calculateBlockWidth(
  startTime: string,
  endTime: string,
  totalMinutes: number
): number {
  if (totalMinutes <= 0) return 0;
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) return 0;
  const durationMinutes = endMinutes - startMinutes;
  if (durationMinutes <= 0) return 0;
  return (durationMinutes / totalMinutes) * 100;
}

export function calculateBlockLeft(
  startTime: string,
  timelineStartTime: string,
  totalMinutes: number
): number {
  if (totalMinutes <= 0) return 0;
  const startMinutes = timeToMinutes(startTime);
  const timelineStartMinutes = timeToMinutes(timelineStartTime);
  if (startMinutes === null || timelineStartMinutes === null) return 0;
  const offsetMinutes = startMinutes - timelineStartMinutes;
  if (offsetMinutes < 0) return 0;
  return (offsetMinutes / totalMinutes) * 100;
}

export function timeToMinutes(time: string): number | null {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1] as string, 10);
  const minutes = parseInt(match[2] as string, 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}
