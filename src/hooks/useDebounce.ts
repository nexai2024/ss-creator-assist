import { useState, useEffect } from 'react';

/**
 * Debounce a value — returns the value after `delay` ms has passed
 * without it changing. Useful for debouncing search inputs.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debounced;
}
