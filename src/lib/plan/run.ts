import { fmtTime, type Session } from "./shared";

/**
 * Running pace targets — recalculated at the start of each wave.
 * If current pace already meets the standard, use fixed stretch targets off current pace.
 */
export function paceTargets(standardPaceSec: number, currentPaceSec: number) {
  if (currentPaceSec <= standardPaceSec) {
    return {
      easy: currentPaceSec + 50,
      tempo: currentPaceSec - 5,
      interval: currentPaceSec - 10,
    };
  }
  return {
    easy: currentPaceSec + 50,
    tempo: Math.round(currentPaceSec - (currentPaceSec - standardPaceSec) * 0.5),
    interval: standardPaceSec - 18,
  };
}

export function runWeek(week: 1 | 2 | 3 | 4, currentPaceSec: number, standardPaceSec: number): Session[] {
  const { easy, tempo, interval } = paceTargets(standardPaceSec, currentPaceSec);
  if (week === 4) {
    return [
      { title: "Easy run", lines: [`20 min @ ${fmtTime(easy)}/mi`] },
      {
        title: "Timed test — 3 miles",
        lines: ["All-out effort.", "Log the time on Check-in to advance the wave."],
        amrap: true,
      },
    ];
  }
  return [
    {
      title: "Intervals",
      lines: [
        `6 × 400m @ ${fmtTime(interval)}/mi pace`,
        "400m easy jog between reps",
      ],
    },
    {
      title: "Tempo",
      lines: [
        `15–20 min @ ${fmtTime(tempo)}/mi`,
        "+ 5 min warm-up & cool-down easy",
      ],
    },
    { title: "Easy run", lines: [`20–25 min @ ${fmtTime(easy)}/mi`] },
  ];
}
