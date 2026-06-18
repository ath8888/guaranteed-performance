import { WAVE, REP_SCHEME, roundLb, type PlannedSet, type Session } from "./shared";

export function liftWeek(week: 1 | 2 | 3 | 4, tm: number): Session[] {
  const pcts = WAVE[week];
  const reps = REP_SCHEME[week];
  const sets: PlannedSet[] = pcts.map((p, i) => {
    const last = i === pcts.length - 1 && week !== 4;
    return { weight: roundLb(tm * p), reps: reps[i], amrap: last };
  });
  const main: Session = {
    title: week === 4 ? "Main lift — Deload" : "Main lift",
    lines: sets.map(s => `${s.weight} lb × ${s.reps}${s.amrap ? "+" : ""}`),
    sets,
    amrap: week !== 4,
    kind: "main",
  };
  if (week === 4) return [main];
  const bbbWeight = roundLb(tm * 0.5);
  const bbbSets: PlannedSet[] = Array.from({ length: 5 }, () => ({ weight: bbbWeight, reps: 10 }));
  const bbb: Session = {
    title: "Boring But Big",
    lines: [`5 × 10 @ ${bbbWeight} lb`],
    sets: bbbSets,
    kind: "bbb",
  };
  return [main, bbb];
}
