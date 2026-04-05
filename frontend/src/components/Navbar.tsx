"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, BarChart2, TrendingUp, DollarSign, Menu, X, Zap } from "lucide-react";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Today's Games", icon: Activity },
  { href: "/teams", label: "Teams", icon: BarChart2 },
  { href: "/insights", label: "Betting Edge", icon: TrendingUp },
  { href: "/agents", label: "Agents", icon: Zap },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.05]"
      style={{ background: "rgba(4,6,16,0.85)", backdropFilter: "blur(20px)" }}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-lg bg-electric-400/20 group-hover:bg-electric-400/30 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-electric-400 font-bold text-lg">C</span>
              </div>
            </div>
            <div>
              <span className="font-display text-xl font-bold text-white tracking-wide">
                COURT<span className="text-electric-400">EDGE</span>
              </span>
              <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest -mt-0.5">
                NBA Analytics
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                    active
                      ? "text-electric-400 bg-electric-400/10 border border-electric-400/20"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  )}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right side: live indicator */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.03]">
              <span className="live-dot" />
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Live
              </span>
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.05] bg-court-900/95 backdrop-blur-xl">
          <nav className="max-w-[1400px] mx-auto px-4 py-3 flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                    active
                      ? "text-electric-400 bg-electric-400/10"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  )}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
