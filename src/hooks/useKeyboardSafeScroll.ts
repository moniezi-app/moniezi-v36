import { RefObject, useEffect } from 'react';
import { isTextEditingElement } from '../mobile/inputDetection';

type UseKeyboardSafeScrollOptions = {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  focusDelay?: number;
  resizeDelay?: number;
  topPadding?: number;
};

export function useKeyboardSafeScroll({ containerRef, enabled, focusDelay = 220, resizeDelay = 60, topPadding = 20 }: UseKeyboardSafeScrollOptions) {
  useEffect(() => {
    if (!enabled) return;
    const scrollArea = containerRef.current;
    if (!scrollArea) return;

    let activeTimer: number | null = null;

    const syncFocusedFieldIntoView = (target: HTMLElement) => {
      if (!scrollArea.contains(target)) return;
      const scrollAreaRect = scrollArea.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const keyboardInset = Math.max(0, window.innerHeight - viewportHeight - (window.visualViewport?.offsetTop || 0));
      const visibleTop = scrollAreaRect.top + 12;
      const visibleBottom = Math.min(scrollAreaRect.bottom, viewportHeight) - Math.max(16, keyboardInset > 0 ? 14 : 12);

      if (targetRect.top >= visibleTop && targetRect.bottom <= visibleBottom) return;

      const targetTopInScroll = scrollArea.scrollTop + (targetRect.top - scrollAreaRect.top);
      const alignOffset = Math.max(topPadding, Math.min(96, scrollArea.clientHeight * 0.18));
      const nextScrollTop = Math.max(0, targetTopInScroll - alignOffset);
      scrollArea.scrollTo({ top: nextScrollTop, behavior: 'auto' });
    };

    const scheduleSync = (target: HTMLElement, delay: number) => {
      if (activeTimer) window.clearTimeout(activeTimer);
      activeTimer = window.setTimeout(() => syncFocusedFieldIntoView(target), delay);
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !isTextEditingElement(target)) return;
      scheduleSync(target, focusDelay);
    };

    const handleViewportResize = () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || !scrollArea.contains(active) || !isTextEditingElement(active)) return;
      scheduleSync(active, resizeDelay);
    };

    scrollArea.addEventListener('focusin', handleFocusIn, { passive: true });
    window.visualViewport?.addEventListener('resize', handleViewportResize);

    return () => {
      if (activeTimer) window.clearTimeout(activeTimer);
      scrollArea.removeEventListener('focusin', handleFocusIn);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, [containerRef, enabled, focusDelay, resizeDelay, topPadding]);
}
