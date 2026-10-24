'use client';

import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t bg-card py-6">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Paint Buddy &amp; Co. All rights reserved.{' '}
          <a
            href="mailto:info@paintbuddyco.com.au"
            className="underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            info@paintbuddyco.com.au
          </a>
        </p>
      </div>
    </footer>
  );
}
