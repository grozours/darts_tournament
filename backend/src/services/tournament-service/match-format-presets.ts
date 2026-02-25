export const normalizeMatchFormatKey = (
  value: unknown
): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const getBracketRoundMatchFormatKey = (
  roundMatchFormats: unknown,
  roundNumber: number
): string | undefined => {
  if (!roundMatchFormats || typeof roundMatchFormats !== 'object') {
    return undefined;
  }
  const key = (roundMatchFormats as Record<string, unknown>)[String(roundNumber)];
  return normalizeMatchFormatKey(key);
};
