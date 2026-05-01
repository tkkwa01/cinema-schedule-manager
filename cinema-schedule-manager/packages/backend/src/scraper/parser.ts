/**
 * HTMLパーサーモジュール
 * シネマシティ公式サイトのHTMLをパースして構造化データを抽出する
 */

import * as cheerio from 'cheerio';
import type {
  IParser,
  ParsedSchedule,
  ParsedShowing,
  ParsedMovieDetail,
  ShowingStatus,
} from '../types/index.js';

/**
 * シネマシティのHTMLをパースするクラス
 * IParser インターフェースを実装する
 * パースエラー時は絶対に例外をスローしない（要件1.6）
 */
export class CinemaCityParser implements IParser {
  /**
   * "HH:MM (HH:MM)" 形式の時刻文字列を開始時刻と終了時刻に分解する
   * @param timeStr - "HH:MM (HH:MM)" 形式の時刻文字列
   * @returns 開始時刻と終了時刻のオブジェクト。パース失敗時は空文字列を返す
   */
  parseTimeSlot(timeStr: string): { startTime: string; endTime: string } {
    // 空文字列や null/undefined の場合は早期リターン
    if (!timeStr || typeof timeStr !== 'string') {
      return { startTime: '', endTime: '' };
    }

    // "HH:MM (HH:MM)" 形式にマッチする正規表現
    // 例: "10:30 (12:45)"
    const pattern = /^(\d{2}:\d{2})\s+\((\d{2}:\d{2})\)$/;
    const match = timeStr.trim().match(pattern);

    if (!match) {
      // パース失敗時はログに記録して空文字列を返す
      console.error(`[CinemaCityParser] 時刻文字列のパースに失敗しました: "${timeStr}"`);
      return { startTime: '', endTime: '' };
    }

    return {
      startTime: match[1] as string,
      endTime: match[2] as string,
    };
  }

  /**
   * スケジュールページのHTMLからカレンダーの利用可能な日付一覧を取得する
   * /schedule/YYYYMMDD 形式のリンクから日付を抽出する
   */
  parseAvailableDates(html: string): string[] {
    if (!html) return [];
    try {
      const $ = cheerio.load(html);
      const dates = new Set<string>();
      $('a[href]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        const match = href.match(/\/schedule\/(\d{8})/);
        if (match?.[1]) {
          const d = match[1];
          dates.add(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`);
        }
      });
      return Array.from(dates).sort();
    } catch {
      return [];
    }
  }

  /**
   * スケジュールページのHTMLから実際の日付を取得する
   * サイトが返す date=YYYYMMDD 形式の値を YYYY-MM-DD に変換する
   */
  parseScheduleDate(html: string): string | null {
    if (!html) return null;
    try {
      const $ = cheerio.load(html);
      // カレンダーの選択中の日付を探す
      const todayEl = $('.today, .cal-day.today, [class*="today"]').first();
      const dateAttr = todayEl.attr('data-date') ?? todayEl.closest('a').attr('href');
      if (dateAttr) {
        const match = dateAttr.match(/date=(\d{8})/);
        if (match?.[1]) {
          const d = match[1];
          return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
        }
      }
      // URLのdate=パラメータから取得する
      const linkMatch = html.match(/[?&]date=(\d{8})/);
      if (linkMatch?.[1]) {
        const d = linkMatch[1];
        return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * スケジュールページのHTMLをパースしてスケジュール一覧を返す
   * 実際のシネマシティのHTML構造に対応する
   * 構造:
   *   <h2>▼ シネマ・ワン</h2>
   *   <tr><td><h3><span class="schedule-movie-title"><a href="...">タイトル</a></span></h3></td></tr>
   *   <tr>
   *     <td><span class="schedule-studio-name">a studio</span></td>
   *     <td><span class="start-time">10:00</span></td>
   *     <td><span class="end-time">12:00</span></td>
   *   </tr>
   *   <h2>▼ シネマ・ツー</h2>
   *   ...
   * @param html - スケジュールページのHTML文字列
   * @returns パース済みスケジュールの配列。パースエラー時は空配列を返す
   */
  parseSchedulePage(html: string): ParsedSchedule[] {
    if (!html || typeof html !== 'string') {
      return [];
    }

    try {
      const $ = cheerio.load(html);
      const schedules: ParsedSchedule[] = [];

      // 現在処理中の映画タイトル・フォーマット・劇場・映画IDを追跡する
      let currentMovieTitle = '';
      let currentFormat = '通常';
      let currentTheater: 'cinema-one' | 'cinema-two' = 'cinema-one';
      let currentMovieId: string | null = null;

      // ページ内のすべての要素を順番に処理する
      $('h2, tr').each((_i, el) => {
        const tagName = (el as { tagName?: string }).tagName?.toLowerCase();

        if (tagName === 'h2') {
          // 劇場区切りヘッダーを検出する
          const text = $(el).text().trim();
          if (text.includes('シネマ・ワン')) {
            currentTheater = 'cinema-one';
          } else if (text.includes('シネマ・ツー')) {
            currentTheater = 'cinema-two';
          }
          return;
        }

        // <tr> の処理
        const row = el;
        const titleEl = $(row).find('.schedule-movie-title');

        if (titleEl.length > 0) {
          // タイトル行: 映画タイトルとフォーマットを抽出する
          const rawTitle = titleEl.text().trim();

          // タイトルから【極音】【極爆】などのフォーマット情報を抽出する
          if (rawTitle.includes('極音')) {
            currentFormat = '極音';
          } else if (rawTitle.includes('極爆')) {
            currentFormat = '極爆';
          } else {
            currentFormat = '通常';
          }

          // フォーマット表記を除いたタイトルを取得する
          currentMovieTitle = rawTitle
            .replace(/\s*【[^】]*】\s*/g, '')
            .replace(/\u00a0/g, ' ')  // &nbsp; を通常スペースに変換
            .trim();

          // 映画IDをリンクから取得する
          const movieLink = titleEl.find('a[href]');
          const href = movieLink.attr('href') ?? '';
          const idMatch = href.match(/\/movie\/(\d+)/);
          currentMovieId = idMatch?.[1] ?? null;

        } else {
          // 時刻行: スタジオ名・開始時刻・終了時刻を抽出する
          const studioEls = $(row).find('.schedule-studio-name');

          if (studioEls.length > 0 && currentMovieTitle) {
            studioEls.each((_j, studioEl) => {
              const studio = $(studioEl).text().trim();
              if (!studio) return;

              // 1つのスタジオ行に複数の上映時間がある場合、すべて取得する
              // start-time と end-time は tdbg1 セルの中にある
              const tdbgCells = $(row).find('td.tdbg1');

              tdbgCells.each((_k, cell) => {
                const startTime = $(cell).find('.start-time').text().trim();
                const endTime = $(cell).find('.end-time').text().trim()
                  .replace(/[()]/g, ''); // "(HH:MM)" → "HH:MM"

                if (startTime && endTime) {
                  schedules.push({
                    movieTitle: currentMovieTitle,
                    studio,
                    startTime,
                    endTime,
                    format: currentFormat,
                    theater: currentTheater,
                    movieId: currentMovieId ?? undefined,
                  });
                }
              });
            });
          }
        }
      });

      return schedules;
    } catch (error) {
      console.error('[CinemaCityParser] スケジュールページのパースに失敗しました:', error);
      return [];
    }
  }

  /**
   * 上映作品ページのHTMLをパースして作品一覧を返す
   * 実際のHTML構造: <div id="showing"><ul><li><a href="/TicketReserver/studio/movie/3742">
   * タイトルはリンクテキストではなく画像のaltのみのため、IDのみ取得する
   * @param html - 上映作品ページのHTML文字列
   * @returns パース済み上映作品の配列。パースエラー時は空配列を返す
   */
  parseShowingPage(html: string): ParsedShowing[] {
    if (!html || typeof html !== 'string') {
      return [];
    }

    try {
      const $ = cheerio.load(html);
      const showings: ParsedShowing[] = [];

      // セクションIDとステータスのマッピング
      const sectionMap: Array<{ id: string; status: ShowingStatus }> = [
        { id: 'showing', status: 'showing' },
        { id: 'upcoming', status: 'upcoming' },
        { id: 'ending', status: 'ending_soon' },
        { id: 'subtitle', status: 'showing' },
      ];

      for (const { id, status } of sectionMap) {
        const section = $(`#${id}`);
        if (section.length === 0) continue;

        section.find('a[href]').each((_i, linkEl) => {
          const href = $(linkEl).attr('href') ?? '';
          const idMatch = href.match(/\/movie\/(\d+)/);
          if (!idMatch) return;

          const movieId = idMatch[1] as string;

          // 重複チェック
          if (showings.find(s => s.id === movieId)) return;

          // タイトルはリンクテキストまたはalt属性から取得する
          const title = $(linkEl).text().trim() ||
            $(linkEl).find('img').attr('alt') ||
            movieId;

          showings.push({
            id: movieId,
            title,
            formats: [],
            status,
          });
        });
      }

      return showings;
    } catch (error) {
      console.error('[CinemaCityParser] 上映作品ページのパースに失敗しました:', error);
      return [];
    }
  }

  /**
   * 映画詳細ページのHTMLをパースして映画詳細を返す
   * タイトル・フォーマット・ステータス・作品紹介文を抽出する
   * 実際のHTML構造:
   *   タイトル: #movie-title-back h1 span.movie-title
   *   紹介文:   #movie-text（直接テキストノードと <br>/<hr> で構成）
   * @param html - 映画詳細ページのHTML文字列
   * @returns パース済み映画詳細。パースエラー時はデフォルト値を返す
   */
  parseMovieDetailPage(html: string): ParsedMovieDetail {
    // デフォルト値（パースエラー時に返す）
    const defaultResult: ParsedMovieDetail = {
      title: '',
      formats: [],
      status: 'showing',
      description: '',
    };

    // 空文字列の場合はデフォルト値を返す
    if (!html || typeof html !== 'string') {
      return defaultResult;
    }

    try {
      const $ = cheerio.load(html);

      // 映画タイトルを取得する
      // 実際の構造: #movie-title-back h1 span.movie-title
      const title =
        $('#movie-title-back .movie-title').text().trim() ||
        $('#movie-title-back h1').text().trim() ||
        $('h1.movie-title').text().trim() ||
        $('h1').first().text().trim() ||
        $('.movie-title').first().text().trim() ||
        '';

      // 上映フォーマットを取得する
      const formats: string[] = [];
      $('.format, .movie-format').each((_i, el) => {
        const format = $(el).text().trim();
        if (format && !formats.includes(format)) {
          formats.push(format);
        }
      });

      // 上映ステータスを取得する
      let status: ShowingStatus = 'showing';
      const statusText =
        $('.movie-status, .status').first().text().trim().toLowerCase();

      if (statusText.includes('upcoming') || statusText.includes('上映予定')) {
        status = 'upcoming';
      } else if (
        statusText.includes('ending') ||
        statusText.includes('終了間近')
      ) {
        status = 'ending_soon';
      }

      // 作品紹介文を取得する
      // 実際の構造: #movie-text の直接テキストノード（<br>/<hr> で区切られた段落）
      // まず実際のHTML構造に対応するセレクターを試みる
      let description = '';

      const movieTextEl = $('#movie-text');
      if (movieTextEl.length > 0) {
        // #movie-text 内のテキストを取得する
        // cheerio の .text() はすべての子要素のテキストを結合するため、
        // <br> を改行に変換してから取得する
        movieTextEl.find('br').replaceWith('\n');
        movieTextEl.find('hr').replaceWith('\n');
        // リンク・画像・著作権表示・公式サイトボタンを除外する
        movieTextEl.find('#movie-copyright, #official-site, img, a').remove();
        description = movieTextEl.text().trim();
        // 連続する空白行を1行にまとめる
        description = description.replace(/\n{3,}/g, '\n\n').trim();
      }

      // フォールバック: 従来のセレクターを試みる
      if (!description) {
        description =
          $(
            '.movie-description, .movie-intro, .story, [class*="description"], [class*="intro"]'
          )
            .first()
            .text()
            .trim() || '';
      }

      return {
        title,
        formats,
        status,
        description,
      };
    } catch (error) {
      // パースエラーをログに記録してデフォルト値を返す（要件1.6）
      console.error('[CinemaCityParser] 映画詳細ページのパースに失敗しました:', error);
      return defaultResult;
    }
  }
}
