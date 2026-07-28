"use client";

import { useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * สแกน QR จากรูปที่ถ่าย (ไม่ใช้กล้องสตรีมสด) — ใช้ input capture="environment"
 * แบบเดียวกับ PhotoCapture ให้พฤติกรรมสม่ำเสมอกันทั้งแอป และเลี่ยงความยุ่งยาก/
 * ความไม่แน่นอนของ getUserMedia บนมือถือหลากหลายรุ่น
 */
export function QrScanButton({
  onScan,
  label = "สแกน QR",
  className,
  disabled,
}: {
  onScan: (text: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas ไม่พร้อมใช้งาน");
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      if (!result || !result.data.trim()) {
        setError("ไม่พบ QR ในรูป ลองถ่ายใหม่ให้เห็น QR ชัด ๆ เต็มกรอบ");
        return;
      }
      onScan(result.data.trim());
    } catch {
      setError("อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) handleFile(picked);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
        className={
          className ??
          "shrink-0 rounded-lg border border-sky-700 px-3 py-2 text-sm font-medium text-sky-700 disabled:opacity-50"
        }
      >
        {busy ? "กำลังอ่าน…" : label}
      </button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
