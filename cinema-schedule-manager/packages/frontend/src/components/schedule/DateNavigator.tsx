/**
 * 日付ナビゲーションコンポーネント
 * 日付ボタンを横並びで表示する（要件3.4）
 */

interface DateNavigatorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  availableDates: string[];
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year!, month! - 1, day!);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return {
    month: month!,
    day: day!,
    dayOfWeek: days[date.getDay()] ?? '',
    isSunday: date.getDay() === 0,
    isSaturday: date.getDay() === 6,
  };
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function DateNavigator({ selectedDate, onDateChange, availableDates }: DateNavigatorProps) {
  const today = getTodayString();

  return (
    <nav aria-label="日付ナビゲーション" className="w-full overflow-x-auto">
      <div className="flex gap-1 px-2 pb-1">
        {availableDates.map(date => {
          const { month, day, dayOfWeek, isSunday, isSaturday } = formatDate(date);
          const isSelected = date === selectedDate;
          const isToday = date === today;

          let dayColor = 'text-gray-500';
          if (isSunday) dayColor = 'text-red-400';
          if (isSaturday) dayColor = 'text-blue-400';
          if (isSelected) dayColor = 'text-blue-100';

          return (
            <button
              key={date}
              onClick={() => onDateChange(date)}
              aria-label={`${month}月${day}日${isToday ? '（今日）' : ''}`}
              aria-pressed={isSelected}
              className={`
                flex-shrink-0 flex flex-col items-center justify-center
                w-12 py-2 rounded-lg text-xs font-medium
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                ${isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isToday
                    ? 'bg-blue-50 text-blue-700 border border-blue-300'
                    : 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-200'
                }
              `}
            >
              <span className={`text-xs leading-none ${dayColor}`}>{dayOfWeek}</span>
              <span className="text-base leading-tight font-bold mt-0.5">{day}</span>
              <span className={`text-xs leading-none mt-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>{month}月</span>
              {isToday && !isSelected && (
                <span className="w-1 h-1 rounded-full bg-blue-500 mt-0.5" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
