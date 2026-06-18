import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { standardService, checkinService, trainingService, sessionService } from "@/lib/db";
import { STANDARD_META } from "@/lib/types";
import { buildWeek, fmtValue, fmtDate } from "@/lib/plan";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Guaranteed Standards" }] }),
  component: Home,
});

function Home() {
  const { data, isLoading } = useQuery({
    queryKey: ["home"],
    queryFn: async () => {
      const standards = await standardService.list();
      const enriched = await Promise.all(standards.map(async s => {
        const latest = await checkinService.latest(s.id);
        const training = await trainingService.get(s.id);
        const week = training ? buildWeek(s, training) : [];
        const doneCount = training
          ? (await Promise.all(week.map((_, i) =>
              sessionService.isDone(s.id, training.cycle, training.week, i)
            ))).filter(Boolean).length
          : 0;
        return { s, latest, training, week, doneCount };
      }));
      return enriched;
    },
  });

  if (isLoading) return <Shell />;

  if (!data || data.length === 0) {
    return (
      <div className="px-6 pt-20 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Guaranteed Standards</p>
        <h1 className="display mt-4 text-[44px] leading-[0.95]">Hit the standard.<br/>Nothing extra.</h1>
        <p className="mt-5 text-sm text-ink-soft">No standard set yet. Choose the test you need to pass.</p>
        <Link to="/setup" className="mt-10 inline-block w-full rounded-md bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground">
          Set your standard
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5">
      <header className="flex items-center justify-between pb-4 pt-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Standards</p>
          <h1 className="display text-2xl">Home</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/setup" className="text-xs font-medium text-primary">+ Add</Link>
          <Link to="/settings" aria-label="Settings" className="text-muted-foreground">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </Link>
        </div>
      </header>

      <div className="space-y-3">
        {data.map(({ s, latest, training, week, doneCount }) => {
          const meta = STANDARD_META[s.type];
          const current = latest?.value ?? s.baseline;
          const hit = meta.lower ? current <= s.target : current >= s.target;
          return (
            <Link key={s.id} to="/plan" className="block rounded-xl border border-hairline bg-card p-5 active:bg-muted">
              <div className="flex items-baseline justify-between">
                <h2 className="display text-lg">{meta.label}</h2>
                <span className="num text-xs text-muted-foreground">
                  {hit ? <span className="text-primary">Ready</span> : `Target ${fmtDate(new Date(s.deadline))}`}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-left">
                <Stat label="Baseline" value={fmtValue(s.type, s.baseline)} />
                <Stat label="Current" value={fmtValue(s.type, current)} accent />
                <Stat label="Target" value={fmtValue(s.type, s.target)} />
              </div>
              {training && week.length > 0 && (
                <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-xs">
                  <span className="text-muted-foreground">
                    Cycle {training.cycle} · Week {training.week}
                  </span>
                  <span className="num font-medium text-foreground">
                    {doneCount}/{week.length} sessions
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
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

function Shell() {
  return <div className="px-5 pt-10"><div className="h-32 animate-pulse rounded-xl bg-muted" /></div>;
}
