import { Paintbrush } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-xl font-bold', className)}>
      <Paintbrush className="h-6 w-6 text-primary" />
      <span className="text-foreground">EstimateAI</span>
      <span className="text-primary">Painter</span>
    </div>
  );
}
