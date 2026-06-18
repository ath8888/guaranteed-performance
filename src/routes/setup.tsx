import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { standardService, trainingService, draftService } from "@/lib/db";
import { STANDARD_META, type StandardType, type Standard } from "@/lib/types";
import { initTrainingMax, parseTime, etaDate, fmtDate, wavesToTarget } from "@/lib/plan";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Set your standard" }] }),
  component: Setup,
});

const TYPES: StandardType[] = ["run3mi", "pushups", "bench", "ohp", "squat", "deadlift"];

interface Draft { type: StandardType; baseline: string; target: string; testDate: string; }
interface PersistedDraft {
  picked: Record<StandardType, Draft | null>;
  step: "pick" | "values";
}

// Parse a yyyy-mm-dd string (from <input type="date">) into a Date at local noon
// so timezone shifts can't roll it back a day.
function parseDate(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

function isDirectionValid(t: StandardType, baseline: number, target: number): boolean {
  return STANDARD_META[t].lower ? target < baseline : target > baseline;
}

function directionMessage(t: StandardType): string {
  const meta = STANDARD_META[t];
  if (meta.lower) return "Target must be faster than baseline.";
  if (meta.kind === "load") return "Target must be heavier than baseline.";
  return "Target must be more reps than baseline.";
}

function Setup() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Record<StandardType, Draft | null>>(
    () => Object.fromEntries(TYPES.map(t => [t, null])) as Record<StandardType, Draft | null>
  );
  const [step, setStep] = useState<"pick" | "values">("pick");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await draftService.get<PersistedDraft>();
      if (d) {
        // Backfill testDate if a legacy draft is missing it.
        const picked = Object.fromEntries(
          Object.entries(d.picked).map(([k, v]) => [k, v ? { ...v, testDate: v.testDate ?? "" } : null])
        ) as Record<StandardType, Draft | null>;
        setPicked(picked);
        setStep(d.step);
      }
      setHydrated(true);
    })();
  }, []);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      draftService.save<PersistedDraft>({ picked, step });
    }, 200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [picked, step, hydrated]);

  const selected = TYPES.filter(t => picked[t]);

  function toggle(t: StandardType) {
    setPicked(p => ({ ...p, [t]: p[t] ? null : { type: t, baseline: "", target: "", testDate: "" } }));
  }
  function setField(t: StandardType, k: "baseline" | "target" | "testDate", v: string) {
    setPicked(p => ({ ...p, [t]: p[t] ? { ...p[t]!, [k]: v } : null }));
  }

  function parseFor(t: StandardType, v: string): number {
    if (STANDARD_META[t].kind === "time") return parseTime(v);
    return Number(v) || 0;
  }

  async function save() {
    for (const t of selected) {
      const d = picked[t]!;
      const baseline = parseFor(t, d.baseline);
      const target = parseFor(t, d.target);
      if (!baseline || !target) continue;
      if (!isDirectionValid(t, baseline, target)) continue;
      const partial = { type: t, baseline, target } as Standard;
      const eta = etaDate(partial, baseline);
      const testDate = parseDate(d.testDate);
      const s: Standard = {
        id: crypto.randomUUID(),
        type: t,
        baseline,
        target,
        desiredCompletionDate: (testDate ?? eta ?? new Date()).toISOString(),
        estCompletionDate: eta ? eta.toISOString() : undefined,
        createdAt: new Date().toISOString(),
        status: "active",
      };
      await standardService.save(s);
      await trainingService.save({
        standardId: s.id,
        trainingMax: initTrainingMax(s),
        cycle: 1,
        week: 1,
      });
    }
    await draftService.clear();
    await qc.invalidateQueries();
    navigate({ to: "/" });
  }

  const canContinue = selected.length > 0;
  const canSave = selected.every(t => {
    const d = picked[t]!;
    const b = parseFor(t, d.baseline);
    const g = parseFor(t, d.target);
    return b > 0 && g > 0 && isDirectionValid(t, b, g);
  });

  return (
    <div className="min-h-screen px-6 pb-32 pt-10">
      <button onClick={() => step === "values" ? setStep("pick") : navigate({ to: "/" })} className="text-xs uppercase tracking-wider text-muted-foreground">
        ← Back
      </button>
      <h1 className="display mt-6 text-3xl leading-tight">
        {step === "pick" ? "Pick your standards." : "Where you are. Where you need to be."}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {step === "pick" ? "Choose what you must hit. You can add more later." : "Enter honest baselines. We'll calibrate the plan."}
      </p>

      {step === "pick" && (
        <div className="mt-8 space-y-2">
          {TYPES.map(t => {
            const on = !!picked[t];
            return (
              <button
                key={t}
                onClick={() => toggle(t)}
                className={`flex w-full items-center justify-between rounded-xl border px-5 py-4 text-left transition ${on ? "border-primary bg-accent" : "border-hairline bg-card"}`}
              >
                <div>
                  <p className="font-medium">{STANDARD_META[t].label}</p>
                  <p className="text-xs text-muted-foreground">{STANDARD_META[t].unit}</p>
                </div>
                <div className={`h-5 w-5 rounded-full border-2 ${on ? "border-primary bg-primary" : "border-border"}`} />
              </button>
            );
          })}
        </div>
      )}

      {step === "values" && (
        <div className="mt-8 space-y-5">
          {selected.map(t => {
            const d = picked[t]!;
            const meta = STANDARD_META[t];
            const placeholder = meta.kind === "time" ? "mm:ss" : meta.unit;
            const baselineN = parseFor(t, d.baseline);
            const targetN = parseFor(t, d.target);
            const bothEntered = baselineN > 0 && targetN > 0;
            const directionOk = bothEntered && isDirectionValid(t, baselineN, targetN);
            const ready = bothEntered && directionOk;
            const partial = ready ? ({ type: t, baseline: baselineN, target: targetN } as Standard) : null;
            const waves = partial ? wavesToTarget(partial, baselineN) : -1;
            const eta = partial ? etaDate(partial, baselineN) : null;
            const testDate = parseDate(d.testDate);
            return (
              <div key={t} className="rounded-xl border border-hairline bg-card p-4">
                <p className="font-medium">{meta.label}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Baseline</label>
                    <input
                      inputMode={meta.kind === "time" ? "text" : "numeric"}
                      placeholder={placeholder}
                      value={d.baseline}
                      onChange={e => setField(t, "baseline", e.target.value)}
                      className="mt-1 w-full rounded-md border border-hairline bg-background px-3 py-3 text-base"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</label>
                    <input
                      inputMode={meta.kind === "time" ? "text" : "numeric"}
                      placeholder={placeholder}
                      value={d.target}
                      onChange={e => setField(t, "target", e.target.value)}
                      className="mt-1 w-full rounded-md border border-hairline bg-background px-3 py-3 text-base"
                    />
                  </div>
                </div>

                {bothEntered && !directionOk && (
                  <p className="mt-2 text-xs text-destructive">{directionMessage(t)}</p>
                )}

                <div className="mt-3">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Desired completion date (optional)</label>
                  <input
                    type="date"
                    value={d.testDate}
                    onChange={e => setField(t, "testDate", e.target.value)}
                    className="mt-1 w-full rounded-md border border-hairline bg-background px-3 py-3 text-base"
                  />
                </div>

                {ready && (
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-hairline pt-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Desired Completion Date</p>
                      {testDate ? (
                        <p className="num mt-1 text-base font-semibold">{fmtDate(testDate)}</p>
                      ) : (
                        <p className="mt-1 text-xs text-ink-soft">Not set</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. Completion Date</p>
                      {waves === 0 || !eta ? (
                        <p className="num mt-1 text-sm font-semibold text-primary">Ready now</p>
                      ) : (
                        <>
                          <p className="num mt-1 text-base font-semibold">{fmtDate(eta)}</p>
                          <p className="num mt-1 text-[11px] text-ink-soft">
                            {waves} wave{waves === 1 ? "" : "s"} · ~{waves * 4} weeks
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[480px] border-t border-hairline bg-background px-6 py-4">
        {step === "pick" ? (
          <button
            disabled={!canContinue}
            onClick={() => setStep("values")}
            className="w-full rounded-md bg-primary py-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <button
            disabled={!canSave}
            onClick={save}
            className="w-full rounded-md bg-primary py-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Lock in standards
          </button>
        )}
      </div>
    </div>
  );
}

void Link;
