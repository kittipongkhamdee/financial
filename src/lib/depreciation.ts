import type { CategoryRow } from "./types";

export type DepreciationResult = {
  cost: number;
  annualDepreciation: number;
  elapsedYears: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  fullyDepreciated: boolean;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * คำนวณค่าเสื่อมราคาแบบเส้นตรง ตามคู่มือทะเบียนคุมทรัพย์สินฯ ของ สพฐ.
 * ค่าเสื่อมราคาต่อปี = ราคาทุนของสินทรัพย์ (มูลค่ารวม) / อายุการใช้งานอย่างมีประสิทธิภาพ
 * เมื่อครบอายุการใช้งานแล้วแต่ยังใช้งานอยู่/ยังไม่จำหน่าย ให้คงมูลค่าสุทธิไว้ที่ 1 บาท (ไม่ใช่ 0)
 *
 * ต้องมีราคา ปีที่ได้มา และหมวดหมู่ที่กำหนดอายุการใช้งานไว้ครบ — ไม่งั้นคำนวณไม่ได้ คืน null
 */
export function calculateDepreciation(
  price: number | null,
  quantity: number,
  acquiredYear: number | null,
  category: Pick<CategoryRow, "useful_life_years" | "depreciation_rate_percent"> | null | undefined,
  asOfYearBE: number,
): DepreciationResult | null {
  const usefulLife = category?.useful_life_years;
  if (!price || price <= 0 || !acquiredYear || !usefulLife || usefulLife <= 0) return null;

  const cost = round2(price * quantity);
  const annualDepreciation = round2(cost / usefulLife);
  const elapsedYears = Math.min(Math.max(asOfYearBE - acquiredYear, 0), usefulLife);
  const fullyDepreciated = elapsedYears >= usefulLife;

  const accumulatedDepreciation = fullyDepreciated
    ? round2(cost - 1)
    : round2(annualDepreciation * elapsedYears);
  const netBookValue = fullyDepreciated ? 1 : round2(cost - accumulatedDepreciation);

  return { cost, annualDepreciation, elapsedYears, accumulatedDepreciation, netBookValue, fullyDepreciated };
}
