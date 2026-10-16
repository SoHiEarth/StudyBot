import { CONFIG } from "./config.js";

export function formatMinutes_(minutes) {
  const n = Math.max(0, Math.floor(Number(minutes) || 0));

  const MINUTES_PER_HOUR = 60;
  const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
  const MINUTES_PER_MONTH = 30 * MINUTES_PER_DAY;
  const MINUTES_PER_YEAR = 365 * MINUTES_PER_DAY;

  let remaining = n;

  const years = Math.floor(remaining / MINUTES_PER_YEAR);
  remaining %= MINUTES_PER_YEAR;

  const months = Math.floor(remaining / MINUTES_PER_MONTH);
  remaining %= MINUTES_PER_MONTH;

  const days = Math.floor(remaining / MINUTES_PER_DAY);
  remaining %= MINUTES_PER_DAY;

  const hours = Math.floor(remaining / MINUTES_PER_HOUR);
  const mins = remaining % MINUTES_PER_HOUR;

  const parts = [];

  if (years) parts.push(`${years}年`);
  if (months) parts.push(`${months}ヶ月`);
  if (days) parts.push(`${days}日`);
  if (hours) parts.push(`${hours}時間`);
  if (mins) parts.push(`${mins}分`);

  return parts.length ? parts.join('') : '0分';
}

export function today_() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: CONFIG.TIMEZONE
  }).format(new Date());
}

export function shiftDate_(date, days) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekStart_(date) {
  const day = new Date(date + "T00:00:00Z").getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return shiftDate_(date, diff);
}

export function monthStart_(date) {
  return date.slice(0, 7) + "-01";
}

export function normalizeDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: CONFIG.TIMEZONE
    }).format(value);
  }
  const s = String(value || "").trim();
  const match = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    return match[1] + "-" +
      match[2].padStart(2, "0") + "-" +
      match[3].padStart(2, "0");
  }
  return s;
}