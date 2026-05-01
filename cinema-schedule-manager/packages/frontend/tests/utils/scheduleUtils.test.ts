/**
 * スケジュールユーティリティ関数のテスト
 * プロパティベーステストとユニットテストを含む
 */

import { describe, it, expect } from 'vitest';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import {
  groupByTheater,
  sortByStartTime,
  generateDateRange,
  calculateBlockWidth,
  timeToMinutes,
} from '../../src/utils/scheduleUtils';
import type { Schedule } from '../../src/types/index';

// ============================================================
// テスト用ヘルパー
// ============================================================

function createSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 1,
    movieId: 'movie-001',
    movieTitle: 'テスト映画',
    date: '2024-01-15',
    theater: 'cinema-one',
    studio: 'a studio',
    startTime: '10:00',
    endTime: '12:00',
    format: '通常',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    ...overrides,
  };
}

/** HH:MM 形式の時刻文字列ジェネレーター */
const timeStringArb = fc.tuple(
  fc.integer({ min: 0, max: 23 }).map(h => h.toString().padStart(2, '0')),
  fc.integer({ min: 0, max: 59 }).map(m => m.toString().padStart(2, '0'))
).map(([h, m]) => `${h}:${m}`);

/** Schedule 型のジェネレーター */
const scheduleArb = fc.record({
  id: fc.integer({ min: 1 }),
  movieId: fc.string({ minLength: 1, maxLength: 20 }),
  movieTitle: fc.string({ minLength: 1, maxLength: 50 }),
  date: fc.constant('2024-01-15'),
  theater: fc.constantFrom('cinema-one' as const, 'cinema-two' as const),
  studio: fc.string({ minLength: 1, maxLength: 20 }),
  startTime: timeStringArb,
  endTime: timeStringArb,
  format: fc.constantFrom('通常', '極音', '極爆'),
  createdAt: fc.constant('2024-01-15T00:00:00Z'),
  updatedAt: fc.constant('2024-01-15T00:00:00Z'),
});

// ============================================================
// groupByTheater のテスト
// ============================================================

describe('groupByTheater', () => {
  describe('ユニットテスト', () => {
    it('cinema-one と cinema-two に正しく分類される', () => {
      const schedules = [
        createSchedule({ theater: 'cinema-one' }),
        createSchedule({ theater: 'cinema-two' }),
        createSchedule({ theater: 'cinema-one' }),
      ];

      const result = groupByTheater(schedules);

      expect(result['cinema-one']).toHaveLength(2);
      expect(result['cinema-two']).toHaveLength(1);
    });

    it('空配列を渡すと両劇場とも空配列になる', () => {
      const result = groupByTheater([]);
      expect(result['cinema-one']).toHaveLength(0);
      expect(result['cinema-two']).toHaveLength(0);
    });

    it('全スケジュールが cinema-one の場合', () => {
      const schedules = [
        createSchedule({ theater: 'cinema-one' }),
        createSchedule({ theater: 'cinema-one' }),
      ];
      const result = groupByTheater(schedules);
      expect(result['cinema-one']).toHaveLength(2);
      expect(result['cinema-two']).toHaveLength(0);
    });
  });

  /**
   * プロパティ6: スケジュールの劇場別グループ化（要件3.2）
   * グループ内の全スケジュールの theater フィールドはグループキーと一致する
   */
  test.prop([fc.array(scheduleArb)], { numRuns: 100 })(
    // Feature: cinema-schedule-manager, Property 6: スケジュールの劇場別グループ化
    'groupByTheater の各グループ内スケジュールの theater はグループキーと一致する',
    (schedules) => {
      const result = groupByTheater(schedules);
      for (const [theater, group] of Object.entries(result)) {
        for (const schedule of group) {
          expect(schedule.theater).toBe(theater);
        }
      }
    }
  );
});

// ============================================================
// sortByStartTime のテスト
// ============================================================

describe('sortByStartTime', () => {
  describe('ユニットテスト', () => {
    it('開始時刻の昇順にソートされる', () => {
      const schedules = [
        createSchedule({ startTime: '18:00' }),
        createSchedule({ startTime: '10:00' }),
        createSchedule({ startTime: '14:00' }),
      ];

      const result = sortByStartTime(schedules);

      expect(result[0]?.startTime).toBe('10:00');
      expect(result[1]?.startTime).toBe('14:00');
      expect(result[2]?.startTime).toBe('18:00');
    });

    it('元の配列を変更しない（イミュータブル）', () => {
      const schedules = [
        createSchedule({ startTime: '18:00' }),
        createSchedule({ startTime: '10:00' }),
      ];
      const original = [...schedules];

      sortByStartTime(schedules);

      expect(schedules[0]?.startTime).toBe(original[0]?.startTime);
    });

    it('空配列を渡すと空配列を返す', () => {
      expect(sortByStartTime([])).toEqual([]);
    });
  });

  /**
   * プロパティ7: スケジュールの開始時刻昇順ソート（要件3.6）
   * 隣接する任意の2要素について前の要素の開始時刻は後の要素以下
   */
  test.prop([fc.array(scheduleArb)], { numRuns: 100 })(
    // Feature: cinema-schedule-manager, Property 7: スケジュールの開始時刻昇順ソート
    'sortByStartTime の結果は開始時刻の昇順になっている',
    (schedules) => {
      const result = sortByStartTime(schedules);
      for (let i = 0; i < result.length - 1; i++) {
        expect((result[i] as Schedule).startTime <= (result[i + 1] as Schedule).startTime).toBe(true);
      }
    }
  );
});

// ============================================================
// generateDateRange のテスト
// ============================================================

describe('generateDateRange', () => {
  describe('ユニットテスト', () => {
    it('基準日を含む15日分の日付リストを返す', () => {
      const result = generateDateRange('2024-01-15');
      expect(result).toHaveLength(15);
    });

    it('基準日が中央（8番目）に位置する', () => {
      const result = generateDateRange('2024-01-15');
      expect(result[7]).toBe('2024-01-15');
    });

    it('最初の日付は基準日の7日前', () => {
      const result = generateDateRange('2024-01-15');
      expect(result[0]).toBe('2024-01-08');
    });

    it('最後の日付は基準日の7日後', () => {
      const result = generateDateRange('2024-01-15');
      expect(result[14]).toBe('2024-01-22');
    });

    it('月をまたぐ場合も正しく計算される', () => {
      const result = generateDateRange('2024-01-01');
      expect(result[0]).toBe('2023-12-25');
    });
  });

  /**
   * プロパティ8: 日付ナビゲーションの範囲（要件3.4）
   * 任意の基準日に対して15日分の日付リストを返す
   */
  test.prop(
    [fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map(d => d.toISOString().split('T')[0] as string)],
    { numRuns: 100 }
  )(
    // Feature: cinema-schedule-manager, Property 8: 日付ナビゲーションの範囲
    'generateDateRange は基準日を含む15日分の日付リストを返す',
    (baseDate) => {
      const result = generateDateRange(baseDate);
      expect(result).toHaveLength(15);
      expect(result[7]).toBe(baseDate);
    }
  );
});

// ============================================================
// calculateBlockWidth のテスト
// ============================================================

describe('calculateBlockWidth', () => {
  describe('ユニットテスト', () => {
    it('2時間の上映が全体の1/6になる（12時間タイムライン）', () => {
      const width = calculateBlockWidth('10:00', '12:00', 720);
      expect(width).toBeCloseTo(16.67, 1);
    });

    it('上映時間が2倍になるとブロック幅も2倍になる（比例性）', () => {
      const width1 = calculateBlockWidth('10:00', '11:00', 600);
      const width2 = calculateBlockWidth('10:00', '12:00', 600);
      expect(width2).toBeCloseTo(width1 * 2, 5);
    });

    it('totalMinutes が0の場合は0を返す', () => {
      expect(calculateBlockWidth('10:00', '12:00', 0)).toBe(0);
    });

    it('不正な時刻形式の場合は0を返す', () => {
      expect(calculateBlockWidth('invalid', '12:00', 600)).toBe(0);
    });

    it('終了時刻が開始時刻より前の場合は0を返す', () => {
      expect(calculateBlockWidth('12:00', '10:00', 600)).toBe(0);
    });
  });

  /**
   * プロパティ12: タイムラインブロック幅の比例性（要件5.2）
   * 上映時間が2倍になればブロック幅も2倍になる
   */
  test.prop(
    [
      fc.integer({ min: 0, max: 22 }).map(h => h.toString().padStart(2, '0')),
      fc.integer({ min: 1, max: 120 }),
      fc.integer({ min: 1, max: 720 }),
    ],
    { numRuns: 100 }
  )(
    // Feature: cinema-schedule-manager, Property 12: タイムラインブロック幅の比例性
    'calculateBlockWidth は上映時間に比例した幅を返す',
    (startHour, durationMinutes, totalMinutes) => {
      const startMinutes = parseInt(startHour, 10) * 60;
      const endMinutes = startMinutes + durationMinutes;
      if (endMinutes > 23 * 60 + 59) return; // 範囲外はスキップ

      const startTime = `${startHour}:00`;
      const endHour = Math.floor(endMinutes / 60).toString().padStart(2, '0');
      const endMin = (endMinutes % 60).toString().padStart(2, '0');
      const endTime = `${endHour}:${endMin}`;

      const width = calculateBlockWidth(startTime, endTime, totalMinutes);
      const expected = (durationMinutes / totalMinutes) * 100;

      expect(width).toBeCloseTo(expected, 5);
    }
  );
});

// ============================================================
// timeToMinutes のテスト
// ============================================================

describe('timeToMinutes', () => {
  it('"00:00" は 0 分', () => expect(timeToMinutes('00:00')).toBe(0));
  it('"01:00" は 60 分', () => expect(timeToMinutes('01:00')).toBe(60));
  it('"23:59" は 1439 分', () => expect(timeToMinutes('23:59')).toBe(1439));
  it('不正な形式は null を返す', () => expect(timeToMinutes('invalid')).toBeNull());
});
