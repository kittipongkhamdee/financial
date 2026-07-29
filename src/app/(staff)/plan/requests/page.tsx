"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, ButtonLabel, Toast, inputClass, useToast } from "@/components/ui";
import { humanizeError } from "@/lib/data";
import {
  createDisbursementRequest,
  deleteDisbursementRequest,
  fetchActivePlanRequesters,
  fetchApprovedDisbursementTotals,
  fetchDisbursementRequests,
  fetchPlanAdminGroups,
  fetchPlanProjectsWithActivities,
  fetchPlanYears,
} from "@/lib/plan-data";
import type {
  PlanAdminGroup,
  PlanBudgetYear,
  PlanDisbursementRequestWithContext,
  PlanProjectWithActivities,
} from "@/lib/plan-types";
import { useProfile } from "@/lib/hooks";
import { formatBaht } from "@/lib/format";

const STATUS_LABEL = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ" } as const;
const STATUS_BADGE = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
} as const;

export default function DisbursementRequestsPage() {
  const profile = useProfile();
  const { message, show } = useToast();
  const [error, setError] = useState<string | null>(null);

  const [years, setYears] = useState<PlanBudgetYear[]>([]);
  const [yearId, setYearId] = useState<string | null>(null);
  const [groups, setGroups] = useState<PlanAdminGroup[]>([]);
  const [projects, setProjects] = useState<PlanProjectWithActivities[]>([]);
  const [requests, setRequests] = useState<PlanDisbursementRequestWithContext[]>([]);
  const [approvedTotals, setApprovedTotals] = useState<Map<string, number>>(new Map());
  const [requesters, setRequesters] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [projectId, setProjectId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    fetchPlanYears()
      .then((rows) => {
        setYears(rows);
        setYearId((rows.find((r) => r.is_open) ?? rows[0])?.id ?? null);
      })
      .catch((e) => setError(humanizeError(e)));
    fetchActivePlanRequesters()
      .then(setRequesters)
      .catch((e) => setError(humanizeError(e)));
  }, []);

  function reload(currentYearId: string) {
    setLoading(true);
    Promise.all([
      fetchPlanAdminGroups(),
      fetchPlanProjectsWithActivities(currentYearId),
      fetchDisbursementRequests({ budgetYearId: currentYearId }),
    ])
      .then(async ([g, p, r]) => {
        setGroups(g);
        setProjects(p);
        setRequests(r);
        const activityIds = p.flatMap((proj) => proj.activities.map((a) => a.id));
        setApprovedTotals(await fetchApprovedDisbursementTotals(activityIds));
      })
      .catch((e) => setError(humanizeError(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (yearId) reload(yearId);
  }, [yearId]);

  const selectedProject = projects.find((p) => p.id === projectId);
  const selectedActivity = selectedProject?.activities.find((a) => a.id === activityId);
  const remaining = selectedActivity
    ? selectedActivity.budget - (approvedTotals.get(selectedActivity.id) ?? 0)
    : null;

  async function handleSubmit() {
    if (!activityId || !amount || !requesterName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createDisbursementRequest(activityId, Number(amount), purpose.trim() || null, requesterName.trim());
      setRequesterName("");
      setAmount("");
      setPurpose("");
      if (yearId) reload(yearId);
      show("สร้างคำขอแล้ว — พิมพ์เอกสารเพื่อเซ็นชื่อและส่งต่อผู้อำนวยการอนุมัติได้จากรายการด้านล่าง");
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("ยกเลิกคำขอนี้?")) return;
    setBusyId(id);
    setError(null);
    try {
      await deleteDisbursementRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      show("ยกเลิกคำขอแล้ว");
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  const groupedProjects = useMemo(() => {
    const map = new Map<string, PlanProjectWithActivities[]>();
    for (const p of projects) map.set(p.admin_group_id, [...(map.get(p.admin_group_id) ?? []), p]);
    return map;
  }, [projects]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
      <Link href="/plan" className="text-sm text-sky-700">
        ‹ งานแผนงาน
      </Link>
      <h1 className="mt-1 font-display text-xl font-bold text-stone-900">คำขออนุมัติเบิกจ่ายงบประมาณ</h1>
      <p className="text-sm text-stone-600">
        ทุกคนกรอกเองได้ ไม่ต้องล็อกอิน — กรอกแล้วพิมพ์เอกสารให้เซ็นชื่อ ก่อนส่งต่อผู้อำนวยการอนุมัติ
      </p>

      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {years.length > 1 ? (
        <select
          value={yearId ?? ""}
          onChange={(e) => setYearId(e.target.value)}
          className={`${inputClass} mt-4 max-w-xs`}
        >
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>
      ) : null}

      <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
        <p className="font-display text-sm font-semibold text-stone-800">สร้างคำขอใหม่</p>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">โครงการ</span>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setActivityId("");
              }}
              className={inputClass}
            >
              <option value="">— เลือกโครงการ —</option>
              {groups.map((group) => {
                const groupProjects = groupedProjects.get(group.id) ?? [];
                if (groupProjects.length === 0) return null;
                return (
                  <optgroup key={group.id} label={group.name}>
                    {groupProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>

          {selectedProject ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-stone-700">กิจกรรม</span>
              <select value={activityId} onChange={(e) => setActivityId(e.target.value)} className={inputClass}>
                <option value="">— เลือกกิจกรรม —</option>
                {selectedProject.activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? "(ไม่มีกิจกรรมย่อย — งบอยู่ที่โครงการ)"} · งบ {formatBaht(a.budget)} บาท
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {selectedActivity ? (
            <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
              งบที่จัดสรร {formatBaht(selectedActivity.budget)} บาท · เบิกไปแล้ว{" "}
              {formatBaht(approvedTotals.get(selectedActivity.id) ?? 0)} บาท ·{" "}
              <span className="font-semibold text-stone-800">คงเหลือ {formatBaht(remaining ?? 0)} บาท</span>
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">ชื่อผู้ขออนุมัติ (ผู้รับผิดชอบโครงการ/กิจกรรม)</span>
            <select value={requesterName} onChange={(e) => setRequesterName(e.target.value)} className={inputClass}>
              <option value="">— เลือกชื่อผู้ขอ —</option>
              {requesters.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
            {requesters.length === 0 ? (
              <p className="mt-1 text-xs text-stone-500">ยังไม่มีรายชื่อให้เลือก — แอดมินเพิ่มได้ที่หน้าตั้งค่าระบบ</p>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">ยอดที่ขอเบิกครั้งนี้ (บาท)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">รายละเอียด/วัตถุประสงค์</span>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="เช่น จัดซื้อวัสดุสำหรับกิจกรรม..."
            />
          </label>

          <button
            type="button"
            disabled={!activityId || !amount || !requesterName.trim() || submitting}
            onClick={handleSubmit}
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-stone-300"
          >
            <ButtonLabel busy={submitting}>สร้างคำขอ</ButtonLabel>
          </button>
        </div>
      </div>

      <h2 className="mt-6 font-display text-sm font-semibold text-stone-800">คำขอทั้งหมด</h2>
      {loading ? (
        <p className="mt-2 text-sm text-stone-500">กำลังโหลด…</p>
      ) : requests.length === 0 ? (
        <p className="mt-2 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">ยังไม่มีคำขอ</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900">{r.project.name}</p>
                  <p className="text-xs text-stone-500">
                    {r.activity.name ?? "(งบอยู่ที่โครงการ)"} · {r.group.name}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">ผู้ขอ: {r.requester_name || "ไม่ระบุ"}</p>
                  {r.purpose ? <p className="mt-1 text-xs text-stone-600">{r.purpose}</p> : null}
                  {r.reject_reason ? <p className="mt-1 text-xs text-rose-700">เหตุผลไม่อนุมัติ: {r.reject_reason}</p> : null}
                </div>
                <div className="shrink-0 text-right">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                  <p className="mt-1 font-display text-sm font-bold text-stone-900">{formatBaht(r.requested_amount)} บาท</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Link href={`/plan/requests/${r.id}/print`} className="text-sky-700 underline">
                  พิมพ์เอกสาร
                </Link>
                {r.status === "pending" && isAdmin ? (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => handleCancel(r.id)}
                    className="text-stone-400 hover:text-rose-600 disabled:opacity-50"
                  >
                    <ButtonLabel busy={busyId === r.id}>ยกเลิกคำขอ</ButtonLabel>
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Toast message={message} />
    </main>
  );
}
