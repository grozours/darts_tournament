const padNumber = (value: number) => String(value).padStart(2, '0');

const formatToLocalInput = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}T${padNumber(
    date.getHours()
  )}:${padNumber(date.getMinutes())}`;
};

export { formatToLocalInput };
