/**
 * Shared formatting & color helpers for DeltaOps.
 */

/**
 * 5-tier KPD color scale.
 *   0–0.5  → red     (плохо)
 *   0.5–1  → orange  (слабо)
 *   1–1.5  → yellow  (средне)
 *   1.5–2  → lime    (хорошо)
 *   2+     → green   (отлично)
 */
export function kpdColor(kpd) {
  if (kpd == null) return 'text-neutral-600'
  if (kpd >= 2)    return 'text-green-400'
  if (kpd >= 1.5)  return 'text-lime-400'
  if (kpd >= 1)    return 'text-yellow-400'
  if (kpd >= 0.5)  return 'text-orange-400'
  return 'text-red-400'
}
