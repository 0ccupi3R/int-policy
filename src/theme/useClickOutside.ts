import { useEffect, RefObject } from 'react';

/**
 * Custom hook to detect clicks outside of a specified element (or array of elements).
 * Ideal for auto-closing dropdowns, context menus, and popovers.
 * 
 * @param ref Ref or array of refs to target element(s)
 * @param handler Callback to fire when an outside click/touchstart is detected
 * @param enabled Whether the listener is active (defaults to true)
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null> | Array<RefObject<HTMLElement | null>>,
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const refs = Array.isArray(ref) ? ref : [ref];
      const isInside = refs.some((r) => r.current && r.current.contains(target));

      if (!isInside) {
        handler(event);
      }
    };

    document.addEventListener('mousedown', listener, true);
    document.addEventListener('touchstart', listener, true);

    return () => {
      document.removeEventListener('mousedown', listener, true);
      document.removeEventListener('touchstart', listener, true);
    };
  }, [ref, handler, enabled]);
}

export default useClickOutside;
