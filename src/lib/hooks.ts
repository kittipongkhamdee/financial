"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMasters, fetchProfile, fetchSchoolSettings } from "./data";
import type { Masters, RoomLocation, SchoolSettings, SurveyProfile } from "./types";

const ROOM_KEY = "asset-survey:last-room";
const RECENT_ROOMS_KEY = "asset-survey:recent-rooms";

/** อ่าน localStorage แบบปลอดภัย — คืน null ตอน SSR หรือเมื่อโหมดส่วนตัวปิดกั้น */
function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function useMasters() {
  const [masters, setMasters] = useState<Masters | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchMasters()
      .then((m) => {
        if (alive) setMasters(m);
      })
      .catch((e) => {
        if (alive) setError(e?.message ?? "โหลดข้อมูลตั้งต้นไม่สำเร็จ");
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { masters, error, refetch };
}

export function useProfile() {
  const [profile, setProfile] = useState<SurveyProfile | null>(null);

  useEffect(() => {
    let alive = true;
    fetchProfile().then((p) => {
      if (alive) setProfile(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  return profile;
}

/**
 * ชื่อโรงเรียน/ชื่อระบบ/โลโก้ — อ่านได้แม้ยังไม่ล็อกอิน (เช่นหน้า login)
 * ใช้ cache ระดับโมดูล + pub-sub เพราะหน้าเดียวกันอาจมีหลายจุดเรียก hook นี้พร้อมกัน
 * (sidebar + เนื้อหาในหน้า /admin) — refetch() จากจุดหนึ่งต้องอัปเดตทุกจุดที่แสดงอยู่ด้วย
 */
let schoolSettingsCache: SchoolSettings | null = null;
let schoolSettingsInflight: Promise<SchoolSettings> | null = null;
const schoolSettingsListeners = new Set<(s: SchoolSettings) => void>();

function loadSchoolSettings() {
  if (!schoolSettingsInflight) {
    schoolSettingsInflight = fetchSchoolSettings().then((s) => {
      schoolSettingsCache = s;
      schoolSettingsInflight = null;
      schoolSettingsListeners.forEach((listener) => listener(s));
      return s;
    });
  }
  return schoolSettingsInflight;
}

export function useSchoolSettings() {
  const [settings, setSettings] = useState<SchoolSettings | null>(schoolSettingsCache);

  useEffect(() => {
    let alive = true;
    const listener = (s: SchoolSettings) => {
      if (alive) setSettings(s);
    };
    schoolSettingsListeners.add(listener);

    if (schoolSettingsCache) {
      setSettings(schoolSettingsCache);
    } else {
      loadSchoolSettings().then((s) => {
        if (alive) setSettings(s);
      });
    }

    return () => {
      alive = false;
      schoolSettingsListeners.delete(listener);
    };
  }, []);

  const refetch = useCallback(() => {
    schoolSettingsInflight = null;
    loadSchoolSettings();
  }, []);

  return { settings, refetch };
}

/**
 * จำห้องล่าสุดที่กรอก — หัวใจของการกรอกเร็ว ครูไม่ต้องเลือกอาคาร/ชั้น/ห้องซ้ำทุกรายการ
 * เก็บใน localStorage เพราะต้องอยู่รอดข้ามการปิดแอปกลางห้องเรียน
 */
export function useLastRoom() {
  const [lastRoom, setLastRoom] = useState<RoomLocation | null>(() => readJson<RoomLocation>(ROOM_KEY));
  const [recentRooms, setRecentRooms] = useState<string[]>(
    () => readJson<string[]>(RECENT_ROOMS_KEY) ?? [],
  );

  const remember = useCallback((room: RoomLocation) => {
    setLastRoom(room);
    setRecentRooms((prev) => {
      const next = [room.room, ...prev.filter((r) => r !== room.room)].slice(0, 5);
      try {
        window.localStorage.setItem(ROOM_KEY, JSON.stringify(room));
        window.localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(next));
      } catch {
        // เขียนไม่ได้ก็ใช้ค่าในหน่วยความจำต่อไป ไม่ต้องพังหน้าจอ
      }
      return next;
    });
  }, []);

  return { lastRoom, recentRooms, remember };
}
