import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { standardService, trainingService, sessionService } from "@/lib/db";
import { STANDARD_META } from "@/lib/types";
import { buildWeek, type Session } from "@/lib/plan";

export const Route = createFileRoute("/plan")({
  head: () => ({ meta: [{ title: "This week" }] }),
  component: Plan,
});

function Plan() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["plan"],
    queryFn: async () => {
      const standards = await standardService.list();
      return Promise.all(standards.map(async s => {
        const training = await trainingService.get(s.id);
        if (!training) return { s, training: null, sessions: [] as Session[], done: [] as boolean[] };
        const sessions = buildWeek(s, training);
        const done = await Promise.all(sessions.map((_, i) =>
          sessionService.isDone(s.id, training.cycle, training.week, i)
        ));
        return { s, training, sessions, done };
      }));
    },
  });

  async function toggle(standardId: string, cycle: number, week: number, idx: number) {
    await sessionService.toggle({ standardId, cycle, week, sessionIndex: idx });
    qc.invalidateQueries({ queryKey: ["plan"] });
    qc.invalidateQueries({ queryKey: ["home"] });
  }

  if (!data) return null;
  if (data.length === 0) {
    return <Empty />;
  }

  return (
    <div className="px-5">
      <header className="pb-4 pt-2">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">This week</p>
        <h1 className="display text-2xl">Plan</h1>
      </header>
      <div className="space-y-6">
        {data.map(({ s, training, sessions, done }) => {
          if (!training) return null;
          const meta = STANDARD_META[s.type];
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
                  <li key={i}>
                    <button
                      onClick={() => toggle(s.id, training.cycle, training.week, i)}
                      className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition ${done[i] ? "border-hairline bg-muted opacity-60" : "border-hairline bg-card"}`}
                    >
                      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${done[i] ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        {done[i] && <Check />}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${done[i] ? "line-through" : ""}`}>{sess.title}</p>
                        <ul className="mt-1 space-y-0.5">
                          {sess.lines.map((l, j) => (
                            <li key={j} className="num text-sm text-ink-soft">{l}</li>
                          ))}
                        </ul>
                        {sess.amrap && (
                          <p className="mt-2 text-[10px] uppercase tracking-wider text-primary">+ = max reps on last set</p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
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
