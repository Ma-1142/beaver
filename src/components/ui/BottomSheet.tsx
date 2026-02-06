'use client';

import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({ isOpen, onClose, children, className }: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.velocity.y > 300 || info.offset.y > 150) {
      onClose();
    }
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-surface max-h-[80vh] overflow-y-auto ${className || ''}`}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-border-secondary" />
            </div>

            {/* Content */}
            <div className="px-6 pb-8">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// DateDetailContent for use within BottomSheet
interface DateDetailContentProps {
  dateLabel: string;
  statusLevel: 'all' | 'most' | 'some' | 'none';
  statusLabel: string;
  voteCount: number;
  totalResponses: number;
  locale: string;
}

function getStatusIcon(level: string): string {
  switch (level) {
    case 'all': return '\u2714';
    case 'most': return '\u25D0';
    case 'some': return '\u25B3';
    case 'none': return '\u2716';
    default: return '';
  }
}

export function DateDetailContent({
  dateLabel,
  statusLevel,
  statusLabel,
  voteCount,
  totalResponses,
  locale,
}: DateDetailContentProps) {
  const percentage = totalResponses > 0 ? Math.round((voteCount / totalResponses) * 100) : 0;

  const statusColorClass = {
    all: 'text-status-all',
    most: 'text-status-most',
    some: 'text-status-some',
    none: 'text-status-none',
  }[statusLevel];

  const barColorClass = {
    all: 'bg-status-all',
    most: 'bg-status-most',
    some: 'bg-status-some',
    none: 'bg-status-none',
  }[statusLevel];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-text-primary">{dateLabel}</h3>

      <div className={`flex items-center gap-2 ${statusColorClass}`}>
        <span className="text-xl">{getStatusIcon(statusLevel)}</span>
        <span className="font-medium">{statusLabel}</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-text-secondary">
          <span>{locale === 'ja' ? '回答' : 'Votes'}</span>
          <span>{voteCount} / {totalResponses} ({percentage}%)</span>
        </div>
        <div className="h-3 bg-surface-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
