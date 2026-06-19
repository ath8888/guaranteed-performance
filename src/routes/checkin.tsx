import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { standardService, checkinService, trainingService, advanceWave } from "@/lib/db";
import { STANDARD_META } from "@/lib/types";
import { fmtValue, parseTime } from "@/lib/plan/index";

export const Route = createFileRoute("/checkin")({
  head: () => ({ meta: [{ title: "Check-in" }] }),
  component: Checkin,
});

function Checkin() {
  const qc = useQueryClient();
  const { data: standards } = useQuery({ queryKey: ["standards"], queryFn: () => standardService.list() });
  const { data: history } = useQuery({ queryKey: ["checkins"], queryFn: () => checkinService.list() });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);

  if (!standards) return null;
  if (standards.length === 0) {
    return <div className="px-6 pt-24 text-center text-sm text-muted-foreground">No standard set yet. Choose the test you need to pass.</div>;
  }

  const active = standards.find(s => s.id === activeId) ?? standards[0];
  const meta = STANDARD_META[active.type];

  async function submit() {
    const v = meta.kind === "time" ? parseTime(value) : Number(value);
    if (!v) return;
    await checkinService.add({
      id: crypto.randomUUID(),
      standardId: active.id,
      value: v,
      date: new Date().toISOString(),
    });
    let advanced = false;
    if (active.type === "run3mi") {
      const t = await trainingService.get(active.id);
      if (t && t.week === 4) {
        await advanceWave(active, v);
        advanced = true;
      }
    }
    setValue("");
    setConfirmation(advanced ? "Wave complete. New paces calculated." : "Logged.");
    qc.invalidateQueries();
    setTimeout(() => setConfirmation(null), 4000);
  }

  return (
    <div className="px-5">
      <header className="pb-4 pt-2">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Log a real attempt</p>
        <h1 className="display text-2xl">Check-in</h1>
      </header>

      {standards.length > 1 && (
        <div className="-mx-5 mb-4 overflow-x-auto px-5">
          <div className="flex gap-2">
            {standards.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${s.id === active.id ? "border-primary bg-primary text-primary-foreground" : "border-hairline bg-card text-foreground"}`}
              >
                {STANDARD_META[s.type].short}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-hairline bg-card p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{meta.label}</p>
        <p className="num mt-1 text-sm text-ink-soft">Target {fmtValue(active.type, active.target)}</p>
        <div className="mt-4 flex gap-2">
          <input
            inputMode={meta.kind === "time" ? "text" : "numeric"}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={meta.kind === "time" ? "mm:ss" : meta.unit}
            className="num flex-1 rounded-md border border-hairline bg-background px-4 py-3 text-lg"
          />
          <button onClick={submit} className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
            Log
          </button>
        </div>
        {confirmation && (
          <p className="mt-3 text-xs uppercase tracking-wider text-primary">{confirmation}</p>
        )}
      </div>

      <h2 className="display mt-8 mb-2 text-base">History</h2>
      <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-card">
        {(history ?? [])
          .filter(c => c.standardId === active.id)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 12)
          .map(c => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-muted-foreground">{new Date(c.date).toLocaleDateString()}</span>
              <span className="num text-base font-semibold">{fmtValue(active.type, c.value)}</span>
            </li>
          ))}
        {(history ?? []).filter(c => c.standardId === active.id).length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">No check-ins yet. Log your first attempt to see where you stand.</li>
        )}
      </ul>
    </div>
  );
}
