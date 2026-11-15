import type { Metadata } from "next";
import { LandingPage } from "./landing-client";

export const metadata: Metadata = {
  title: "EMBER | Wildfire Early Response",
  description: "Satellite fire detection and community-focused wildfire response for local teams.",
};

export default function Page() {
  return <LandingPage />;
}
