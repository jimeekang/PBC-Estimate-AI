import { cn } from '@/lib/utils';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function Logo({ className }: { className?: string }) {
  const logo = PlaceHolderImages.find((img) => img.id === 'logo');

  return (
    <div className={cn('flex items-center gap-3 text-xl font-bold', className)}>
      {logo ? (
        <div className="relative h-10 w-10 overflow-hidden rounded-full border border-primary/10 bg-white p-1 shadow-sm">
          <Image
            src={logo.imageUrl}
            alt="Paint Buddy & Co Logo"
            fill
            className="object-contain"
            data-ai-hint={logo.imageHint}
          />
        </div>
      ) : null}
      <div className="flex flex-col leading-tight">
        <span className="text-foreground tracking-tight">Paint Buddy</span>
        <span className="text-primary text-sm font-medium">& Co</span>
      </div>
    </div>
  );
}