"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  FileCheck,
  Settings,
  SlidersHorizontal,
  Menu,
  Bell,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/applications", label: "Applications", icon: FileCheck },
  { href: "/onboarding", label: "Preferences", icon: SlidersHorizontal },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <span className="font-semibold text-foreground">Applaid</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              autonomous job applications
            </span>
          </Link>

          <div className="hidden flex-1 max-w-sm md:block">
            <Input
              type="search"
              placeholder="Search jobs..."
              className="h-8 bg-muted/50"
            />
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Profile menu">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/onboarding">Preferences</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "hidden border-r border-border bg-card transition-[width] duration-200 ease-in-out lg:block",
            sidebarOpen ? "w-56" : "w-16"
          )}
        >
          <div className="flex h-[calc(100vh-3.5rem)] flex-col">
            <nav className="flex-1 space-y-1 p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {sidebarOpen && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => setSidebarOpen((o) => !o)}
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {sidebarOpen ? (
                  <ChevronLeft className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </aside>

        {/* Mobile sheet */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/50 lg:hidden"
              aria-hidden
              onClick={() => setMobileOpen(false)}
            />
            <div
              className="fixed left-0 top-0 z-50 h-full w-72 max-w-[85vw] border-r border-border bg-card shadow-lg transition-transform duration-200 ease-out lg:hidden"
              role="dialog"
              aria-label="Navigation menu"
            >
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <span className="font-semibold">Menu</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="flex flex-col gap-1 p-3">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="container max-w-6xl py-6 px-4 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
