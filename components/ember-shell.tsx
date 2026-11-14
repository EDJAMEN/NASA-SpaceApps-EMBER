"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  FileText,
  Flame,
  LayoutGrid,
  Moon,
  Radio,
  Settings2,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/use-theme";

export type EmberNavKey = "overview" | "detections" | "alerts" | "analytics" | "calendar" | "ingestion";

const NAV: Array<{ key: EmberNavKey; to: string; label: string; icon: typeof Flame }> = [
  { key: "overview", to: "/", label: "Overview", icon: LayoutGrid },
  { key: "detections", to: "/detections", label: "Detections", icon: Radio },
  { key: "alerts", to: "/alerts", label: "Alerts", icon: TriangleAlert },
  { key: "analytics", to: "/analytics", label: "Analytics", icon: FileText },
  { key: "calendar", to: "/calendar", label: "Burn calendar", icon: CalendarDays },
  { key: "ingestion", to: "/ingestion", label: "Ingestion", icon: Flame },
];

export interface EmberLiveStatus {
  mode: "sample" | "live";
  state: "idle" | "loading" | "synced" | "error";
  lastSync?: string;
  region?: string;
  errorMessage?: string;
}

export function EmberShell({
  active,
  title,
  liveStatus,
  children,
}: {
  active?: EmberNavKey;
  title: string;
  liveStatus?: EmberLiveStatus;
  children: ReactNode;
}) {
  const { dark, toggle } = useTheme();
  const pathname = usePathname();
  const isLive = liveStatus?.mode === "live";

  const pillLabel = !isLive
    ? "DEMO PREVIEW"
    : liveStatus.state === "loading"
      ? "SYNCING..."
      : liveStatus.state === "error"
        ? "FEED ERROR"
        : "LIVE FEED";

  const sidebarSubtitle = !isLive
    ? "Sample data preview"
    : liveStatus.state === "loading"
      ? "Syncing NASA FIRMS WFS..."
      : liveStatus.state === "error"
        ? liveStatus.errorMessage || "Connection error"
        : `${liveStatus.region === "Global" ? "Global" : "SE Asia"} · ${liveStatus.lastSync ?? "Just now"}`;

  const updatedLabel = isLive
    ? liveStatus.state === "loading"
      ? "Syncing..."
      : liveStatus.lastSync
        ? `Synced ${liveStatus.lastSync}`
        : "Live feed"
    : "";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/" aria-label="EMBER home">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Flame size={18} strokeWidth={2.4} />
                  </span>
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="font-semibold">EMBER.</span>
                    <span className="text-xs text-muted-foreground">Wildfire response</span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarMenu>
              {NAV.map((item) => {
                const isActive = active
                  ? item.key === active
                  : item.to === "/"
                    ? pathname === "/"
                    : pathname?.startsWith(item.to);
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.to} aria-current={isActive ? "page" : undefined}>
                        <item.icon size={17} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Monitoring</SidebarGroupLabel>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2 text-sm">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <div className="grid flex-1 leading-tight">
                <p className="text-xs font-medium">FIRMS connection</p>
                <span className="truncate text-xs text-muted-foreground">{sidebarSubtitle}</span>
              </div>
            </div>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <button type="button">
                  <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-[11px] font-bold text-white">
                    OC
                  </span>
                  <span className="grid flex-1 text-left leading-tight">
                    <b className="text-xs">Operations Center</b>
                    <small className="text-xs text-muted-foreground">Bukidnon region</small>
                  </span>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger aria-label="Toggle sidebar" />
          <Separator orientation="vertical" className="h-5" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Workspace</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1.5">
            <Badge variant={isLive ? "default" : "secondary"}>
              <span className="relative mr-1 flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-current" />
              </span>
              {pillLabel}
            </Badge>
            {updatedLabel && (
              <span className="hidden text-xs text-muted-foreground sm:inline">{updatedLabel}</span>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                    aria-pressed={dark}
                    onClick={toggle}
                  >
                    {dark ? <Sun size={17} /> : <Moon size={17} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{dark ? "Light mode" : "Dark mode"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Notifications">
                    <Bell size={17} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Settings">
                    <Settings2 size={17} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default EmberShell;
