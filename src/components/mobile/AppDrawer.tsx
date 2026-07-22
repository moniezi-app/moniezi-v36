import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useKeyboardSafeScroll } from "../../hooks/useKeyboardSafeScroll";

type AppDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

export function AppDrawer({ isOpen, onClose, title, children }: AppDrawerProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  useKeyboardSafeScroll({ containerRef: scrollAreaRef, enabled: isOpen });

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="moniezi-drawer-overlay modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="moniezi-drawer-backdrop" onClick={onClose} aria-label="Close drawer backdrop" />
      <div className="moniezi-drawer-panel drawer-shell animate-in slide-in-from-bottom duration-300">
        <div className="drawer-header moniezi-drawer-header flex items-center justify-between gap-4 px-5 sm:px-8 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
          <h2 className="min-w-0 text-2xl font-bold text-slate-900 dark:text-white tracking-tight break-words">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close transaction drawer" className="moniezi-drawer-close-button shrink-0 p-2 rounded-full text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X size={30} strokeWidth={1.7} />
          </button>
        </div>
        <div ref={scrollAreaRef} className="drawer-scroll-area px-4 sm:px-8 pb-8 modal-scroll-area custom-scrollbar" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
