import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

type Epoch = {
  id: string;
  name: string;
  summary: string;
  milestone_count: number;
  capability_count: number;
};

type Props = {
  epochs: Epoch[];
};

export default function EpochRail({ epochs }: Props) {
  const [activeEpoch, setActiveEpoch] = useState<string>(epochs[0]?.id ?? "");

  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("[data-epoch-section]")];
    if (!sections.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);

        if (visible[0]?.target instanceof HTMLElement) {
          setActiveEpoch(visible[0].target.dataset.epochSection ?? "");
        }
      },
      {
        rootMargin: "-30% 0px -50% 0px",
        threshold: [0.2, 0.4, 0.6],
      }
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="section-shell sticky top-[4.75rem] z-30 mt-8">
      {/* Mobile: compact horizontal scroll */}
      <div className="surface-panel flex items-center gap-2.5 overflow-x-auto px-4 py-3 lg:hidden">
        <p className="shrink-0 text-[0.68rem] uppercase tracking-[0.24em] text-[var(--page-muted)]">
          Epoch
        </p>
        {epochs.map((epoch) => {
          const active = epoch.id === activeEpoch;
          return (
            <a
              key={epoch.id}
              href={`#epoch-${epoch.id}`}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition",
                active
                  ? "border-transparent bg-[var(--page-ink)] text-white"
                  : "border-[var(--page-line)] bg-white/60 text-[var(--page-ink)]"
              )}
            >
              {epoch.name}
            </a>
          );
        })}
      </div>

      {/* Desktop: full layout */}
      <div className="surface-panel hidden items-center justify-between gap-4 px-4 py-3 lg:flex">
        <div>
          <p className="section-kicker">Epoch Rail</p>
          <p className="mt-2 text-sm text-[var(--page-muted)]">
            5 个阶段，覆盖从研究预览到自主运行的完整演进。
          </p>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-x-auto pb-1">
          {epochs.map((epoch, index) => {
            const active = epoch.id === activeEpoch;
            return (
              <a
                key={epoch.id}
                href={`#epoch-${epoch.id}`}
                className={cn(
                  "min-w-[11rem] rounded-full border px-4 py-3 transition",
                  active
                    ? "border-transparent bg-[var(--page-ink)] text-white"
                    : "border-[var(--page-line)] bg-white/60 text-[var(--page-ink)] hover:bg-white/90"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.22em] opacity-70">
                    0{index + 1}
                  </span>
                  <span className="text-sm font-medium">{epoch.name}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs opacity-80">
                  <span>{epoch.milestone_count} milestones</span>
                  <span>{epoch.capability_count} tracks</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
