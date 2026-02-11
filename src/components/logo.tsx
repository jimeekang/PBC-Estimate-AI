
'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useEffect, useState } from 'react';

export function Logo({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const logo = PlaceHolderImages.find((img) => img.id === 'logo');

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={cn('flex items-center gap-2 font-bold', className)}>
      <div className="relative h-10 w-10 overflow-hidden rounded-full border border-primary/10 bg-white p-1 shadow-sm">
        {!mounted ? (
          <div className="h-full w-full bg-muted rounded-full" />
        ) : (
          <Image
            src="/logo-bg-remove.png"
            alt="PBC Logo"
            fill
            sizes="(max-width: 10rem) 100vw, 10rem"
            className="object-contain"
            data-ai-hint={logo?.imageHint || 'paint logo'}
            priority
          />
        )}
      </div>
      <div className="flex items-baseline gap-1.5 leading-none">
        <span className="text-foreground tracking-tight text-lg">PBC</span>
        <span className="text-primary text-lg font-bold">Estimate AI</span>
      </div>
    </div>
  );
}
