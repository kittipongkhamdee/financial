"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, ButtonLabel, Toast, inputClass, useToast } from "@/components/ui";
import { humanizeError } from "@/lib/data";
import {
  approveDisbursementRequest,
  fetchApprovedDisbursementTotals,
  fetchDisbursementRequests,
  rejectDisbursementRequest,
} from "@/lib/plan-data";
import type { PlanDisbursementRequestWithContext } from "@/lib/plan-types";
import { useProfile } from "@/lib/hooks";
import { formatBaht } from "@/lib/format";

export default function ApproveDisbursementPage() {
  const profile = useProfile();
  const { message, show } = useToast();
  const [error, setError] = useState<string | null>(null);

  const [pending, setPending] = useState<PlanDisbursementRequestWithContext[]>([]);
  const [remaining, setRemaining] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const isDirector = profile ? profile.role === "director" : null;

  function reload() {
    setLoading(true);
    fetchDisbursementRequests({ status: "pending" })
      .then(async (rows) => {
        setPending(rows);
        setRemaining(await fetchApprovedDisbursementTotals(rows.map((r) => r.activity_id)));
      })
      .catch((e) => setError(humanizeError(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (isDirector === true) reload();
  }, [isDirector]);

  async function handleApprove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await approveDisbursementRequest(id);
      setPending((prev) => prev.filter((r) => r.id !== id));
      show("อนุมัติแล้ว");
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;
    setBusyId(id);
    setError(null);
    try {
      await rejectDisbursementRequest(id, rejectReason.trim());
      setPending((prev) => prev.filter((r) => r.id !== id));
      setRejectingId(null);
      setRejectReason("");
      show("ไม่อนุมัติแล้ว");
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  if (profile && !isDirector) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Alert tone="error">หน้านี้สำหรับผู้อำนวยการเท่านั้น</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
      <h1 className="font-display text-xl font-bold text-stone-900">อนุมัติเบิกจ่ายงบประมาณ</h1>
      <p className="text-sm text-stone-600">คำขอที่รอตรวจสอบทั้งหมด</p>

      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-stone-500">กำลังโหลด…</p>
      ) : pending.length === 0 ? (
        <p className="mt-6 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          ไม่มีคำขอที่รออนุมัติ
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {pending.map((r) => {
            const approvedSoFar = remaining.get(r.activity_id) ?? 0;
            const before = r.activity.budget - approvedSoFar;
            const after = before - r.requested_amount;
            const busy = busyId === r.id;
            return (
              <li key={r.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="font-medium text-stone-900">{r.project.name}</p>
                <p className="text-xs text-stone-500">
                  {r.activity.name ?? "(งบอยู่ที่โครงการ)"} · {r.group.name}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  ผู้ขอ: {r.requester_name || "ไม่ระบุ"} ·{" "}
                  {new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short" }).format(new Date(r.requested_at))}
                </p>
                {r.purpose ? <p className="mt-1.5 text-sm text-stone-700">{r.purpose}</p> : null}

                <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600 sm:grid-cols-4">
                  <span>งบจัดสรร {formatBaht(r.activity.budget)}</span>
                  <span>คงเหลือก่อนขอ {formatBaht(before)}</span>
                  <span className="font-semibold text-stone-800">ขอเบิก {formatBaht(r.requested_amount)}</span>
                  <span className={after < 0 ? "font-semibold text-rose-700" : "font-semibold text-stone-800"}>
                    คงเหลือหลังอนุมัติ {formatBaht(after)}
                  </span>
                </div>
                {after < 0 ? (
                  <p className="mt-1 text-xs text-rose-700">คำเตือน: ยอดที่ขอเกินงบคงเหลือของกิจกรรมนี้</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={`/plan/requests/${r.id}/print`} className="text-xs text-sky-700 underline">
                    ดูเอกสาร
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleApprove(r.id)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:bg-stone-300"
                  >
                    <ButtonLabel busy={busy}>อนุมัติ</ButtonLabel>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setRejectingId(rejectingId === r.id ? null : r.id);
                      setRejectReason("");
                    }}
                    className="rounded-lg border border-rose-400 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:opacity-50"
                  >
                    ไม่อนุมัติ
                  </button>
                </div>

                {rejectingId === r.id ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      autoFocus
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="เหตุผลที่ไม่อนุมัติ"
                      className={`${inputClass} max-w-sm py-1.5 text-sm`}
                    />
                    <button
                      type="button"
                      disabled={!rejectReason.trim() || busy}
                      onClick={() => handleReject(r.id)}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white disabled:bg-stone-300"
                    >
                      <ButtonLabel busy={busy}>ยืนยันไม่อนุมัติ</ButtonLabel>
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Toast message={message} />
    </main>
  );
}
