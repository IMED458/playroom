import { useEffect } from 'react';

/** მოდალის გახსნისას გვერდის ფონური სქროლი იბლოკება */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isLocked]);
}
