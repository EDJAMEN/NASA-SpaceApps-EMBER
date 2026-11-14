import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Minimal KPI card used across the sidebar pages. */
export function StatCard({ label, value, hint, tone }: { label: string; value: number | string; hint?: string; tone?: "alert" }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && (
        <CardContent>
          <p className={`text-xs ${tone === "alert" ? "font-medium text-destructive" : "text-muted-foreground"}`}>{hint}</p>
        </CardContent>
      )}
    </Card>
  );
}
