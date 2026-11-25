import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_8px_24px_-8px_var(--glow)] hover:brightness-110",
  secondary: "bg-fg text-bg hover:opacity-90",
  outline: "border border-border-strong bg-surface/60 text-fg hover:bg-surface-2",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/15",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-[15px] rounded-xl gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none select-none",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({ variant, size, className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...p} />;
}

export function LinkButton({ variant, size, className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...p} />;
}

export function Container({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...p} />;
}

export function Badge({ tone = "neutral", className, ...p }: ComponentProps<"span"> & { tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "cyan" }) {
  const tones = {
    neutral: "bg-surface-2 text-muted border-border",
    accent: "bg-accent/12 text-accent border-accent/25 dark:text-[#c4b5fd]",
    success: "bg-success/10 text-success border-success/25",
    warning: "bg-warning/10 text-warning border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    cyan: "bg-accent-3/10 text-accent-3 border-accent-3/25",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-5", tones[tone], className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-border bg-surface", className)} {...p} />;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[12px] font-semibold uppercase tracking-[0.14em] text-accent dark:text-[#a78bfa]", className)}>{children}</p>;
}

export function SectionHeading({ eyebrow, title, intro, className, align = "left" }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; className?: string; align?: "left" | "center" }) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-[2.1rem]">{title}</h2>
      {intro && <p className="mt-3 text-[15.5px] leading-relaxed text-muted text-pretty">{intro}</p>}
    </div>
  );
}

const fieldBase = "w-full rounded-xl border border-border bg-bg-2 px-3.5 text-[14px] text-fg placeholder:text-subtle transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-10", className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "py-2.5 leading-relaxed", className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cn(fieldBase, "h-10 pr-8", className)} {...p} />;
}
export function Label({ className, ...p }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-fg", className)} {...p} />;
}
export function Field({ label, htmlFor, help, children, error }: { label: string; htmlFor: string; help?: ReactNode; children: ReactNode; error?: string | null }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {help && !error && <p className="mt-1.5 text-[12.5px] text-subtle">{help}</p>}
      {error && <p className="mt-1.5 text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "success" | "danger" | "sandbox"; title?: string; children: ReactNode; className?: string }) {
  const tones = {
    info: "border-accent-2/30 bg-accent-2/5",
    warning: "border-warning/35 bg-warning/8",
    success: "border-success/30 bg-success/8",
    danger: "border-danger/35 bg-danger/8",
    sandbox: "border-accent-3/35 bg-accent-3/8",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed", tones[tone], className)}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="text-muted">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong px-6 py-14 text-center">
      {icon && <div className="mb-3 grid size-11 place-items-center rounded-xl bg-surface-2 text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, intro, children }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="glow pointer-events-none absolute inset-0" />
      <Container className="relative py-14 sm:py-20">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-[16.5px] leading-relaxed text-muted text-pretty">{intro}</p>}
        {children && <div className="mt-7">{children}</div>}
      </Container>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-subtle">{hint}</p>}
    </Card>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-border bg-surface", className)}>
      <table className="w-full text-left text-[13.5px] [&_td]:border-t [&_td]:border-border [&_td]:px-4 [&_td]:py-3 [&_th]:bg-surface-2/60 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-[12px] [&_th]:font-medium [&_th]:text-muted">{children}</table>
    </div>
  );
}
