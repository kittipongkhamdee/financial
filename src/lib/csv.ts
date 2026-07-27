/** แปลงค่าเป็น field CSV — ครอบด้วย "..." เมื่อมีจุลภาค/ขึ้นบรรทัดใหม่/เครื่องหมายคำพูดปน */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** ต่อ BOM นำหน้าเสมอ — ไม่งั้น Excel จะอ่านภาษาไทยเพี้ยน (ไม่ใช่ UTF-8 โดย default) */
export function rowsToCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCsvField(cell === null ? "" : String(cell))).join(","),
  );
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
