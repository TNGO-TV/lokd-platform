'use client';
import {useEffect} from 'react';

/** Scroll/focus a deep-linked record by path id (not hash). Re-runs when `ready` flips true after data load. */
export function useFocusRecord(focusId: string | undefined, ready = true) {
  useEffect(() => {
    if (!focusId || !ready) return;
    let id = focusId;
    try { id = decodeURIComponent(focusId); } catch { /* keep raw */ }
    const timer = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({block: 'start', behavior: 'smooth'});
      el.setAttribute('data-lokd-focus', 'true');
      if (typeof el.focus === 'function') {
        try { el.focus({preventScroll: true}); } catch { /* non-focusable */ }
      }
    }, 50);
    return () => window.clearTimeout(timer);
  }, [focusId, ready]);
}
