'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { parseISODate } from '@/components/ui/Calendar';

interface VoteCount {
  candidateId: string;
  label: string;
  voteCount: number;
  dateValue?: string | null;
}

interface AdminCalendarViewProps {
  voteCounts: VoteCount[];
  totalResponses: number;
  locale: string;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

type StatusLevel = 'all' | 'most' | 'some' | 'none';

function getStatusLevel(voteCount: number, totalResponses: number): StatusLevel {
  if (totalResponses === 0) return 'none';
  const ratio = voteCount / totalResponses;
  if (ratio === 1) return 'all';
  if (ratio >= 0.5) return 'most';
  if (ratio > 0) return 'some';
  return 'none';
}

function getStatusIcon(level: StatusLevel): string {
  switch (level) {
    case 'all': return '\u2714';
    case 'most': return '\u25D0';
    case 'some': return '\u25B3';
    case 'none': return '\u2716';
  }
}

function getStatusColors(level: StatusLevel): string {
  switch (level) {
    case 'all':
      return 'bg-status-all-bg text-status-all';
    case 'most':
      return 'bg-status-most-bg text-status-most';
    case 'some':
      return 'bg-status-some-bg text-status-some';
    case 'none':
      return 'bg-status-none-bg text-status-none';
  }
}

interface MonthData {
  year: number;
  month: number;
  dates: Map<string, VoteCount>;
}

export function AdminCalendarView({ voteCounts, totalResponses, locale }: AdminCalendarViewProps) {
  const monthsData = useMemo(() => {
    const months = new Map<string, MonthData>();

    voteCounts.forEach((vc) => {
      if (!vc.dateValue) return;

      const date = parseISODate(vc.dateValue);
      const key = `${date.getFullYear()}-${date.getMonth()}`;

      if (!months.has(key)) {
        months.set(key, {
          year: date.getFullYear(),
          month: date.getMonth(),
          dates: new Map(),
        });
      }

      months.get(key)!.dates.set(vc.dateValue, vc);
    });

    return Array.from(months.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }, [voteCounts]);

  const weekdayLabels = useMemo(() => {
    if (locale === 'ja') {
      return ['日', '月', '火', '水', '木', '金', '土'];
    }
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }, [locale]);

  const monthLabels = useMemo(() => {
    if (locale === 'ja') {
      return [
        '1月', '2月', '3月', '4月', '5月', '6月',
        '7月', '8月', '9月', '10月', '11月', '12月',
      ];
    }
    return [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
  }, [locale]);

  if (monthsData.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-status-all-bg flex items-center justify-center">
            <span className="text-status-all text-[10px]">{getStatusIcon('all')}</span>
          </div>
          <span className="text-text-secondary">{locale === 'ja' ? '全員OK' : 'All available'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-status-most-bg flex items-center justify-center">
            <span className="text-status-most text-[10px]">{getStatusIcon('most')}</span>
          </div>
          <span className="text-text-secondary">{locale === 'ja' ? '半数以上OK' : 'Most available'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-status-some-bg flex items-center justify-center">
            <span className="text-status-some text-[10px]">{getStatusIcon('some')}</span>
          </div>
          <span className="text-text-secondary">{locale === 'ja' ? '一部のみ' : 'Some available'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-status-none-bg flex items-center justify-center">
            <span className="text-status-none text-[10px]">{getStatusIcon('none')}</span>
          </div>
          <span className="text-text-secondary">{locale === 'ja' ? '不可' : 'None available'}</span>
        </div>
      </div>

      {/* Calendars */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-6">
        {monthsData.map((monthData) => (
          <MonthCalendar
            key={`${monthData.year}-${monthData.month}`}
            year={monthData.year}
            month={monthData.month}
            dates={monthData.dates}
            totalResponses={totalResponses}
            weekdayLabels={weekdayLabels}
            monthLabels={monthLabels}
          />
        ))}
      </div>
    </div>
  );
}

interface MonthCalendarProps {
  year: number;
  month: number;
  dates: Map<string, VoteCount>;
  totalResponses: number;
  weekdayLabels: string[];
  monthLabels: string[];
}

function MonthCalendar({
  year,
  month,
  dates,
  totalResponses,
  weekdayLabels,
  monthLabels,
}: MonthCalendarProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const days: (Date | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }

  return (
    <div className="w-full sm:min-w-[280px] sm:w-auto">
      <div className="text-center font-semibold text-text-primary mb-2">
        {monthLabels[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdayLabels.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-text-muted py-1"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-12" />;
          }

          const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const voteData = dates.get(dateValue);

          if (!voteData) {
            return (
              <div
                key={date.toISOString()}
                className="h-12 flex items-center justify-center text-sm text-text-muted"
              >
                {date.getDate()}
              </div>
            );
          }

          const level = getStatusLevel(voteData.voteCount, totalResponses);
          const colorClass = getStatusColors(level);

          return (
            <div
              key={date.toISOString()}
              className={cn(
                'h-12 rounded-lg text-sm font-medium relative',
                colorClass
              )}
              title={`${voteData.label}: ${voteData.voteCount}/${totalResponses}`}
            >
              <span className="absolute top-1 left-1.5 text-xs">
                {date.getDate()}
              </span>
              <span className="absolute bottom-1 right-1.5 text-xs opacity-80">
                {voteData.voteCount}/{totalResponses}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
