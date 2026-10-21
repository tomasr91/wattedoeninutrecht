import { useEffect, useRef, type ReactNode } from 'react';
import { IconClose } from './Icons';

/** Onderblad (bottom sheet): bereikbaar met één duim, sluit met Esc, achtergrond of de knop. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  labelledBy,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Alleen bij openen: focus naar het blad, Esc sluit, achtergrond scrollt niet mee.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      prev?.focus?.({ preventScroll: true });
    };
  }, []);
  // Ander item in hetzelfde blad (bv. andere locatie): terug naar boven.
  useEffect(() => {
    ref.current?.querySelector('.sheet-body')?.scrollTo({ top: 0 });
  }, [title]);
  const id = labelledBy ?? `sheet-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-head">
          <h2 id={id}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten">
            <IconClose />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}
