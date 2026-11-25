"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Bot, Code2, CreditCard, Download, FileText, Heart, History, KeyRound, LayoutDashboard, Library, LifeBuoy, Mail, Megaphone, Network,
  Package, Plug, Receipt, RotateCcw, ScrollText, Settings, ShoppingBag, Store, Tag, Ticket, Users, Workflow, Wrench, Cpu, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  BarChart3, Bot, Code2, CreditCard, Download, FileText, Heart, History, KeyRound, LayoutDashboard, Library, LifeBuoy, Mail, Megaphone, Network,
  Package, Plug, Receipt, RotateCcw, ScrollText, Settings, ShoppingBag, Store, Tag, Ticket, Users, Workflow, Wrench, Cpu, Activity,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: string | number;
}

export function SideNav({ groups, title }: { groups: { title?: string; items: NavItem[] }[]; title: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/dashboard" || href === "/admin" ? pathname === href : pathname.startsWith(href));
  return (
    <nav aria-label={title} className="lg:sticky lg:top-20">
      <div className="flex gap-1 overflow-x-auto pb-2 lg:block lg:space-y-5 lg:overflow-visible lg:pb-0">
        {groups.map((g, gi) => (
          <div key={gi} className="flex gap-1 lg:block lg:space-y-0.5">
            {g.title && <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle lg:block">{g.title}</p>}
            {g.items.map((it) => {
              const Icon = ICONS[it.icon];
              const active = isActive(it.href);
              return (
                <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={cn("flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13.5px] transition", active ? "bg-surface-2 font-medium text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg")}>
                  <Icon className={cn("size-4", active ? "text-accent-2" : "")} />
                  <span>{it.label}</span>
                  {it.badge != null && it.badge !== 0 && <span className="ml-auto rounded-full bg-accent/15 px-1.5 text-[11px] text-accent-2">{it.badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
