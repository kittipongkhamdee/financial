"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Alert } from "@/components/ui";
import { fetchRegisterItems, humanizeError } from "@/lib/data";
import { describeLocation } from "@/lib/format";
import { useMasters } from "@/lib/hooks";
import type { AssetItem } from "@/lib/types";

/**
 * ป้ายครุภัณฑ์แบบ QR — แทนการพิมพ์เลขครุภัณฑ์ด้วยมือ
 * QR เก็บแค่ตัวเลขครุภัณฑ์เป็นข้อความล้วน (สแกนแล้วได้เลขไปกรอกต่อที่ไหนก็ได้ ไม่ผูกกับแอปนี้)
 */
export default function LabelsPage() {
  const { masters, error: mastersError } = useMasters();

  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrUrls, setQrUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!masters?.round) return;
    fetchRegisterItems(masters.round.id)
      .then(setItems)
      .catch((e) => setError(humanizeError(e)))
      .finally(() => setLoading(false));
  }, [masters]);

  const tagged = useMemo(
    () => items.filter((i): i is AssetItem & { asset_code: string } => !!i.asset_code),
    [items],
  );
  const untaggedCount = items.length - tagged.length;

  useEffect(() => {
    let alive = true;
    Promise.all(
      tagged.map(async (item) => {
        const url = await QRCode.toDataURL(item.asset_code, { margin: 1, width: 160 });
        return [item.id, url] as const;
      }),
    ).then((pairs) => {
      if (alive) setQrUrls(new Map(pairs));
    });
    return () => {
      alive = false;
    };
  }, [tagged]);

  if (mastersError) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Alert tone="error">{mastersError}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/review" className="text-sm text-sky-700">
          ‹ ตรวจสอบครุภัณฑ์
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white active:bg-sky-800"
        >
          พิมพ์ป้าย QR
        </button>
      </div>

      {error ? (
        <div className="no-print mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {loading ? (
        <p className="no-print mt-6 text-sm text-stone-500">กำลังโหลด…</p>
      ) : (
        <>
          {untaggedCount > 0 ? (
            <p className="no-print mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              มี {untaggedCount} รายการที่ยังไม่ติดป้าย — ออกหมายเลขให้ก่อนที่หน้าตรวจสอบครุภัณฑ์ ถึงจะพิมพ์ QR ให้ได้
            </p>
          ) : null}

          {tagged.length === 0 ? (
            <p className="no-print mt-6 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
              ยังไม่มีรายการที่ติดป้ายแล้ว
            </p>
          ) : (
            <div className="label-grid mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-4 print:gap-2">
              {tagged.map((item) => (
                <div
                  key={item.id}
                  className="label-card flex items-center gap-2 rounded-lg border border-stone-300 bg-white p-2"
                >
                  {qrUrls.get(item.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrUrls.get(item.id)} alt="" className="h-14 w-14 shrink-0" />
                  ) : (
                    <div className="h-14 w-14 shrink-0 animate-pulse rounded bg-stone-100" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-stone-900">{item.asset_code}</p>
                    <p className="truncate text-[10px] text-stone-600">{item.name}</p>
                    <p className="truncate text-[9px] text-stone-400">
                      {describeLocation(item.building, item.floor, item.room)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
