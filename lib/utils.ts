export function uid(prefix: string): string {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function pad(n: number | string, len: number): string {
  let s = String(n);
  while (s.length < len) s = '0' + s;
  return s;
}

export function thaiYear(dateStr?: string | null): number {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.getFullYear() + 543;
}

export function fmtDate(dStr?: string | null): string {
  if (!dStr) return '-';
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return '-';
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function fmtMoney(n?: number | null): string {
  const val = Number(n) || 0;
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getTodayThaiFormatted(): string {
  const now = new Date();
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  return `วัน${days[now.getDay()]}ที่ ${fmtDate(now.toISOString())}`;
}

export function normalizeDateForImport(v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime()) && /\d{4}/.test(s)) return parsed.toISOString().slice(0, 10);
  return s;
}
