'use client';

import { useEffect } from 'react';

/**
 * Breaks the app out of any iframe it is embedded in.
 * Defence-in-depth alongside the Content-Security-Policy frame-ancestors 'none' header.
 */
export default function FrameBuster() {
  useEffect(() => {
    if (window.top !== window.self) {
      window.top!.location.href = window.location.href;
    }
  }, []);

  return null;
}
