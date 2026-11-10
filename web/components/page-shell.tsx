import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeSwitch } from "./theme-switch";

// 灯台の光を表すマーク。アプリ全体の目印
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeOpacity="0.25" />
      <path d="M12 12 L23 7 A11 11 0 0 1 23 17 Z" fill="var(--light)" />
      <circle cx="12" cy="12" r="2.4" fill="var(--light)" />
    </svg>
  );
}

export function PageShell({
  title,
  lead,
  eyebrow,
  back = true,
  compact = false,
  children,
}: {
  // 渡さないときは、見出しを出さずに中身だけを置く（トップのように自分で大きな見出しを作る画面）
  title?: React.ReactNode;
  lead?: React.ReactNode;
  eyebrow?: string;
  back?: boolean;
  // スワイプのように、操作する部品を1画面に収めたい画面では、見出しまわりを詰める
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Apple のナビゲーションバーのように、すりガラスで上に貼りつく。スクロールすると影が出る（.hd） */}
      <header className="hd sticky top-0 z-40 border-b border-line bg-(--header-bg) backdrop-blur-(--header-blur) backdrop-saturate-150">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold">
          <Mark />
          バブル診断
        </Link>
        <div className="flex items-center gap-3">
          <ThemeSwitch />
          {back && (
            <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-[15px] text-accent transition hover:opacity-70">
              <ArrowLeft size={16} aria-hidden />
              トップ
            </Link>
          )}
        </div>
        </div>
      </header>
      <main className={`mx-auto w-full max-w-3xl flex-1 px-4 pb-20 sm:px-6 ${compact ? "pt-4 sm:pt-8" : "pt-10 sm:pt-16"}`}>
        {title !== undefined && (
          <>
        {eyebrow && <p className="text-[13px] font-semibold tracking-[0.08em] text-light-ink">{eyebrow}</p>}
        <h1 className={`mt-2 font-bold ${compact ? "text-[22px] leading-snug tracking-tight sm:text-3xl" : "text-[32px] leading-[1.25] tracking-tight sm:text-5xl sm:leading-[1.15]"}`}>{title}</h1>
        {lead && (
          <p className={`max-w-2xl text-muted ${compact ? "mt-2 text-sm leading-relaxed" : "mt-4 text-[17px] leading-[1.75]"}`}>{lead}</p>
        )}
          </>
        )}
        <div className={title === undefined ? "" : compact ? "mt-4" : "mt-10"}>{children}</div>
      </main>
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-(--r-card) bg-surface p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[22px] font-bold tracking-tight">{children}</h2>
      {note && <p className="mt-1 text-sm leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="btn inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-accent px-7 text-[17px] font-semibold text-accent-ink transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-35 sm:w-auto"
    />
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-surface-2 px-3 py-1.5 text-sm">{children}</span>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-(--r-inner) bg-danger-bg px-4 py-3 text-sm text-danger" role="alert">{children}</p>;
}
