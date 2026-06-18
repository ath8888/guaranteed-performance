import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { standardService, checkinService } from "@/lib/db";
import { STANDARD_META, type Standard } from "@/lib/types";
import { fmtValue } from "@/lib/plan";

export const Route = createFileRoute("/guarantee")({
  head: () => ({ meta: [{ title: "Guarantee" }] }),
  component: GuaranteePage,
});

function GuaranteePage() {
  const { data: standards } = useQuery({ queryKey: ["standards"], queryFn: () => standardService.list() });
  if (!standards) return null;
  if (standards.length === 0) {
    return <div className="px-6 pt-24 text-center text-sm text-muted-foreground">No standard set yet.</div>;
  }
  return (
    <div className="px-5">
      <header className="pb-4 pt-2">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Our promise</p>
        <h1 className="display text-2xl">Guarantee</h1>
      </header>
      <div className="space-y-4">
        {standards.map(s => <Card key={s.id} s={s} />)}
      </div>
    </div>
  );
}

function Card({ s }: { s: Standard }) {
  const meta = STANDARD_META[s.type];
  const { data: latest } = useQuery({
    queryKey: ["latest", s.id],
    queryFn: () => checkinService.latest(s.id),
  });
  const current = latest?.value ?? s.baseline;
  const deadline = new Date(s.deadline);
  const past = Date.now() > deadline.getTime();
  const hit = meta.lower ? current <= s.target : current >= s.target;
  const eligible = past && !hit;

  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="rounded-xl border border-hairline bg-card p-5">
      <h2 className="display text-lg">{meta.label}</h2>
      <p className="num mt-1 text-xs text-muted-foreground">
        By {deadline.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Stat label="Baseline" value={fmtValue(s.type, s.baseline)} />
        <Stat label="Current" value={fmtValue(s.type, current)} accent />
        <Stat label="Target" value={fmtValue(s.type, s.target)} />
      </div>

      <p className="mt-6 text-sm leading-relaxed text-ink-soft">
        Follow the plan. Log every session. If you complete the program and don't hit{" "}
        <span className="text-foreground">{fmtValue(s.type, s.target)}</span> by the deadline,
        you get your money back. Plain and simple.
      </p>

      {submitted ? (
        <p className="mt-6 rounded-md border border-hairline bg-muted px-4 py-3 text-xs text-ink-soft">
          Refund noted. Payment processing isn't wired up in this build — that's a known next step.
        </p>
      ) : (
        <button
          disabled={!eligible}
          onClick={() => setSubmitted(true)}
          className="mt-6 w-full rounded-md border border-hairline py-3 text-xs font-medium uppercase tracking-wider text-ink-soft disabled:opacity-40"
        >
          {past ? (hit ? "Standard met" : "Request refund") : "Available after deadline"}
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num mt-1 text-base font-semibold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
