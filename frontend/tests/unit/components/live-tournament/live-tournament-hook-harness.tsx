import { useEffect } from 'react';

type HookHarnessProperties<T> = {
  useHook: () => T;
  onUpdate: (value: T) => void;
};

export const HookHarness = <T,>({ useHook, onUpdate }: HookHarnessProperties<T>) => {
  const value = useHook();
  useEffect(() => {
    onUpdate(value);
  }, [value, onUpdate]);
  return <></>;
};
