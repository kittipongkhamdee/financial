"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, ButtonLabel, Toast, inputClass, useToast } from "@/components/ui";
import {
  type AdminUserRow,
  type MasterTable,
  type SurveyRoundRow,
  closeRound,
  createMasterRow,
  createRound,
  fetchAdminUsers,
  fetchAllMasterRows,
  fetchAllRounds,
  humanizeError,
  openRound,
  updateMasterRow,
  updateUserRole,
} from "@/lib/data";
import { CURRENT_BE_YEAR } from "@/lib/constants";
import { useProfile } from "@/lib/hooks";
import type { AssetUserRole, CategoryRow, MasterRow } from "@/lib/types";

const ROLE_LABEL: Record<AssetUserRole, string> = {
  teacher: "ครู",
  supply: "เจ้าหน้าที่พัสดุ",
  admin: "แอดมิน",
};

const TABS = [
  { key: "rounds", label: "รอบสำรวจ" },
  { key: "asset_categories", label: "หมวดหมู่ครุภัณฑ์" },
  { key: "asset_buildings", label: "อาคาร" },
  { key: "asset_budget_sources", label: "แหล่งงบประมาณ" },
  { key: "asset_units", label: "หน่วยนับ" },
  { key: "users", label: "ผู้ใช้งาน" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminPage() {
  const profile = useProfile();
  const { message, show } = useToast();
  const [tab, setTab] = useState<TabKey>("rounds");
  const [error, setError] = useState<string | null>(null);

  const isAdmin = profile ? profile.role === "admin" : null;

  if (profile && !isAdmin) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Alert tone="error">หน้านี้สำหรับแอดมินเท่านั้น</Alert>
        <Link href="/" className="mt-3 inline-block text-sm text-sky-700">
          ‹ กลับหน้าแรก
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
      <Link href="/" className="text-sm text-sky-700">
        ‹ หน้าแรก
      </Link>
      <h1 className="mt-1 font-display text-xl font-bold text-stone-900">ตั้งค่าระบบ</h1>
      <p className="text-sm text-stone-600">รอบสำรวจ · ข้อมูลตั้งต้น · สิทธิ์ผู้ใช้งาน</p>

      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              "rounded-full border px-3.5 py-2 text-sm transition " +
              (tab === t.key
                ? "border-sky-700 bg-sky-700 font-medium text-white"
                : "border-stone-300 bg-white text-stone-700")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {isAdmin === true ? (
          tab === "rounds" ? (
            <RoundsPanel onError={setError} onDone={show} />
          ) : tab === "users" ? (
            <UsersPanel onError={setError} onDone={show} selfId={profile?.user_id ?? null} />
          ) : (
            <MasterPanel table={tab} onError={setError} onDone={show} />
          )
        ) : (
          <p className="text-sm text-stone-500">กำลังตรวจสอบสิทธิ์…</p>
        )}
      </div>

      <Toast message={message} />
    </main>
  );
}

/* ---------- รอบสำรวจ ---------- */

function RoundsPanel({ onError, onDone }: { onError: (e: string | null) => void; onDone: (m: string) => void }) {
  const [rounds, setRounds] = useState<SurveyRoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState(String(CURRENT_BE_YEAR + 1));
  const [name, setName] = useState("");

  function reload() {
    setLoading(true);
    fetchAllRounds()
      .then(setRounds)
      .catch((e) => onError(humanizeError(e)))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  async function handleCreate() {
    const y = Number(year);
    if (!y || !name.trim()) return;
    setBusy(true);
    onError(null);
    try {
      await createRound(y, name.trim(), true);
      setName("");
      reload();
      onDone("สร้างรอบสำรวจแล้ว");
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(round: SurveyRoundRow) {
    setBusy(true);
    onError(null);
    try {
      if (round.is_open) await closeRound(round.id);
      else await openRound(round.id);
      reload();
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="font-display text-sm font-semibold text-stone-800">เปิดรอบสำรวจใหม่</p>
        <p className="mt-1 text-xs text-stone-500">เปิดรอบใหม่จะปิดรอบที่เปิดค้างอยู่ให้อัตโนมัติ (เปิดพร้อมกันได้ทีละรอบ)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            inputMode="numeric"
            placeholder="ปี พ.ศ."
            className={`${inputClass} max-w-[7rem]`}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`สำรวจครุภัณฑ์ ปีการศึกษา ${year}`}
            className={`${inputClass} max-w-xs`}
          />
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={handleCreate}
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-stone-300"
          >
            <ButtonLabel busy={busy}>สร้างและเปิดรอบ</ButtonLabel>
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">กำลังโหลด…</p>
      ) : (
        <ul className="space-y-2">
          {rounds.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3"
            >
              <div>
                <p className="font-medium text-stone-900">{r.name}</p>
                <p className="text-xs text-stone-500">ปีการศึกษา {r.year}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    r.is_open ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {r.is_open ? "เปิดอยู่" : "ปิดแล้ว"}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(r)}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 disabled:opacity-50"
                >
                  <ButtonLabel busy={busy}>{r.is_open ? "ปิดรอบนี้" : "เปิดรอบนี้"}</ButtonLabel>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- master data (อาคาร / หมวดหมู่ / แหล่งงบ / หน่วยนับ) ---------- */

function MasterPanel({
  table,
  onError,
  onDone,
}: {
  table: MasterTable;
  onError: (e: string | null) => void;
  onDone: (m: string) => void;
}) {
  const [rows, setRows] = useState<(MasterRow | CategoryRow)[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  function refetch() {
    setLoading(true);
    fetchAllMasterRows(table)
      .then(setRows)
      .catch((e) => onError(humanizeError(e)))
      .finally(() => setLoading(false));
  }

  useEffect(refetch, [table]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusyId("new");
    onError(null);
    try {
      const nextSort = (Math.max(0, ...rows.map((r) => r.sort_order)) || 0) + 10;
      await createMasterRow(table, { name: newName.trim(), sort_order: nextSort });
      setNewName("");
      refetch();
      onDone("เพิ่มแล้ว");
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(id: string, name: string) {
    setBusyId(id);
    onError(null);
    try {
      await updateMasterRow(table, id, { name: name.trim() });
      onDone("บันทึกแล้ว");
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(row: MasterRow) {
    setBusyId(row.id);
    onError(null);
    try {
      await updateMasterRow(table, row.id, { is_active: !row.is_active });
      refetch();
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDepreciation(id: string, field: "useful_life_years" | "depreciation_rate_percent", value: string) {
    const n = value.trim() === "" ? null : Number(value);
    if (n !== null && !Number.isFinite(n)) return;
    setBusyId(id);
    onError(null);
    try {
      await updateMasterRow(table, id, { [field]: n });
      onDone("บันทึกแล้ว");
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-stone-500">กำลังโหลด…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl border border-stone-200 bg-white p-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="เพิ่มรายการใหม่"
          className={`${inputClass} max-w-xs`}
        />
        <button
          type="button"
          disabled={busyId === "new" || !newName.trim()}
          onClick={handleCreate}
          className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-stone-300"
        >
          <ButtonLabel busy={busyId === "new"}>เพิ่ม</ButtonLabel>
        </button>
      </div>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                defaultValue={row.name}
                disabled={busyId === row.id || !row.is_active}
                onBlur={(e) => e.target.value.trim() !== row.name && handleRename(row.id, e.target.value)}
                className={`${inputClass} flex-1 py-1.5 text-sm`}
              />
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => handleToggleActive(row)}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                  row.is_active
                    ? "border-stone-300 text-stone-600"
                    : "border-emerald-500 text-emerald-700"
                }`}
              >
                <ButtonLabel busy={busyId === row.id}>
                  {row.is_active ? "ปิดใช้งาน" : "เปิดใช้งานอีกครั้ง"}
                </ButtonLabel>
              </button>
            </div>

            {table === "asset_categories" ? (
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <label className="flex items-center gap-1.5 text-xs text-stone-600">
                  อายุใช้งาน (ปี)
                  <input
                    defaultValue={(row as CategoryRow).useful_life_years ?? ""}
                    disabled={busyId === row.id}
                    onBlur={(e) => handleDepreciation(row.id, "useful_life_years", e.target.value)}
                    inputMode="numeric"
                    className={`${inputClass} w-20 py-1`}
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-stone-600">
                  ค่าเสื่อม %/ปี
                  <input
                    defaultValue={(row as CategoryRow).depreciation_rate_percent ?? ""}
                    disabled={busyId === row.id}
                    onBlur={(e) => handleDepreciation(row.id, "depreciation_rate_percent", e.target.value)}
                    inputMode="decimal"
                    className={`${inputClass} w-24 py-1`}
                  />
                </label>
              </div>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? <p className="text-sm text-stone-500">ยังไม่มีรายการ</p> : null}
      </ul>
    </div>
  );
}

/* ---------- ผู้ใช้งาน ---------- */

function UsersPanel({
  onError,
  onDone,
  selfId,
}: {
  onError: (e: string | null) => void;
  onDone: (m: string) => void;
  selfId: string | null;
}) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showGuests, setShowGuests] = useState(false);

  useEffect(() => {
    fetchAdminUsers()
      .then(setUsers)
      .catch((e) => onError(humanizeError(e)))
      .finally(() => setLoading(false));
  }, [onError]);

  async function handleRoleChange(userId: string, role: AssetUserRole) {
    setBusyId(userId);
    onError(null);
    try {
      await updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, role } : u)));
      onDone("เปลี่ยนสิทธิ์แล้ว");
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  const visible = users.filter((u) => showGuests || !u.is_anonymous);
  const guestCount = users.filter((u) => u.is_anonymous).length;

  if (loading) return <p className="text-sm text-stone-500">กำลังโหลด…</p>;

  return (
    <div className="space-y-3">
      {guestCount > 0 ? (
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={showGuests} onChange={(e) => setShowGuests(e.target.checked)} />
          แสดงผู้ใช้งานทั่วไป (guest) ด้วย — {guestCount} คน
        </label>
      ) : null}

      <ul className="space-y-2">
        {visible.map((u) => (
          <li
            key={u.user_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-stone-900">
                {u.full_name} {u.is_anonymous ? <span className="text-xs text-stone-400">(guest)</span> : null}
              </p>
              <p className="truncate text-xs text-stone-500">
                {u.email ?? "ไม่มีอีเมล"} {u.department ? `· ${u.department}` : ""}
              </p>
            </div>
            <select
              value={u.role}
              disabled={busyId === u.user_id || u.user_id === selfId}
              onChange={(e) => handleRoleChange(u.user_id, e.target.value as AssetUserRole)}
              className={`${inputClass} max-w-[10rem] py-1.5 text-sm`}
              title={u.user_id === selfId ? "เปลี่ยนสิทธิ์ตัวเองไม่ได้" : undefined}
            >
              {(Object.keys(ROLE_LABEL) as AssetUserRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
