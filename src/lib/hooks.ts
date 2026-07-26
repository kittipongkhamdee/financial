"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMasters, fetchProfile } from "./data";
import type { Masters, RoomLocation, SurveyProfile } from "./types";

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
