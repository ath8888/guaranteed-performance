import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { standardService, trainingService } from "@/lib/db";
import { STANDARD_META, type StandardType, type Standard } from "@/lib/types";
import { initTrainingMax, parseTime } from "@/lib/plan";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Set your standard" }] }),
  component: Setup,
});

const TYPES: StandardType[] = ["run3mi", "pushups", "bench", "ohp", "squat", "deadlift"];

interface Draft { type: StandardType; baseline: string; target: string; }

function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 12 * 7);
  return d.toISOString().slice(0, 10);
}

function Setup() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Record<StandardType, Draft | null>>(
    () => Object.fromEntries(TYPES.map(t => [t, null])) as Record<StandardType, Draft | null>
  );
  const [deadline, setDeadline] = useState(defaultDeadline());
  const [step, setStep] = useState<"pick" | "values">("pick");

  const selected = TYPES.filter(t => picked[t]);

  function toggle(t: StandardType) {
    setPicked(p => ({ ...p, [t]: p[t] ? null : { type: t, baseline: "", target: "" } }));
  }
  function setField(t: StandardType, k: "baseline" | "target", v: string) {
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
      const s: Standard = {
        id: crypto.randomUUID(),
        type: t,
        baseline,
        target,
        deadline: new Date(deadline).toISOString(),
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
    await qc.invalidateQueries();
    navigate({ to: "/" });
  }

  const canContinue = selected.length > 0;
  const canSave = selected.every(t => {
    const d = picked[t]!;
    return parseFor(t, d.baseline) > 0 && parseFor(t, d.target) > 0;
  });

  return (
    <div className="min-h-screen px-6 pb-32 pt-10">
      <button onClick={() => step === "values" ? setStep("pick") : history.back()} className="text-xs uppercase tracking-wider text-muted-foreground">
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
          <Field label="Deadline">
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full rounded-md border border-hairline bg-card px-4 py-3 text-base"
            />
          </Field>
          {selected.map(t => {
            const d = picked[t]!;
            const meta = STANDARD_META[t];
            const placeholder = meta.kind === "time" ? "mm:ss" : meta.unit;
            return (
              <div key={t} className="rounded-xl border border-hairline bg-card p-4">
                <p className="font-medium">{meta.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">Baseline = today. Target = required to pass.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <input
                    inputMode={meta.kind === "time" ? "text" : "numeric"}
                    placeholder={`Baseline (${placeholder})`}
                    value={d.baseline}
                    onChange={e => setField(t, "baseline", e.target.value)}
                    className="rounded-md border border-hairline bg-background px-3 py-3 text-base"
                  />
                  <input
                    inputMode={meta.kind === "time" ? "text" : "numeric"}
                    placeholder={`Target (${placeholder})`}
                    value={d.target}
                    onChange={e => setField(t, "target", e.target.value)}
                    className="rounded-md border border-hairline bg-background px-3 py-3 text-base"
                  />
                </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </label>
  );
}
