import type { Metadata } from "next";
import { EmberDashboard } from "../index-client";

export const metadata: Metadata = { title: "Overview | EMBER" };

export default function DashboardPage() {
  return <EmberDashboard />;
}
