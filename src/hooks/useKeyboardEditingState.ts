import { useEffect } from 'react';
import { isAppleMobileDevice, isTextEditingElement } from '../mobile/inputDetection';

type UseKeyboardEditingStateOptions = {
  onEditingChange: (next: boolean) => void;
};

export function useKeyboardEditingState({ onEditingChange }: UseKeyboardEditingStateOptions) {
  useEffect(() => {
    const isAppleMobile = isAppleMobileDevice();

    const updateViewportVars = () => {
      const vv = window.visualViewport;
      const layoutHeight = window.innerHeight;
      const height = vv?.height || layoutHeight;
      const offsetTop = vv?.offsetTop || 0;
      const keyboardInset = Math.max(0, Math.round(layoutHeight - (height + offsetTop)));

      document.documentElement.style.setProperty('--moniezi-app-vh', `${height * 0.01}px`);
      document.documentElement.style.setProperty('--moniezi-layout-vh', `${layoutHeight * 0.01}px`);
      document.documentElement.style.setProperty('--moniezi-keyboard-inset', `${keyboardInset}px`);
      document.documentElement.style.setProperty('--moniezi-ios-top-pad', isAppleMobile ? `${Math.max(16, Math.round(offsetTop + 16))}px` : '0px');

      const editing = isAppleMobile && keyboardInset > 120 && isTextEditingElement(document.activeElement);
      onEditingChange(editing);
      document.documentElement.classList.toggle('moniezi-keyboard-editing', editing);
      document.body.classList.toggle('moniezi-keyboard-editing', editing);

      if (isAppleMobile) {
        document.documentElement.scrollLeft = 0;
        document.body.scrollLeft = 0;
      }
    };

    const handleFocusState = () => {
      window.setTimeout(updateViewportVars, 40);
    };

    updateViewportVars();
    window.addEventListener('resize', updateViewportVars);
    window.addEventListener('orientationchange', updateViewportVars);
    window.addEventListener('focusin', handleFocusState);
    window.addEventListener('focusout', handleFocusState);
    window.visualViewport?.addEventListener('resize', updateViewportVars);

    return () => {
      window.removeEventListener('resize', updateViewportVars);
      window.removeEventListener('orientationchange', updateViewportVars);
      window.removeEventListener('focusin', handleFocusState);
      window.removeEventListener('focusout', handleFocusState);
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
      document.documentElement.classList.remove('moniezi-keyboard-editing');
      document.body.classList.remove('moniezi-keyboard-editing');
    };
  }, [onEditingChange]);
}
