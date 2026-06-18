import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { resetAll } from "@/lib/db";

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

  async function doReset() {
    setWorking(true);
    await resetAll();
    await qc.invalidateQueries();
    setWorking(false);
    navigate({ to: "/" });
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
