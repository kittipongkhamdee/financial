"use client";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;

/**
 * บีบอัด/ย่อรูปฝั่งเบราว์เซอร์ก่อนอัปโหลด — รูปจากกล้องมือถือมักหนัก 3–8 MB/ไฟล์
 * ย่อด้านยาวสุดเหลือ 1600px แล้วบันทึกเป็น JPEG คุณภาพ 75%
 *
 * ถอดรหัสไฟล์ไม่ได้ (เช่นบางฟอร์แมต HEIC ที่เบราว์เซอร์ไม่รองรับ) หรือบีบอัดแล้ว
 * ไม่เล็กลง → คืนไฟล์ต้นฉบับแทน ไม่ทำให้อัปโหลดพัง
 */
export async function compressImage(
  file: File,
): Promise<{ blob: Blob; ext: string; contentType: string }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context ไม่พร้อมใช้งาน");

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );

    if (blob && blob.size < file.size) {
      return { blob, ext: "jpg", contentType: "image/jpeg" };
    }
  } catch {
    // ใช้ไฟล์ต้นฉบับด้านล่างแทน
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return { blob: file, ext, contentType: file.type || "image/jpeg" };
}
