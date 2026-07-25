const bahtFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBaht(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return bahtFormatter.format(value);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("th-TH").format(value);
}

/** "324" + อาคาร/ชั้น → "อาคาร 3 · ชั้น 2 · ห้อง 324" */
export function describeLocation(building: string, floor: string | null, room: string) {
  return [building, floor ? `ชั้น ${floor}` : null, `ห้อง ${room}`]
    .filter(Boolean)
    .join(" · ");
}

/** รับเฉพาะตัวเลขจาก input ที่ครูพิมพ์ราคา (มี comma ได้) */
export function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * ขยับเลขวิ่งท้ายหมายเลขครุภัณฑ์ตามส่วนต่างจำนวน
 * เช่น "7440-001-0012/2566" delta=1 → "7440-001-0013/2566"
 * (ถ้ามี "/" ถือว่าส่วนหลังคือปี ไม่แตะ — ขยับเฉพาะเลขก่อน "/")
 * หาตัวเลขไม่เจอหรือ delta เป็น 0 คืนค่าเดิม ไม่ให้ติดลบ
 */
export function shiftAssetCodeSerial(code: string, delta: number): string {
  if (!code || delta === 0) return code;

  const slashIdx = code.lastIndexOf("/");
  const target = slashIdx === -1 ? code : code.slice(0, slashIdx);
  const rest = slashIdx === -1 ? "" : code.slice(slashIdx);

  const match = target.match(/(\d+)(\D*)$/);
  if (!match) return code;

  const [, digits, tail] = match;
  const prefix = target.slice(0, target.length - digits.length - tail.length);
  const next = Number(digits) + delta;
  if (next < 0) return code;

  return prefix + String(next).padStart(digits.length, "0") + tail + rest;
}
