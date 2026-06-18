import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { resetAll, standardService } from "@/lib/db";
import { STANDARD_META } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: Settings,
});

const VERSION = "0.1.0 (MVP)";

function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const { data: standards } = useQuery({
    queryKey: ["standards", "all"],
    queryFn: () => standardService.listAll(),
  });

  const active = (standards ?? []).filter(s => s.status !== "archived");

  async function doReset() {
    setWorking(true);
    await resetAll();
    await qc.invalidateQueries();
    setWorking(false);
    navigate({ to: "/" });
  }

  async function archive(id: string) {
    await standardService.archive(id);
    setArchivingId(null);
    await qc.invalidateQueries();
  }

  return (
    <div className="px-5">
      <header className="flex items-center justify-between pb-4 pt-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">App</p>
          <h1 className="display text-2xl">Settings</h1>
        </div>
        <Link to="/" className="text-xs font-medium text-muted-foreground">Done</Link>
      </header>

      <section className="rounded-xl border border-hairline bg-card">
        <Row label="Version" value={VERSION} />
        <Row label="Storage" value="On this device only" />
      </section>

      <section className="mt-6">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Standards</p>
        <div className="rounded-xl border border-hairline bg-card">
          {active.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-soft">No active standards.</p>
          ) : (
            active.map(s => {
              const meta = STANDARD_META[s.type];
              const isConfirming = archivingId === s.id;
              return (
                <div key={s.id} className="border-b border-hairline px-5 py-4 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{meta.label}</span>
                    {!isConfirming && (
                      <button
                        onClick={() => setArchivingId(s.id)}
                        className="text-xs font-medium uppercase tracking-wider text-ink-soft"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                  {isConfirming && (
                    <>
                      <p className="mt-2 text-xs text-ink-soft">
                        Archiving removes this standard from Home, Plan, Check-in, and Guarantee. Plan history is kept.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setArchivingId(null)}
                          className="rounded-md border border-hairline py-2.5 text-xs font-medium uppercase tracking-wider text-ink-soft"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => archive(s.id)}
                          className="rounded-md bg-foreground py-2.5 text-xs font-medium uppercase tracking-wider text-background"
                        >
                          Confirm archive
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-6">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Danger zone</p>
        <div className="rounded-xl border border-hairline bg-card p-5">
          <p className="font-medium">Reset all data</p>
          <p className="mt-1 text-sm text-ink-soft">
            Standards, check-ins, and plan history will be deleted from this device. This cannot be undone.
          </p>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="mt-4 w-full rounded-md border border-hairline py-3 text-xs font-medium uppercase tracking-wider text-ink-soft"
            >
              Reset all data
            </button>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="rounded-md border border-hairline py-3 text-xs font-medium uppercase tracking-wider text-ink-soft"
              >
                Cancel
              </button>
              <button
                disabled={working}
                onClick={doReset}
                className="rounded-md bg-destructive py-3 text-xs font-medium uppercase tracking-wider text-destructive-foreground disabled:opacity-40"
              >
                {working ? "Resetting…" : "Confirm reset"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline px-5 py-4 last:border-b-0">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="num text-sm font-medium">{value}</span>
    </div>
  );
}
