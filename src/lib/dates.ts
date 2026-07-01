const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseLocalDate(date: string): Date {
  if (!DATE_ONLY_PATTERN.test(date)) {
    return new Date(date);
  }

  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getLocalDateTime(date: string): number {
  return parseLocalDate(date).getTime();
}

export function formatLocalDate(
  date: string,
  options?: Intl.DateTimeFormatOptions,
  locales = "en-US"
): string {
  return parseLocalDate(date).toLocaleDateString(locales, options);
}
