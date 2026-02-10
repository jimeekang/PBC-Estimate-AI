'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useState, useEffect } from 'react';

export function Logo({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const logo = PlaceHolderImages.find((img) => img.id === 'logo');

  return (
    <div className={cn('flex items-center gap-2 text-xl font-bold', className)}>
      <div className="relative h-10 w-10 overflow-hidden rounded-full border border-primary/10 bg-white p-1 shadow-sm">
        {mounted && logo && (
          <Image
            src={logo.imageUrl}
            alt="Paint Buddy & Co Logo"
            fill
            className="object-contain"
            data-ai-hint={logo.imageHint}
            priority
          />
        )}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-foreground tracking-tight">Paint Buddy</span>
        <span className="text-primary text-sm font-medium">& Co</span>
      </div>
    </div>
  );
}
