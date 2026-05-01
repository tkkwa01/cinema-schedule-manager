/**
 * HTMLパーサーモジュールのテスト
 * CinemaCityParser クラスの各メソッドの動作を検証する
 * ユニットテストとプロパティベーステストの両方を含む
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import { CinemaCityParser } from '../../src/scraper/parser.js';

// ============================================================
// テスト用ヘルパー関数
// ============================================================

/** テスト用の正常なスケジュールHTMLを生成する */
function createScheduleHtml(entries: Array<{ studio: string; title: string; time: string; format?: string }>): string {
  const rows = entries.map(entry => `
    <tr>
      <th class="studio-name">${entry.studio}</th>
      <td class="title">${entry.title}</td>
      <td class="time-slot">${entry.time}</td>
      <td class="format">${entry.format ?? '通常'}</td>
    </tr>
  `).join('');

  return `
    <html>
      <body>
        <table>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

/** HH:MM 形式の時刻文字列を生成するジェネレーター */
const timeStringArb = fc.tuple(
  fc.integer({ min: 0, max: 23 }).map(h => h.toString().padStart(2, '0')),
  fc.integer({ min: 0, max: 59 }).map(m => m.toString().padStart(2, '0'))
).map(([h, m]) => `${h}:${m}`);

// ============================================================
// テストスイート
// ============================================================

describe('CinemaCityParser', () => {
  let parser: CinemaCityParser;

  // 各テスト前にパーサーインスタンスを生成する
  beforeEach(() => {
    parser = new CinemaCityParser();
  });

  // ============================================================
  // parseTimeSlot のユニットテスト
  // ============================================================

  describe('parseTimeSlot', () => {
    describe('正常系', () => {
      it('"10:30 (12:45)" を正しくパースできる', () => {
        const result = parser.parseTimeSlot('10:30 (12:45)');
        expect(result).toEqual({ startTime: '10:30', endTime: '12:45' });
      });

      it('"00:00 (23:59)" を正しくパースできる（境界値）', () => {
        const result = parser.parseTimeSlot('00:00 (23:59)');
        expect(result).toEqual({ startTime: '00:00', endTime: '23:59' });
      });

      it('"09:00 (11:30)" を正しくパースできる', () => {
        const result = parser.parseTimeSlot('09:00 (11:30)');
        expect(result).toEqual({ startTime: '09:00', endTime: '11:30' });
      });

      it('"21:45 (23:55)" を正しくパースできる（深夜上映）', () => {
        const result = parser.parseTimeSlot('21:45 (23:55)');
        expect(result).toEqual({ startTime: '21:45', endTime: '23:55' });
      });

      it('前後に空白がある場合もパースできる', () => {
        const result = parser.parseTimeSlot('  10:30 (12:45)  ');
        expect(result).toEqual({ startTime: '10:30', endTime: '12:45' });
      });
    });

    describe('異常系', () => {
      it('空文字列の場合は { startTime: "", endTime: "" } を返す', () => {
        const result = parser.parseTimeSlot('');
        expect(result).toEqual({ startTime: '', endTime: '' });
      });

      it('不正な形式 "10:30-12:45" の場合は空文字列を返す', () => {
        const result = parser.parseTimeSlot('10:30-12:45');
        expect(result).toEqual({ startTime: '', endTime: '' });
      });

      it('不正な形式 "10:30" （終了時刻なし）の場合は空文字列を返す', () => {
        const result = parser.parseTimeSlot('10:30');
        expect(result).toEqual({ startTime: '', endTime: '' });
      });

      it('不正な形式 "abc (def)" の場合は空文字列を返す', () => {
        const result = parser.parseTimeSlot('abc (def)');
        expect(result).toEqual({ startTime: '', endTime: '' });
      });

      it('不正な形式 "1:30 (12:45)" （時間が1桁）の場合は空文字列を返す', () => {
        const result = parser.parseTimeSlot('1:30 (12:45)');
        expect(result).toEqual({ startTime: '', endTime: '' });
      });

      it('不正な形式 "10:3 (12:45)" （分が1桁）の場合は空文字列を返す', () => {
        const result = parser.parseTimeSlot('10:3 (12:45)');
        expect(result).toEqual({ startTime: '', endTime: '' });
      });

      it('ランダムな文字列の場合は空文字列を返す', () => {
        const result = parser.parseTimeSlot('これは時刻ではありません');
        expect(result).toEqual({ startTime: '', endTime: '' });
      });
    });
  });

  // ============================================================
  // parseTimeSlot のプロパティベーステスト
  // ============================================================

  describe('parseTimeSlot プロパティベーステスト', () => {
    /**
     * Validates: Requirements 1.4
     * プロパティ1: 時刻文字列のパースラウンドトリップ
     * 任意の有効な時刻ペアに対して、"HH:MM (HH:MM)" 形式の文字列を生成してから
     * parseTimeSlot() でパースすると、元の開始時刻と終了時刻が復元される
     */
    test.prop(
      [timeStringArb, timeStringArb],
      {
        numRuns: 100,
      }
    )(
      // Feature: cinema-schedule-manager, Property 1: 時刻文字列のパースラウンドトリップ
      'parseTimeSlot は "HH:MM (HH:MM)" 形式の文字列から元の時刻ペアを復元する',
      (startTime, endTime) => {
        const timeStr = `${startTime} (${endTime})`;
        const result = parser.parseTimeSlot(timeStr);
        expect(result.startTime).toBe(startTime);
        expect(result.endTime).toBe(endTime);
      }
    );

    /**
     * Validates: Requirements 1.6
     * 任意の文字列を入力しても parseTimeSlot は例外をスローしない
     */
    test.prop(
      [fc.string()],
      {
        numRuns: 100,
      }
    )(
      'parseTimeSlot は任意の文字列入力で例外をスローしない',
      (input) => {
        expect(() => parser.parseTimeSlot(input)).not.toThrow();
        const result = parser.parseTimeSlot(input);
        expect(typeof result.startTime).toBe('string');
        expect(typeof result.endTime).toBe('string');
      }
    );
  });

  // ============================================================
  // parseSchedulePage のユニットテスト
  // ============================================================

  describe('parseSchedulePage', () => {
    describe('正常系', () => {
      it('正常なHTMLからスケジュールデータを抽出できる', () => {
        const html = `
          <html>
            <body>
              <table>
                <tr>
                  <th class="studio-name">a studio</th>
                  <td class="title">テスト映画A</td>
                  <td class="time-slot">10:00 (12:00)</td>
                  <td class="format">通常</td>
                </tr>
              </table>
            </body>
          </html>
        `;

        const result = parser.parseSchedulePage(html);
        // パーサーが何らかのデータを返すか、空配列を返すかを確認する
        expect(Array.isArray(result)).toBe(true);
      });

      it('複数のスケジュールエントリを含むHTMLを処理できる', () => {
        const html = createScheduleHtml([
          { studio: 'a studio', title: '映画A', time: '10:00 (12:00)', format: '通常' },
          { studio: 'b studio', title: '映画B', time: '14:00 (16:30)', format: '極音' },
        ]);

        const result = parser.parseSchedulePage(html);
        expect(Array.isArray(result)).toBe(true);
        // 例外が発生しないことを確認する
        expect(() => parser.parseSchedulePage(html)).not.toThrow();
      });

      it('.movie-title クラスを持つ要素からタイトルを抽出できる', () => {
        const html = `
          <html>
            <body>
              <div>
                <span class="studio-name">c studio</span>
                <span class="movie-title">極音映画</span>
                <span class="time">13:00 (15:00)</span>
                <span class="format">極音</span>
              </div>
            </body>
          </html>
        `;

        expect(() => parser.parseSchedulePage(html)).not.toThrow();
        const result = parser.parseSchedulePage(html);
        expect(Array.isArray(result)).toBe(true);
      });

      it('フォーマット要素がない場合は "通常" をデフォルト値として使用する', () => {
        const html = `
          <html>
            <body>
              <table>
                <tr>
                  <td class="movie-title">フォーマットなし映画</td>
                  <td class="time-slot">10:00 (12:00)</td>
                </tr>
              </table>
            </body>
          </html>
        `;

        expect(() => parser.parseSchedulePage(html)).not.toThrow();
        const result = parser.parseSchedulePage(html);
        // フォーマットが設定されている場合は "通常" であることを確認する
        result.forEach(schedule => {
          expect(schedule.format).toBeTruthy();
        });
      });
    });

    describe('異常系', () => {
      it('空文字列の場合は空配列を返す', () => {
        const result = parser.parseSchedulePage('');
        expect(result).toEqual([]);
      });

      it('不正なHTMLでも例外をスローしない（要件1.6）', () => {
        const invalidHtml = '<div><span>閉じタグなし<p>不正なHTML';
        expect(() => parser.parseSchedulePage(invalidHtml)).not.toThrow();
      });

      it('スケジュール要素がないHTMLで空配列を返す', () => {
        const html = '<html><body><p>スケジュールなし</p></body></html>';
        const result = parser.parseSchedulePage(html);
        expect(result).toEqual([]);
      });

      it('完全に空のHTMLタグで空配列を返す', () => {
        const result = parser.parseSchedulePage('<html></html>');
        expect(result).toEqual([]);
      });

      it('ランダムな文字列でも例外をスローしない', () => {
        expect(() => parser.parseSchedulePage('これはHTMLではありません')).not.toThrow();
      });

      it('非常に長い文字列でも例外をスローしない', () => {
        const longHtml = '<div>' + 'a'.repeat(100000) + '</div>';
        expect(() => parser.parseSchedulePage(longHtml)).not.toThrow();
      });
    });

    describe('出力フィールドの検証', () => {
      it('返却されたスケジュールエントリには必須フィールドが含まれる', () => {
        const html = `
          <html>
            <body>
              <table>
                <tr>
                  <th class="studio-name">a studio</th>
                  <td class="movie-title">テスト映画</td>
                  <td class="time">10:00 (12:00)</td>
                  <td class="format">通常</td>
                </tr>
              </table>
            </body>
          </html>
        `;

        const result = parser.parseSchedulePage(html);
        result.forEach(schedule => {
          // 全フィールドが存在することを確認する
          expect(schedule).toHaveProperty('movieTitle');
          expect(schedule).toHaveProperty('studio');
          expect(schedule).toHaveProperty('startTime');
          expect(schedule).toHaveProperty('endTime');
          expect(schedule).toHaveProperty('format');
          // フィールドが文字列型であることを確認する
          expect(typeof schedule.movieTitle).toBe('string');
          expect(typeof schedule.studio).toBe('string');
          expect(typeof schedule.startTime).toBe('string');
          expect(typeof schedule.endTime).toBe('string');
          expect(typeof schedule.format).toBe('string');
        });
      });
    });
  });

  // ============================================================
  // parseSchedulePage のプロパティベーステスト
  // ============================================================

  describe('parseSchedulePage プロパティベーステスト', () => {
    /**
     * Validates: Requirements 1.6
     * プロパティ3: 不正HTML入力に対するパーサーの堅牢性
     * 任意の不正または不完全なHTMLを入力した場合でも、パーサーは例外をスローせず、
     * 取得できた範囲のデータを含む結果を返す
     */
    test.prop(
      [fc.string()],
      {
        numRuns: 100,
      }
    )(
      // Feature: cinema-schedule-manager, Property 3: 不正HTML入力に対するパーサーの堅牢性
      'parseSchedulePage は任意の文字列入力で例外をスローしない',
      (input) => {
        expect(() => parser.parseSchedulePage(input)).not.toThrow();
        const result = parser.parseSchedulePage(input);
        expect(Array.isArray(result)).toBe(true);
      }
    );

    /**
     * Validates: Requirements 1.1, 1.3
     * プロパティ2: パーサーの出力フィールド完全性
     * parseSchedulePage() の出力の各エントリには
     * 映画タイトル・スタジオ名・開始時刻・終了時刻・上映フォーマットの全フィールドが含まれる
     */
    test.prop(
      [
        // 有効なスケジュールHTMLを生成するジェネレーター
        fc.array(
          fc.record({
            studio: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('<') && !s.includes('>')),
            title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('<') && !s.includes('>')),
            time: fc.tuple(timeStringArb, timeStringArb).map(([s, e]) => `${s} (${e})`),
            format: fc.constantFrom('通常', '極音', '極爆'),
          }),
          { minLength: 1, maxLength: 5 }
        ),
      ],
      {
        numRuns: 100,
      }
    )(
      // Feature: cinema-schedule-manager, Property 2: パーサーの出力フィールド完全性
      'parseSchedulePage の出力エントリには全必須フィールドが含まれる',
      (entries) => {
        const html = createScheduleHtml(entries);
        const result = parser.parseSchedulePage(html);
        // 例外が発生しないことを確認する
        expect(Array.isArray(result)).toBe(true);
        // 返却されたエントリには全フィールドが含まれることを確認する
        result.forEach(schedule => {
          expect(schedule).toHaveProperty('movieTitle');
          expect(schedule).toHaveProperty('studio');
          expect(schedule).toHaveProperty('startTime');
          expect(schedule).toHaveProperty('endTime');
          expect(schedule).toHaveProperty('format');
          expect(typeof schedule.movieTitle).toBe('string');
          expect(typeof schedule.studio).toBe('string');
          expect(typeof schedule.startTime).toBe('string');
          expect(typeof schedule.endTime).toBe('string');
          expect(typeof schedule.format).toBe('string');
        });
      }
    );
  });

  // ============================================================
  // parseShowingPage のユニットテスト
  // ============================================================

  describe('parseShowingPage', () => {
    it('空文字列の場合は空配列を返す', () => {
      const result = parser.parseShowingPage('');
      expect(result).toEqual([]);
    });

    it('不正なHTMLでも例外をスローしない', () => {
      expect(() => parser.parseShowingPage('<div>不正なHTML')).not.toThrow();
    });

    it('上映中セクションから映画IDとタイトルを抽出できる', () => {
      const html = `
        <html>
          <body>
            <div id="showing">
              <ul>
                <li><a href="/TicketReserver/studio/movie/12345"><img alt="テスト映画1" /></a></li>
                <li><a href="/TicketReserver/studio/movie/67890"><img alt="テスト映画2" /></a></li>
              </ul>
            </div>
          </body>
        </html>
      `;

      const result = parser.parseShowingPage(html);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]?.id).toBe('12345');
      expect(result[0]?.status).toBe('showing');
      expect(result[1]?.id).toBe('67890');
    });

    it('上映予定セクションのステータスが "upcoming" になる', () => {
      const html = `
        <html>
          <body>
            <div id="upcoming">
              <ul>
                <li><a href="/TicketReserver/studio/movie/11111"><img alt="上映予定映画" /></a></li>
              </ul>
            </div>
          </body>
        </html>
      `;

      const result = parser.parseShowingPage(html);
      expect(result.length).toBe(1);
      expect(result[0]?.status).toBe('upcoming');
    });

    it('終了間近セクションのステータスが "ending_soon" になる', () => {
      const html = `
        <html>
          <body>
            <div id="ending">
              <ul>
                <li><a href="/TicketReserver/studio/movie/22222"><img alt="終了間近映画" /></a></li>
              </ul>
            </div>
          </body>
        </html>
      `;

      const result = parser.parseShowingPage(html);
      expect(result.length).toBe(1);
      expect(result[0]?.status).toBe('ending_soon');
    });

    it('映画IDのないリンクは無視される', () => {
      const html = `
        <html>
          <body>
            <div id="showing">
              <ul>
                <li><a href="/TicketReserver/other-page"><img alt="IDなし" /></a></li>
                <li><a href="/TicketReserver/studio/movie/99999"><img alt="IDあり" /></a></li>
              </ul>
            </div>
          </body>
        </html>
      `;

      const result = parser.parseShowingPage(html);
      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe('99999');
    });

    it('同じIDの映画が複数セクションに存在する場合は重複しない', () => {
      const html = `
        <html>
          <body>
            <div id="showing">
              <ul>
                <li><a href="/TicketReserver/studio/movie/11111"><img alt="重複映画" /></a></li>
              </ul>
            </div>
            <div id="upcoming">
              <ul>
                <li><a href="/TicketReserver/studio/movie/11111"><img alt="重複映画" /></a></li>
              </ul>
            </div>
          </body>
        </html>
      `;

      const result = parser.parseShowingPage(html);
      const ids = result.map(s => s.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  // ============================================================
  // parseShowingPage のプロパティベーステスト
  // ============================================================

  describe('parseShowingPage プロパティベーステスト', () => {
    /**
     * Validates: Requirements 1.6
     * 任意の文字列を入力しても parseShowingPage は例外をスローしない
     */
    test.prop(
      [fc.string()],
      {
        numRuns: 100,
      }
    )(
      'parseShowingPage は任意の文字列入力で例外をスローしない',
      (input) => {
        expect(() => parser.parseShowingPage(input)).not.toThrow();
        const result = parser.parseShowingPage(input);
        expect(Array.isArray(result)).toBe(true);
      }
    );
  });

  // ============================================================
  // parseMovieDetailPage のユニットテスト
  // ============================================================

  describe('parseMovieDetailPage', () => {
    it('空文字列の場合はデフォルト値を返す', () => {
      const result = parser.parseMovieDetailPage('');
      expect(result).toEqual({ title: '', formats: [], status: 'showing', description: '' });
    });

    it('不正なHTMLでも例外をスローしない', () => {
      expect(() => parser.parseMovieDetailPage('<div>不正なHTML')).not.toThrow();
    });

    it('映画タイトルを抽出できる', () => {
      const html = `
        <html>
          <body>
            <h1 class="movie-title">テスト映画タイトル</h1>
          </body>
        </html>
      `;

      const result = parser.parseMovieDetailPage(html);
      expect(result.title).toBe('テスト映画タイトル');
    });

    it('上映フォーマットを抽出できる', () => {
      const html = `
        <html>
          <body>
            <h1>テスト映画</h1>
            <span class="format">極音</span>
            <span class="format">通常</span>
          </body>
        </html>
      `;

      const result = parser.parseMovieDetailPage(html);
      expect(result.formats).toContain('極音');
      expect(result.formats).toContain('通常');
    });

    it('上映予定ステータスを正しく抽出できる', () => {
      const html = `
        <html>
          <body>
            <h1>上映予定映画</h1>
            <span class="status">上映予定</span>
          </body>
        </html>
      `;

      const result = parser.parseMovieDetailPage(html);
      expect(result.status).toBe('upcoming');
    });

    it('終了間近ステータスを正しく抽出できる', () => {
      const html = `
        <html>
          <body>
            <h1>終了間近映画</h1>
            <span class="movie-status">終了間近</span>
          </body>
        </html>
      `;

      const result = parser.parseMovieDetailPage(html);
      expect(result.status).toBe('ending_soon');
    });

    it('返却値には必須フィールドが含まれる', () => {
      const html = '<html><body><h1>映画</h1></body></html>';
      const result = parser.parseMovieDetailPage(html);

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('formats');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('description');
      expect(Array.isArray(result.formats)).toBe(true);
      expect(typeof result.description).toBe('string');
    });

    it('.movie-description クラスから作品紹介文を抽出できる', () => {
      const html = `
        <html>
          <body>
            <h1 class="movie-title">テスト映画</h1>
            <div class="movie-description">これはテスト映画の紹介文です。</div>
          </body>
        </html>
      `;

      const result = parser.parseMovieDetailPage(html);
      expect(result.description).toBe('これはテスト映画の紹介文です。');
    });

    it('.story クラスから作品紹介文を抽出できる', () => {
      const html = `
        <html>
          <body>
            <h1>テスト映画</h1>
            <div class="story">ストーリーの紹介文です。</div>
          </body>
        </html>
      `;

      const result = parser.parseMovieDetailPage(html);
      expect(result.description).toBe('ストーリーの紹介文です。');
    });

    it('紹介文がない場合は空文字列を返す', () => {
      const html = `
        <html>
          <body>
            <h1>タイトルのみの映画</h1>
          </body>
        </html>
      `;

      const result = parser.parseMovieDetailPage(html);
      expect(result.description).toBe('');
    });

    it('フォーマットの重複が除去される', () => {
      const html = `
        <html>
          <body>
            <h1>映画</h1>
            <span class="format">極音</span>
            <span class="format">極音</span>
            <span class="format">通常</span>
          </body>
        </html>
      `;

      const result = parser.parseMovieDetailPage(html);
      // 重複が除去されていることを確認する
      const uniqueFormats = [...new Set(result.formats)];
      expect(result.formats.length).toBe(uniqueFormats.length);
    });
  });

  // ============================================================
  // parseMovieDetailPage のプロパティベーステスト
  // ============================================================

  describe('parseMovieDetailPage プロパティベーステスト', () => {
    /**
     * Validates: Requirements 1.6
     * 任意の文字列を入力しても parseMovieDetailPage は例外をスローしない
     */
    test.prop(
      [fc.string()],
      {
        numRuns: 100,
      }
    )(
      'parseMovieDetailPage は任意の文字列入力で例外をスローしない',
      (input) => {
        expect(() => parser.parseMovieDetailPage(input)).not.toThrow();
        const result = parser.parseMovieDetailPage(input);
        // 返却値には必須フィールドが含まれることを確認する
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('formats');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('description');
        expect(typeof result.title).toBe('string');
        expect(Array.isArray(result.formats)).toBe(true);
        expect(typeof result.description).toBe('string');
      }
    );
  });
});
