import type { DailyTrend } from './types'
import type { Verdict } from './scoring'

// ---------------------------------------------------------------------------
// Turns the numbers into the plain-English sentence that opens the verdict.
// Written for a farmer, not for a data scientist.
// ---------------------------------------------------------------------------

const RISK_PHRASE: Record<Verdict['level'], string> = {
  keep: 'low risk — this plan still fits the land',
  adapt: 'moderate risk — it still works, but it needs adjusting',
  shift: 'high risk — conditions are moving away from this plan',
}

/**
 * A single sentence that says what changed at this exact point and what it
 * means for the crop that is in the ground right now.
 */
export function verdictSentence(
  verdict: Verdict,
  trend: DailyTrend | undefined,
  cropName: string,
): string {
  if (!trend) {
    return `Your ${cropName} plan scores ${verdict.score} out of 100 — ${RISK_PHRASE[verdict.level]}.`
  }
  const tn = trend.thenNow
  const parts: string[] = []

  if (Math.abs(tn.rainPct) >= 5) {
    parts.push(
      `the last five years have been ${Math.abs(Math.round(tn.rainPct))}% ${
        tn.rainPct < 0 ? 'drier' : 'wetter'
      }`,
    )
  }
  if (Math.abs(tn.wetnessDelta) >= 0.015) {
    const pct = Math.round(Math.abs(tn.wetnessDelta) * 1000) / 10
    parts.push(`the soil holds ${pct}% ${tn.wetnessDelta < 0 ? 'less' : 'more'} moisture`)
  }
  if (Math.abs(tn.tmaxDelta) >= 0.3) {
    parts.push(
      `day highs are ${Math.abs(tn.tmaxDelta).toFixed(1)} °C ${tn.tmaxDelta > 0 ? 'hotter' : 'cooler'}`,
    )
  }
  if (Math.abs(tn.onsetShiftDays) >= 5) {
    parts.push(
      `the rains now start ${Math.abs(Math.round(tn.onsetShiftDays))} days ${
        tn.onsetShiftDays > 0 ? 'later' : 'earlier'
      }`,
    )
  }

  if (!parts.length) {
    return `Over the last ${tn.yearsSpan} years at this exact point nothing has moved much — your ${cropName} plan scores ${verdict.score} out of 100, ${RISK_PHRASE[verdict.level]}.`
  }
  const list =
    parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]
  return `Over ${tn.yearsSpan} years at this exact point, ${list} — putting your ${cropName} at ${RISK_PHRASE[verdict.level]}.`
}
