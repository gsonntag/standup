'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function PasswordGuard({ mustChange }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (mustChange && pathname !== '/team') {
      router.replace('/team');
    }
  }, [mustChange, pathname, router]);

  return null;
}
