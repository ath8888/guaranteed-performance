import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { standardService, trainingService, sessionService, checkinService, advanceWave } from "@/lib/db";
import { STANDARD_META, type SetActual, type SessionLog, type Standard, type TrainingState } from "@/lib/types";
import { buildWeek, type PlannedSet, type Session } from "@/lib/plan/index";

export const Route = createFileRoute("/plan")({
  head: () => ({ meta: [{ title: "This week" }] }),
  component: Plan,
});

interface Row {
  s: Standard;
  training: TrainingState | null;
  sessions: Session[];
  logs: (SessionLog | undefined)[];
}

function Plan() {
  const qc = useQueryClient();
  const { data } = useQuery<Row[]>({
    queryKey: ["plan"],
    queryFn: async () => {
      const standards = await standardService.list();
      return Promise.all(standards.map(async s => {
        const training = await trainingService.get(s.id);
        if (!training) return { s, training: null, sessions: [], logs: [] };
        const latest = await checkinService.latest(s.id);
        const current = latest?.value ?? s.baseline;
        const sessions = buildWeek(s, training, current);
        const logs = await Promise.all(sessions.map((_, i) =>
          sessionService.find(s.id, training.cycle, training.week, i)
        ));
        return { s, training, sessions, logs };
      }));
    },
  });

  async function toggleNoEdits(standardId: string, cycle: number, week: number, idx: number) {
    await sessionService.toggle({ standardId, cycle, week, sessionIndex: idx });
    qc.invalidateQueries({ queryKey: ["plan"] });
    qc.invalidateQueries({ queryKey: ["home"] });
  }

  if (!data) return null;
  if (data.length === 0) return <Empty />;

  return (
    <div className="px-5">
      <header className="pb-4 pt-2">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">This week</p>
        <h1 className="display text-2xl">Plan</h1>
      </header>
      <div className="space-y-6">
        {data.map(({ s, training, sessions, logs }) => {
          if (!training) return null;
          const meta = STANDARD_META[s.type];
          const allDone = sessions.length > 0 && logs.every(Boolean);
          return (
            <section key={s.id}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="display text-lg">{meta.label}</h2>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Wk {training.week}{training.week === 4 ? " · Deload" : ""}
                </span>
              </div>
              <ol className="space-y-2">
                {sessions.map((sess, i) => (
                  <SessionCard
                    key={i}
                    standard={s}
                    cycle={training.cycle}
                    week={training.week}
                    sessionIndex={i}
                    session={sess}
                    log={logs[i]}
                    onToggleNoEdits={() => toggleNoEdits(s.id, training.cycle, training.week, i)}
                    onSaved={() => {
                      qc.invalidateQueries({ queryKey: ["plan"] });
                      qc.invalidateQueries({ queryKey: ["home"] });
                    }}
                  />
                ))}
              </ol>
              {training.week !== 4 && allDone && (
                <AdvanceButton onClick={async () => { await advanceWave(s); qc.invalidateQueries(); }}>
                  Advance to week {training.week + 1} →
                </AdvanceButton>
              )}
              {training.week === 4 && s.type !== "run3mi" && allDone && (
                <AdvanceButton onClick={async () => { await advanceWave(s); qc.invalidateQueries(); }}>
                  Complete wave → start cycle {training.cycle + 1}
                </AdvanceButton>
              )}
              {training.week === 4 && s.type === "run3mi" && (
                <p className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Log your 3-mile goal on Check-in to advance the wave.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AdvanceButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 w-full rounded-md border border-primary py-3 text-xs font-medium uppercase tracking-wider text-primary"
    >
      {children}
    </button>
  );
}

function SessionCard({
  standard, cycle, week, sessionIndex, session, log, onToggleNoEdits, onSaved,
}: {
  standard: Standard;
  cycle: number;
  week: number;
  sessionIndex: number;
  session: Session;
  log: SessionLog | undefined;
  onToggleNoEdits: () => void;
  onSaved: () => void;
}) {
  const done = !!log;
  const hasSets = !!session.sets && session.sets.length > 0;
  const hasWeight = session.sets?.some(p => p.weight !== undefined) ?? false;
  const initial: SetActual[] = (session.sets ?? []).map((p, i) => {
    const a = log?.sets?.[i];
    return {
      weight: a?.weight ?? p.weight,
      reps: a?.reps ?? p.reps,
    };
  });
  const [vals, setVals] = useState<SetActual[]>(initial);
  // Reset local state if the underlying log/session changes (e.g. wave advance)
  useEffect(() => { setVals(initial); /* eslint-disable-next-line */ }, [log?.id, session.title, session.sets?.length]);

  async function save() {
    const sets = vals.map((v, i) => {
      const planned = session.sets![i];
      return {
        weight: hasWeight ? (v.weight ?? planned.weight) : undefined,
        reps: v.reps ?? planned.reps,
      };
    });
    await sessionService.saveActuals(
      { standardId: standard.id, cycle, week, sessionIndex },
      sets
    );
    // Bodyweight-only test sessions (pushups, pull-ups Day B) write a Check-in
    // so "current" + ETA update immediately. Weighted test sessions (lifts'
    // Day A) never have kind:"test", so this never fires for them.
    if (session.kind === "test" && !hasWeight) {
      const reps = sets[0]?.reps;
      if (typeof reps === "number" && reps > 0) {
        await checkinService.add({
          id: crypto.randomUUID(),
          standardId: standard.id,
          value: reps,
          date: new Date().toISOString(),
        });
      }
    }
    onSaved();
  }

  async function clearComplete() {
    // Remove the log entirely (mark incomplete)
    await sessionService.toggle({ standardId: standard.id, cycle, week, sessionIndex });
    onSaved();
  }

  return (
    <li>
      <div className={`rounded-xl border p-4 ${done ? "border-hairline bg-muted" : "border-hairline bg-card"}`}>
        <div className="flex items-start gap-4">
          <button
            aria-label={done ? "Mark incomplete" : hasSets ? "Log sets to complete" : "Mark complete"}
            disabled={!done && hasSets}
            onClick={done ? clearComplete : onToggleNoEdits}
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"} ${!done && hasSets ? "cursor-not-allowed opacity-40" : ""}`}
          >
            {done && <Check />}
          </button>
          <div className="flex-1">
            <p className={`font-medium ${done ? "line-through opacity-60" : ""}`}>{session.title}</p>

            {hasSets ? (
              <div className="mt-2 space-y-1.5">
                {session.sets!.map((planned, i) => (
                  <SetRow
                    key={i}
                    planned={planned}
                    value={vals[i] ?? { weight: planned.weight, reps: planned.reps }}
                    isPushups={!hasWeight}
                    onChange={(next) => {
                      const copy = vals.slice();
                      copy[i] = next;
                      setVals(copy);
                    }}
                  />
                ))}
              </div>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {session.lines.map((l, j) => (
                  <li key={j} className="num text-sm text-ink-soft">{l}</li>
                ))}
              </ul>
            )}

            {session.amrap && (
              <p className="mt-2 text-[10px] uppercase tracking-wider text-primary">+ = max reps on last set</p>
            )}

            {hasSets && (
              <button
                onClick={save}
                className="mt-3 h-11 w-full rounded-md bg-primary text-xs font-medium uppercase tracking-wider text-primary-foreground"
              >
                {done ? "Update actuals" : "Save & complete"}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function SetRow({
  planned, value, isPushups, onChange,
}: {
  planned: PlannedSet;
  value: SetActual;
  isPushups: boolean;
  onChange: (v: SetActual) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {!isPushups && (
        <>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={value.weight ?? ""}
            onChange={(e) => onChange({ ...value, weight: e.target.value === "" ? undefined : Number(e.target.value) })}
            className="num h-11 w-20 rounded-md border border-hairline bg-background px-2 text-right"
            aria-label="Weight in pounds"
          />
          <span className="text-xs text-muted-foreground">lb ×</span>
        </>
      )}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value.reps ?? ""}
        onChange={(e) => onChange({ ...value, reps: e.target.value === "" ? undefined : Number(e.target.value) })}
        className={`num h-11 w-16 rounded-md border bg-background px-2 text-right ${planned.amrap ? "border-primary" : "border-hairline"}`}
        aria-label="Reps"
      />
      <span className="text-xs text-muted-foreground">
        reps {planned.amrap && <span className="text-primary">(AMRAP +)</span>}
      </span>
    </div>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6.5L4.5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Empty() {
  return (
    <div className="px-6 pt-24 text-center text-sm text-muted-foreground">
      No standard set yet.
    </div>
  );
}
