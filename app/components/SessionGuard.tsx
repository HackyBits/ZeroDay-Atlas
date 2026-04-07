'use client';

import { useEffect } from 'react';
import db from '@/lib/instant';

const BOOT_ID_KEY = 'zda_boot_id';

export default function SessionGuard() {
  const { user } = db.useAuth();

  useEffect(() => {
    if (!user) return;

    fetch('/api/boot')
      .then((r) => r.json())
      .then(({ bootId }: { bootId: string }) => {
        const stored = localStorage.getItem(BOOT_ID_KEY);
        if (stored && stored !== bootId) {
          // Server restarted — invalidate the session
          db.auth.signOut();
        }
        localStorage.setItem(BOOT_ID_KEY, bootId);
      })
      .catch(() => {/* network error — leave session intact */});
  }, [user]);

  return null;
}
