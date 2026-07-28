"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui";
import { humanizeError } from "@/lib/data";
import {
  fetchApprovedDisbursementTotals,
  fetchDisbursementRequestWithContext,
  fetchProfileNamesByIds,
} from "@/lib/plan-data";
import type { PlanDisbursementRequestWithContext } from "@/lib/plan-types";
import { useSchoolSettings } from "@/lib/hooks";
import { formatBaht } from "@/lib/format";

const STATUS_LABEL = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ" } as const;

export default function DisbursementRequestPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { settings } = useSchoolSettings();

  const [request, setRequest] = useState<PlanDisbursementRequestWithContext | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [approvedBefore, setApprovedBefore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDisbursementRequestWithContext(id)
      .then(async (r) => {
        if (!r) {
          setError("ไม่พบคำขอนี้");
          return;
        }
        setRequest(r);
        const [nameMap, totals] = await Promise.all([
          r.approved_by ? fetchProfileNamesByIds([r.approved_by]) : Promise.resolve(new Map<string, string>()),
          fetchApprovedDisbursementTotals([r.activity_id]),
        ]);
        setNames(nameMap);
        // ยอดอนุมัติสะสมรวมคำขอนี้เองถ้าอนุมัติแล้ว — เอายอด "ก่อนคำขอนี้" จึงต้องหักออก
        const totalApproved = totals.get(r.activity_id) ?? 0;
        setApprovedBefore(r.status === "approved" ? totalApproved - r.requested_amount : totalApproved);
      })
      .catch((e) => setError(humanizeError(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Alert tone="error">{error}</Alert>
      </main>
    );
  }

  if (loading || !request) {
    return <main className="flex-1 px-5 py-10 text-center text-sm text-stone-500">กำลังโหลด…</main>;
  }

  const before = request.activity.budget - approvedBefore;
  const after = before - request.requested_amount;
  const printedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date());

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/plan/requests" className="text-sm text-sky-700">
          ‹ คำขอเบิกจ่าย
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white active:bg-sky-800"
        >
          พิมพ์ / ส่งออก PDF
        </button>
      </div>

      <div className="mt-6 print:mt-0">
        <div className="text-center">
          <h1 className="font-display text-lg font-bold text-stone-900">แบบขออนุมัติเบิกจ่ายงบประมาณ</h1>
          <p className="mt-1 text-sm text-stone-700">{settings?.school_name ?? ""}</p>
          <p className="text-xs text-stone-500">
            เลขที่คำขอ {request.id.slice(0, 8)} · วันที่{" "}
            {new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(request.requested_at))}
          </p>
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <tbody>
            <Row label="กลุ่มบริหาร" value={request.group.name} />
            <Row label="โครงการ" value={request.project.name} />
            <Row label="กิจกรรม" value={request.activity.name ?? "(งบอยู่ที่โครงการ)"} />
            <Row label="รายละเอียด/วัตถุประสงค์" value={request.purpose || "—"} />
          </tbody>
        </table>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-stone-100 print:bg-transparent">
              {["งบที่จัดสรร", "คงเหลือก่อนขอ", "ขออนุมัติเบิกครั้งนี้", "คงเหลือหลังอนุมัติ"].map((h) => (
                <th key={h} className="border border-stone-400 px-2 py-1.5 text-center font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-stone-300 px-2 py-1.5 text-center">{formatBaht(request.activity.budget)}</td>
              <td className="border border-stone-300 px-2 py-1.5 text-center">{formatBaht(before)}</td>
              <td className="border border-stone-300 px-2 py-1.5 text-center font-semibold">
                {formatBaht(request.requested_amount)}
              </td>
              <td className="border border-stone-300 px-2 py-1.5 text-center font-semibold">{formatBaht(after)}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-4 text-sm text-stone-700">
          สถานะ: <span className="font-semibold">{STATUS_LABEL[request.status]}</span>
          {request.status === "rejected" && request.reject_reason ? ` — เหตุผล: ${request.reject_reason}` : ""}
        </p>

        <div className="mt-10 grid grid-cols-2 gap-8 text-center text-sm">
          <div>
            <p>ลงชื่อ ....................................................</p>
            <p className="mt-1">( {request.requester_name || "..............................."} )</p>
            <p className="mt-1 text-stone-500">ผู้ขออนุมัติ</p>
            <p className="mt-4 text-stone-500">วันที่ .....................................</p>
          </div>
          <div>
            <p>ลงชื่อ ....................................................</p>
            <p className="mt-1">
              ({" "}
              {request.approved_by
                ? (names.get(request.approved_by) ?? "...............................")
                : "..............................."}{" "}
              )
            </p>
            <p className="mt-1 text-stone-500">ผู้อำนวยการ (ผู้อนุมัติ)</p>
            <p className="mt-4 text-stone-500">
              วันที่{" "}
              {request.approved_at
                ? new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(request.approved_at))
                : "....................................."}
            </p>
          </div>
        </div>

        <p className="no-print mt-8 text-[10px] text-stone-400">พิมพ์เมื่อ {printedAt}</p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-stone-200">
      <td className="w-40 py-1.5 pr-3 align-top text-stone-500">{label}</td>
      <td className="py-1.5 font-medium text-stone-900">{value}</td>
    </tr>
  );
}
