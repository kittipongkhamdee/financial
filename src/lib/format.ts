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
