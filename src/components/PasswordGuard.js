'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function PasswordGuard({ mustChange }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (mustChange && pathname !== '/change-password') {
      router.replace('/change-password?forced=1');
    }
  }, [mustChange, pathname, router]);

  return null;
}
