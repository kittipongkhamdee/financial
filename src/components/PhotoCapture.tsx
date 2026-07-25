"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * ช่องถ่ายรูป — ใช้ capture="environment" เปิดกล้องหลังโดยตรงบนมือถือ
 * บนเดสก์ท็อปจะกลายเป็นเลือกไฟล์ตามปกติ
 */
export function PhotoCapture({
  file,
  onPick,
  onClear,
  compact,
}: {
  file: File | null;
  onPick: (file: File) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // สร้าง blob URL ตอน render แล้วคืนคืนหน่วยความจำเมื่อเปลี่ยนไฟล์
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onPick(picked);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onPick(picked);
          e.target.value = "";
        }}
      />

      {preview ? (
        <div className="space-y-2">
          <div className={`overflow-hidden rounded-xl bg-stone-100 ${compact ? "h-40" : "h-64"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob URL ของไฟล์ที่เพิ่งถ่าย */}
            <img src={preview} alt="รูปที่ถ่ายไว้" className="h-full w-full object-cover" />
          </div>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-stone-700"
            >
              ถ่ายใหม่
            </button>
            <button type="button" onClick={onClear} className="rounded-lg px-3 py-1.5 text-stone-500">
              ลบรูป
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className={
              "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed " +
              "border-stone-300 bg-stone-50 text-stone-600 transition active:bg-stone-100 " +
              (compact ? "h-28" : "h-48")
            }
          >
            <span className="text-3xl" aria-hidden>
              📷
            </span>
            <span className="text-base font-medium">แตะเพื่อเปิดกล้อง</span>
          </button>
          <button
            type="button"
            onClick={() => libraryRef.current?.click()}
            className="w-full rounded-lg py-2 text-sm text-sky-700 underline-offset-2 hover:underline"
          >
            เลือกรูปจากเครื่อง
          </button>
        </div>
      )}
    </div>
  );
}
