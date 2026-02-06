import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TwoColumnLayoutProps {
  left: ReactNode;
  right: ReactNode;
  className?: string;
}

export function TwoColumnLayout({ left, right, className }: TwoColumnLayoutProps) {
  return (
    <div className={cn('max-w-6xl mx-auto', className)}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        <div className="lg:sticky lg:top-20 lg:self-start">
          {left}
        </div>
        <div>
          {right}
        </div>
      </div>
    </div>
  );
}
