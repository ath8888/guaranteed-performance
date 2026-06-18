import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, useRouterState,
  HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter-tight/700.css";
import "@fontsource/inter-tight/800.css";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">404</p>
        <h1 className="display mt-2 text-4xl">Not found</h1>
        <Link to="/" className="mt-6 inline-block text-sm underline">Back to home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "root" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="display text-2xl">Something broke</h1>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#ffffff" },
      { title: "Guaranteed Standards" },
      { name: "description", content: "Hit the standard. Nothing extra." },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Standards" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell><Outlet /></AppShell>
    </QueryClientProvider>
  );
}

const NAV: { to: "/" | "/plan" | "/checkin" | "/guarantee"; label: string }[] = [
  { to: "/", label: "Home" },
  { to: "/plan", label: "Plan" },
  { to: "/checkin", label: "Check-in" },
  { to: "/guarantee", label: "Guarantee" },
];

function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const isSetup = pathname.startsWith("/setup");
  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col">
      <main className={`flex-1 pb-28 ${isSetup ? "" : "pt-4"}`}>{children}</main>
      {!isSetup && (
        <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] border-t border-hairline bg-background/95 backdrop-blur">
          <ul className="grid grid-cols-4">
            {NAV.map(item => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`flex flex-col items-center justify-center gap-1 px-2 py-3 text-[11px] font-medium uppercase tracking-wider ${active ? "text-primary" : "text-muted-foreground"}`}
                  >
                    <span className={`h-1 w-1 rounded-full ${active ? "bg-primary" : "bg-transparent"}`} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div style={{ height: "env(safe-area-inset-bottom)" }} />
        </nav>
      )}
    </div>
  );
}
