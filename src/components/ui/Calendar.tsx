'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface CalendarProps {
  selectedDates: Date[];
  onDatesChange: (dates: Date[]) => void;
  minDate?: Date;
  maxDate?: Date;
  allowedDates?: Date[];
  locale?: string;
  className?: string;
  availabilityCounts?: Map<string, number>; // dateValue (YYYY-MM-DD) -> count
  totalResponses?: number;
  onDateTap?: (dateValue: string, date: Date) => void;
  readOnly?: boolean;
  highlightDates?: string[]; // dateValue strings to highlight (e.g., best dates)
}

type StatusLevel = 'all' | 'most' | 'some' | 'none';

function getStatusLevel(count: number, total: number): StatusLevel {
  if (total === 0) return 'none';
  const ratio = count / total;
  if (ratio === 1) return 'all';
  if (ratio >= 0.5) return 'most';
  if (ratio > 0) return 'some';
  return 'none';
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function isDateInArray(date: Date, dates: Date[]): boolean {
  return dates.some((d) => isSameDay(d, date));
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface MonthCalendarProps {
  year: number;
  month: number;
  selectedDates: Date[];
  onDateClick: (date: Date) => void;
  minDate?: Date;
  allowedDates?: Date[];
  locale: string;
  weekdayLabels: string[];
  monthLabels: string[];
  availabilityCounts?: Map<string, number>;
  totalResponses?: number;
  onDateTap?: (dateValue: string, date: Date) => void;
  readOnly?: boolean;
  highlightDates?: string[];
}

function MonthCalendar({
  year,
  month,
  selectedDates,
  onDateClick,
  minDate,
  allowedDates,
  weekdayLabels,
  monthLabels,
  availabilityCounts,
  totalResponses = 0,
  onDateTap,
  readOnly = false,
  highlightDates = [],
}: MonthCalendarProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: (Date | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }

  const isDateSelectable = (date: Date): boolean => {
    if (minDate && date < minDate) return false;
    if (allowedDates) {
      return isDateInArray(date, allowedDates);
    }
    return true;
  };

  return (
    <div className="flex-1 min-w-0">
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
            return <div key={`empty-${index}`} className="h-14 sm:h-16" />;
          }

          const isSelected = isDateInArray(date, selectedDates);
          const isToday = isSameDay(date, today);
          const selectable = isDateSelectable(date);
          const isPast = date < today;

          const dateValue = toDateValue(date);
          const availCount = availabilityCounts?.get(dateValue) || 0;
          const showAvailability = allowedDates && totalResponses > 0;
          const statusLevel = showAvailability ? getStatusLevel(availCount, totalResponses) : null;
          const isHighlighted = highlightDates.includes(dateValue);

          const statusBgClass = statusLevel && !isSelected ? {
            all: 'bg-status-all-bg',
            most: 'bg-status-most-bg',
            some: 'bg-status-some-bg',
            none: 'bg-status-none-bg',
          }[statusLevel] : '';

          const statusIconColor = statusLevel ? {
            all: 'text-status-all',
            most: 'text-status-most',
            some: 'text-status-some',
            none: 'text-status-none',
          }[statusLevel] : '';

          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => {
                if (selectable && !readOnly) {
                  onDateClick(date);
                  if (onDateTap && showAvailability) {
                    onDateTap(dateValue, date);
                  }
                }
              }}
              disabled={!selectable}
              className={cn(
                'h-14 sm:h-16 w-full rounded-lg text-sm font-medium transition-all relative',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:ring-offset-background',
                readOnly
                  ? 'cursor-default'
                  : selectable
                  ? 'cursor-pointer hover:ring-2 hover:ring-primary-300'
                  : 'cursor-not-allowed opacity-30',
                isSelected
                  ? 'bg-primary-600 text-white'
                  : isPast && !allowedDates
                  ? 'text-text-muted'
                  : statusBgClass || 'text-text-primary',
                isToday && !isSelected && 'ring-2 ring-primary-300',
                isHighlighted && !isSelected && 'ring-2 ring-primary-500'
              )}
            >
              <span className={cn(
                'absolute top-1 left-1.5 text-xs',
                isSelected ? 'text-white' : ''
              )}>
                {date.getDate()}
              </span>
              {showAvailability && selectable && (
                <span className={cn(
                  'absolute bottom-1 right-1.5 text-[10px] opacity-80',
                  isSelected ? 'text-white' : statusIconColor
                )}>
                  {availCount}/{totalResponses}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Calendar({
  selectedDates,
  onDatesChange,
  minDate,
  allowedDates,
  locale = 'ja',
  className,
  availabilityCounts,
  totalResponses = 0,
  onDateTap,
  readOnly = false,
  highlightDates = [],
}: CalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const effectiveMinDate = minDate || today;

  const [viewDate, setViewDate] = useState(
    new Date(effectiveMinDate.getFullYear(), effectiveMinDate.getMonth(), 1)
  );

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

  const handleDateClick = (date: Date) => {
    const isAlreadySelected = isDateInArray(date, selectedDates);
    if (isAlreadySelected) {
      onDatesChange(selectedDates.filter((d) => !isSameDay(d, date)));
    } else {
      onDatesChange([...selectedDates, date].sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const goToPreviousMonths = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 2, 1));
  };

  const goToNextMonths = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 2, 1));
  };

  const canGoPrevious = () => {
    const prevMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    return prevMonth >= new Date(effectiveMinDate.getFullYear(), effectiveMinDate.getMonth(), 1);
  };

  const month1 = { year: viewDate.getFullYear(), month: viewDate.getMonth() };
  const month2 = {
    year: viewDate.getMonth() === 11 ? viewDate.getFullYear() + 1 : viewDate.getFullYear(),
    month: (viewDate.getMonth() + 1) % 12,
  };

  return (
    <div className={cn('', className)}>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={goToPreviousMonths}
          disabled={!canGoPrevious()}
          className={cn(
            'p-2 rounded-lg transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary-500',
            canGoPrevious()
              ? 'hover:bg-surface-secondary text-text-secondary'
              : 'text-text-muted cursor-not-allowed'
          )}
          aria-label="Previous months"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={goToNextMonths}
          className={cn(
            'p-2 rounded-lg transition-colors',
            'hover:bg-surface-secondary text-text-secondary',
            'focus:outline-none focus:ring-2 focus:ring-primary-500'
          )}
          aria-label="Next months"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Two-month view */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <MonthCalendar
          year={month1.year}
          month={month1.month}
          selectedDates={selectedDates}
          onDateClick={handleDateClick}
          minDate={effectiveMinDate}
          allowedDates={allowedDates}
          locale={locale}
          weekdayLabels={weekdayLabels}
          monthLabels={monthLabels}
          availabilityCounts={availabilityCounts}
          totalResponses={totalResponses}
          onDateTap={onDateTap}
          readOnly={readOnly}
          highlightDates={highlightDates}
        />
        <MonthCalendar
          year={month2.year}
          month={month2.month}
          selectedDates={selectedDates}
          onDateClick={handleDateClick}
          minDate={effectiveMinDate}
          allowedDates={allowedDates}
          locale={locale}
          weekdayLabels={weekdayLabels}
          monthLabels={monthLabels}
          availabilityCounts={availabilityCounts}
          totalResponses={totalResponses}
          onDateTap={onDateTap}
          readOnly={readOnly}
          highlightDates={highlightDates}
        />
      </div>

      {/* Selected dates count */}
      {!readOnly && selectedDates.length > 0 && (
        <div className="mt-4 text-sm text-text-secondary text-center">
          {locale === 'ja'
            ? `${selectedDates.length}日選択中`
            : `${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''} selected`}
        </div>
      )}
    </div>
  );
}

// Helper to format date for display
export function formatDateLabel(date: Date, locale: string): string {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  };
  return date.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', options);
}

// Helper to parse ISO date string (YYYY-MM-DD) to local Date
export function parseISODate(isoString: string): Date {
  const [year, month, day] = isoString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper to convert Date to ISO date string (YYYY-MM-DD) using local time
export function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
