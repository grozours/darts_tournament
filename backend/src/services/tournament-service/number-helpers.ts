export const nextPowerOfTwo = (value: number): number => {
  let result = 1;
  while (result < value) result *= 2;
  return result;
};

export const isPowerOfTwo = (value: number): boolean => value > 0 && (value & (value - 1)) === 0;
