const padNumber = (value: number) => String(value).padStart(2, '0');

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const parseLocalDateTime = (value: string): Date | undefined => {
  const trimmed = value.trim();
  const match = LOCAL_DATE_TIME_PATTERN.exec(trimmed);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hours = Number(match[4]);
    const minutes = Number(match[5]);
    const seconds = Number(match[6] ?? 0);
    const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const fallback = new Date(trimmed);
  if (Number.isNaN(fallback.getTime())) {
    return undefined;
  }
  return fallback;
};

const formatToLocalInput = (value?: string) => {
  if (!value) return '';
  const date = parseLocalDateTime(value);
  if (!date) return '';
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}T${padNumber(
    date.getHours()
  )}:${padNumber(date.getMinutes())}`;
};

const localInputToIso = (value?: string) => {
  if (!value) return value;
  const date = parseLocalDateTime(value);
  if (!date) return value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

export { formatToLocalInput, localInputToIso };
