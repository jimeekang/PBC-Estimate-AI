
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] text-center px-4">
      <h1 className="text-8xl font-bold text-primary">404</h1>
      <p className="text-2xl font-semibold mt-4">Page Not Found</p>
      <p className="text-muted-foreground mt-2">
        Sorry, the page you are looking for does not exist or has been moved.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">Go back to Homepage</Link>
      </Button>
    </div>
  );
}
