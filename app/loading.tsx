import { EmberShell } from "@/components/ember-shell";

// Shown instantly on sidebar navigation while the next page loads (the sidebar stays put, highlighted by URL).
export default function Loading() {
  return (
    <EmberShell title="Loading">
      <div role="status" aria-label="Loading page" className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-md bg-muted" />
      </div>
    </EmberShell>
  );
}
