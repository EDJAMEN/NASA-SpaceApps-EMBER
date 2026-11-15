import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Flame,
  MapPin,
  Radio,
  Satellite,
  ShieldCheck,
  Wind,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const capabilities = [
  {
    icon: Satellite,
    title: "Satellite detection",
    description: "Bring MODIS and VIIRS thermal alerts into one view, with confidence and acquisition context.",
  },
  {
    icon: MapPin,
    title: "Place-aware monitoring",
    description: "Focus on a selected region, community, or location and inspect nearby detections.",
  },
  {
    icon: ShieldCheck,
    title: "Response prioritization",
    description: "Surface fire proximity, confidence, and wind context to support local response decisions.",
  },
];

export function LandingPage() {
  return (
    <main className="ember-landing-page relative min-h-screen bg-background text-foreground">
      <div className="ember-landing-ambient" aria-hidden="true" />
      <div className="ember-landing-page-grid" aria-hidden="true" />
      <header className="ember-landing-header mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="EMBER home">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Flame size={19} />
          </span>
          <span className="font-bold tracking-tight">EMBER<span className="text-primary">.</span></span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#capabilities" className="transition-colors hover:text-foreground">Capabilities</a>
          <a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a>
        </nav>
        <Button asChild size="sm">
          <Link href="/dashboard">Open dashboard <ArrowRight size={15} /></Link>
        </Button>
      </header>

      <section className="ember-landing-hero relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-16 lg:grid-cols-[1fr_0.95fr] lg:gap-16">
        <div className="ember-landing-copy relative z-10 max-w-2xl">
          <Badge variant="secondary" className="mb-6 gap-2 rounded-full px-3 py-1.5 font-mono text-[10px] tracking-[0.14em]">
            <span className="size-1.5 rounded-full bg-primary" /> WILDFIRE EARLY RESPONSE
          </Badge>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            See the signal.<br />
            <span className="text-primary">Protect what matters.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            EMBER brings satellite fire detections, local context, and response tools together so teams can understand risk sooner.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard">Enter EMBER <ArrowUpRight size={16} /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/detections">Explore detections</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Location access is optional and requested only from the dashboard.</p>
        </div>

        <Card className="ember-landing-preview relative isolate overflow-hidden rounded-2xl border-border/80 bg-card shadow-xl">
          <CardContent className="p-0">
            <div className="relative aspect-[1.15] min-h-[280px] overflow-hidden bg-muted/35 p-5 sm:p-7">
              <div className="ember-landing-map-parallax absolute inset-0" aria-hidden="true">
                <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:34px_34px]" />
                <svg viewBox="0 0 680 500" className="absolute inset-0 size-full text-muted-foreground/30" fill="none">
                  <path d="M-20 90 110 30l105 44 90-20 76 74 92-11 117 69 110-15M-10 184l124-44 92 49 76-24 82 85 92-24 111 49 122-32M-20 300l135-50 91 34 92-56 79 78 113-15 112 56 100-30M-10 420l122-67 105 45 94-40 73 52 118-35 108 50 105-25" stroke="currentColor" strokeWidth="2" />
                  <path d="m90 0 30 95-25 95 55 93-34 90 48 140M260-10l-25 88 52 82-22 85 57 97-25 83 30 90M455-10l-44 101 40 76-24 85 62 74-32 90 34 91M610-10l-25 96 40 81-32 97 54 82-23 94" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m126 128 78-34 47 38-26 60-71 20-44-38 16-46Zm255 142 79-22 40 49-28 60-74 5-44-43 27-49Zm105-179 67-15 39 40-23 56-66 9-34-38 17-52Z" fill="var(--muted)" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] font-semibold tracking-[0.18em] text-muted-foreground">MAP PREVIEW</p>
                  <h2 className="mt-1 text-lg font-semibold">Regional fire picture</h2>
                </div>
                <Badge variant="outline" className="gap-1.5 bg-background/80 text-[10px]">
                  <Radio size={12} /> MODIS + VIIRS
                </Badge>
              </div>
              <div className="ember-landing-hotspot absolute left-[22%] top-[39%] grid size-9 place-items-center rounded-full border border-primary/50 bg-primary/15 text-primary shadow-[0_0_30px_color-mix(in_oklab,var(--primary)_35%,transparent)]">
                <Flame size={17} />
              </div>
              <div className="ember-landing-hotspot ember-landing-hotspot-delay absolute left-[57%] top-[58%] grid size-7 place-items-center rounded-full border border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Flame size={14} />
              </div>
              <div className="ember-landing-hotspot ember-landing-hotspot-delay-2 absolute right-[16%] top-[34%] grid size-6 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary">
                <Flame size={12} />
              </div>
              <div className="absolute inset-x-5 bottom-5 flex flex-wrap items-end justify-between gap-4 rounded-xl border bg-background/90 p-4 shadow-sm backdrop-blur sm:inset-x-7 sm:bottom-7">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><MapPin size={16} /></span>
                  <span><b className="block text-sm">Place-aware view</b><small className="text-xs text-muted-foreground">Focus on your monitored area</small></span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wind size={14} /> Wind context</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="capabilities" className="border-y bg-muted/25">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mb-8 max-w-xl">
            <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-primary">BUILT FOR FIELD TEAMS</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">From satellite signal to local context.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, description }, index) => (
              <Card key={title} className={`ember-landing-feature ember-landing-feature-${index + 1} bg-card/80 shadow-none`}>
                <CardContent className="p-5 sm:p-6">
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={19} /></span>
                  <p className="mt-5 font-mono text-[10px] text-muted-foreground">0{index + 1}</p>
                  <h3 className="mt-1 text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-14 sm:flex-row sm:items-center sm:px-8 sm:py-16">
        <div>
          <h2 className="text-xl font-semibold">Start with the map. Follow the evidence.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Open the dashboard to explore the regional map, inspect detections, and choose a location to monitor.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard">Open dashboard <ArrowRight size={15} /></Link>
        </Button>
      </section>

      <footer className="border-t px-5 py-5 text-center text-xs text-muted-foreground sm:px-8">
        EMBER · Emergency Monitoring &amp; Burn-zone Early Response
      </footer>
    </main>
  );
}
