import { useRef, useEffect } from "react";

export function useDidChange<T>(
  value: T,
  callback: (newValue: T, oldValue: T) => void
) {
  const previousValueRef = useRef<T>(value);

  useEffect(() => {
    if (previousValueRef.current !== value) {
      callback(value, previousValueRef.current);
      previousValueRef.current = value;
    }
  }, [value, callback]);
}
