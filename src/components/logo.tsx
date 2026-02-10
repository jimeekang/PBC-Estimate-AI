import { cn } from '@/lib/utils';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function Logo({ className }: { className?: string }) {
  const logo = PlaceHolderImages.find((img) => img.id === 'logo');

  return (
    <div className={cn('flex items-center gap-2 text-xl font-bold', className)}>
      {logo ? (
        <Image
          src={logo.imageUrl}
          alt="Logo"
          width={28}
          height={28}
          className="object-contain"
          data-ai-hint={logo.imageHint}
        />
      ) : null}
      <div className="flex items-center gap-1">
        <span className="text-foreground">EstimateAI</span>
        <span className="text-primary">Painter</span>
      </div>
    </div>
  );
}
