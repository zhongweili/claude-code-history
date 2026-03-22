import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { HOT_SIGNAL_THRESHOLD, type ExploreData, type ExploreRelease } from "../../lib/data/schema";
import {
  DEFAULT_QUERY_STATE,
  countActiveFilters,
  parseSearchParams,
  serializeQueryState,
  type QueryState,
} from "../../lib/query-state";
import { cn } from "../../lib/utils";
import { useLanguage } from "../../lib/i18n";
import type { MessageKey } from "../../lib/i18n";

const PAGE_SIZE = 24;

type Props = {
  data: ExploreData;
};

type SegmentedOption = {
  label: string;
  value: string;
};

const epochColors: Record<string, string> = {
  epoch1: "border-l-genesis",
  epoch2: "border-l-toolification",
  epoch3: "border-l-ecosystem",
  epoch4: "border-l-platformization",
  epoch5: "border-l-autonomization",
};

const epochTextColors: Record<string, string> = {
  epoch1: "text-genesis",
  epoch2: "text-toolification",
  epoch3: "text-ecosystem",
  epoch4: "text-platformization",
  epoch5: "text-autonomization",
};

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SegmentedOption[];
  onChange: (nextValue: string) => void;
}) {
  return (
    <div className="space-y-2">
      {label ? (
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary">
          {label}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value || `${label}-all`}
              type="button"
              onClick={() => onChange(active ? "" : option.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-label transition",
                active
                  ? "bg-primary text-white"
                  : "bg-surface-container-highest text-primary hover:bg-outline-variant/30"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuerySummary({
  count,
  total,
  queryState,
  capabilityName,
  t,
}: {
  count: number;
  total: number;
  queryState: QueryState;
  capabilityName?: string;
  t: (key: MessageKey) => string;
}) {
  const parts = [];

  if (queryState.q) {
    parts.push(`${t("explore.search")} "${queryState.q}"`);
  }
  if (queryState.epoch) {
    parts.push(queryState.epoch.replace("epoch", t("explore.epoch_prefix")));
  }
  if (capabilityName) {
    parts.push(capabilityName);
  }
  if (queryState.category) {
    parts.push(queryState.category);
  }
  if (queryState.importance) {
    parts.push(`${t("explore.importance_suffix")} ${queryState.importance}+`);
  }
  if (queryState.source) {
    parts.push(queryState.source);
  }
  if (queryState.signal !== "all") {
    parts.push(queryState.signal === "with-signal" ? t("explore.signal.with") : t("explore.signal.hot"));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="kicker text-secondary">{t("explore.result_kicker")}</p>
        <h2 className="mt-3 text-3xl font-bold font-headline tracking-tighter sm:text-4xl">
          {count} / {total} {t("explore.results_unit")}
        </h2>
        <p className="mt-3 text-sm leading-7 text-secondary">
          {parts.length
            ? `${t("explore.filter_summary")}${parts.join(" · ")}`
            : t("explore.filter_none")}
        </p>
      </div>

      <div className="bg-surface-container-low px-4 py-3 rounded-lg text-sm text-secondary">
        {countActiveFilters(queryState)} {t("explore.active_filters")}
      </div>
    </div>
  );
}

function DetailPanel({
  release,
  onClose,
  t,
  localized,
}: {
  release: ExploreRelease | null;
  onClose?: () => void;
  t: (key: MessageKey) => string;
  localized: <T>(cn: T, en: T | undefined | null) => T;
}) {
  if (!release) {
    return (
      <div className="bg-surface-container-low rounded-2xl p-10 border border-outline-variant/10">
        <p className="kicker text-secondary">{t("detail.kicker")}</p>
        <h3 className="mt-3 text-2xl font-bold font-headline tracking-tighter">
          {t("detail.select_title")}
        </h3>
        <p className="mt-4 text-sm leading-7 text-secondary">
          {t("detail.select_desc")}
        </p>
      </div>
    );
  }

  const rel = release as any;

  return (
    <div className="bg-surface-container-low rounded-2xl p-10 border border-outline-variant/10 custom-scrollbar">
      <div className="mb-10 flex justify-between items-end border-b border-outline-variant/30 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-xs bg-primary text-on-primary px-3 py-1 rounded-full tracking-wider">
              v{release.version}
            </span>
            <span className={cn(
              "font-label text-xs uppercase tracking-[0.2em] font-bold",
              epochTextColors[release.epoch_id] || ""
            )}>
              {localized(release.epoch_name, rel.epoch_name_en)}
            </span>
          </div>
          <h2 className="text-3xl font-black font-headline tracking-tighter leading-tight max-w-lg">
            {localized(release.headline, rel.headline_en)}
          </h2>
        </div>
        <div className="text-right shrink-0 ml-4">
          <div className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary mb-1">Date</div>
          <div className="font-mono text-lg font-medium">{localized(release.display_date, rel.display_date_en)}</div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="mt-2 text-xs text-secondary hover:text-primary transition-colors"
            >
              {t("detail.close")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-12">
        {release.capabilities.length ? (
          <div className="flex flex-wrap gap-2">
            {release.capabilities.map((capability) => (
              <span
                key={capability.id}
                className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-label"
              >
                {localized(capability.name, (capability as any).name_en)}
              </span>
            ))}
            <span className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-label">
              {release.source}
            </span>
            {release.hot_signal ? (
              <span className="px-2 py-0.5 rounded bg-error/10 text-error text-[10px] font-label font-bold">
                HOT SIGNAL
              </span>
            ) : null}
          </div>
        ) : null}

        <section>
          <h4 className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary mb-8">
            {t("detail.changes_heading")}
          </h4>
          <div className="space-y-10">
            {release.changes.map((change, index) => {
              const ch = change as any;
              return (
                <div key={`${release.version}-${index}-${change.raw}`} className="group">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-2 py-0.5 bg-secondary/10 text-secondary text-[10px] font-bold rounded">
                      {change.category.toUpperCase()}
                    </span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: change.importance }, (_, i) => (
                        <span
                          key={i}
                          className="material-symbols-outlined text-xs text-secondary"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          star
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm font-bold font-headline mb-2">
                    {localized(change.summary, ch.summary_en) || change.raw}
                  </p>
                  {change.summary && change.summary !== change.raw ? (
                    <p className="text-secondary font-body text-sm mb-2">{change.raw}</p>
                  ) : null}
                  {(change.why_matters || ch.why_matters_en) ? (
                    <p className="text-secondary font-body text-sm">
                      {localized(change.why_matters, ch.why_matters_en)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {release.signals.length ? (
          <section className="bg-surface-container p-6 rounded-xl">
            <h4 className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              Hacker News Signals
            </h4>
            <div className="space-y-4">
              {release.signals.map((signal) => (
                <a
                  key={signal.objectID || signal.url}
                  href={signal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-4 group block"
                >
                  <div className="flex flex-col items-center">
                    <span className="material-symbols-outlined text-secondary text-sm">arrow_drop_up</span>
                    <span className="font-mono text-xs font-bold">{signal.points}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-body group-hover:text-secondary transition-colors">{signal.title}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default function ExploreApp({ data }: Props) {
  const { lang, t, localized } = useLanguage();
  const [queryState, setQueryState] = useState<QueryState>(() =>
    typeof window === "undefined"
      ? DEFAULT_QUERY_STATE
      : parseSearchParams(window.location.search)
  );
  const [searchInput, setSearchInput] = useState(queryState.q);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const deferredSearch = useDeferredValue(searchInput.trim());

  useEffect(() => {
    if (deferredSearch === queryState.q) {
      return;
    }
    startTransition(() => {
      setQueryState((current) => ({
        ...current,
        q: deferredSearch,
      }));
    });
  }, [deferredSearch, queryState.q]);

  useEffect(() => {
    const handlePopState = () => {
      const next = parseSearchParams(window.location.search);
      setSearchInput(next.q);
      startTransition(() => {
        setQueryState(next);
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const nextSearch = serializeQueryState(queryState);
    const nextUrl = nextSearch
      ? `${window.location.pathname}?${nextSearch}`
      : window.location.pathname;
    window.history.replaceState({}, "", nextUrl);
  }, [queryState]);

  const filteredReleases = useMemo(() => {
    const query = queryState.q.toLowerCase();

    return data.releases.filter((release) => {
      if (query && !release.search_text.includes(query)) {
        return false;
      }
      if (queryState.epoch && release.epoch_id !== queryState.epoch) {
        return false;
      }
      if (
        queryState.capability &&
        !release.capability_ids.includes(queryState.capability)
      ) {
        return false;
      }
      if (
        queryState.category &&
        !release.categories.includes(queryState.category)
      ) {
        return false;
      }
      if (
        queryState.importance &&
        release.max_importance < Number(queryState.importance)
      ) {
        return false;
      }
      if (queryState.source && release.source !== queryState.source) {
        return false;
      }
      if (queryState.signal === "with-signal" && release.signal_count === 0) {
        return false;
      }
      if (queryState.signal === "hot-only" && !release.hot_signal) {
        return false;
      }
      return true;
    });
  }, [data.releases, queryState]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    queryState.q,
    queryState.epoch,
    queryState.capability,
    queryState.category,
    queryState.importance,
    queryState.source,
    queryState.signal,
  ]);

  useEffect(() => {
    if (!queryState.release) {
      return;
    }
    if (filteredReleases.some((release) => release.version === queryState.release)) {
      return;
    }
    startTransition(() => {
      setQueryState((current) => ({
        ...current,
        release: "",
      }));
    });
  }, [filteredReleases, queryState.release]);

  const selectedRelease =
    filteredReleases.find((release) => release.version === queryState.release) ?? null;

  const capabilityName = (() => {
    const cap = data.filters.capabilities.find(
      (capability) => capability.id === queryState.capability
    );
    if (!cap) return undefined;
    return localized(cap.name, (cap as any).name_en);
  })();

  const visibleReleases = filteredReleases.slice(0, visibleCount);

  const updateState = (updater: (current: QueryState) => QueryState) => {
    startTransition(() => {
      setQueryState((current) => updater(current));
    });
  };

  const clearAll = () => {
    setSearchInput("");
    startTransition(() => {
      setQueryState(DEFAULT_QUERY_STATE);
    });
  };

  return (
    <div className="space-y-12">
      {/* Filter Panel */}
      <section className="bg-surface-container-low rounded-xl p-8 space-y-8">
        <QuerySummary
          count={filteredReleases.length}
          total={data.meta.total_versions}
          queryState={queryState}
          capabilityName={capabilityName}
          t={t}
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-4 border-t border-outline-variant/20">
          <div className="md:col-span-2">
            <label className="block font-label text-[10px] uppercase tracking-[0.2em] mb-3 text-secondary">
              {t("filter.search_label")}
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("filter.search_placeholder")}
                className="w-full bg-surface-container-lowest border-none rounded-lg py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary text-sm font-body"
              />
            </div>
          </div>

          <FilterGroup
            label={t("filter.epoch_label")}
            value={queryState.epoch}
            options={data.filters.epochs.map((epoch) => ({
              label: localized(epoch.name, (epoch as any).name_en),
              value: epoch.id,
            }))}
            onChange={(epoch) =>
              updateState((current) => ({
                ...current,
                epoch: epoch as QueryState["epoch"],
                release: "",
              }))
            }
          />

          <FilterGroup
            label={t("filter.importance_label")}
            value={queryState.importance}
            options={data.filters.importance_values.map((importance) => ({
              label: `${importance}+`,
              value: importance,
            }))}
            onChange={(importance) =>
              updateState((current) => ({
                ...current,
                importance: importance as QueryState["importance"],
                release: "",
              }))
            }
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center pt-4 border-t border-outline-variant/20">
          <span className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary mr-4">
            {t("filter.capabilities_label")}
          </span>
          {data.filters.capabilities.map((capability) => {
            const active = queryState.capability === capability.id;
            return (
              <button
                key={capability.id}
                type="button"
                onClick={() =>
                  updateState((current) => ({
                    ...current,
                    capability: active ? "" : capability.id,
                    release: "",
                  }))
                }
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-label transition",
                  active
                    ? "bg-primary text-white"
                    : "bg-surface-container-highest text-primary hover:bg-outline-variant/30"
                )}
              >
                {localized(capability.name, (capability as any).name_en)}
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-4">
            <FilterGroup
              label=""
              value={queryState.signal}
              options={[
                { label: t("filter.signal_all"), value: "all" },
                { label: t("filter.signal_with"), value: "with-signal" },
                { label: `${t("filter.signal_hot_prefix")} ${HOT_SIGNAL_THRESHOLD}`, value: "hot-only" },
              ]}
              onChange={(signal) =>
                updateState((current) => ({
                  ...current,
                  signal: (signal || "all") as QueryState["signal"],
                  release: "",
                }))
              }
            />
            <button
              type="button"
              onClick={clearAll}
              className="px-4 py-1.5 rounded-full text-xs font-label bg-surface-container-highest text-secondary hover:text-primary transition-colors"
            >
              {t("filter.clear")}
            </button>
          </div>
        </div>
      </section>

      {/* Mobile Detail Panel */}
      <div className="lg:hidden">
        {selectedRelease ? (
          <DetailPanel
            release={selectedRelease}
            t={t}
            localized={localized}
            onClose={() =>
              updateState((current) => ({
                ...current,
                release: "",
              }))
            }
          />
        ) : null}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left: Release Card List */}
        <div className="lg:col-span-5 space-y-6">
          {visibleReleases.map((release) => {
            const selected = queryState.release === release.version;
            const rel = release as any;
            return (
              <button
                key={release.version}
                type="button"
                onClick={() =>
                  updateState((current) => ({
                    ...current,
                    release: release.version,
                  }))
                }
                className={cn(
                  "group relative w-full text-left p-6 rounded-xl border-l-4 cursor-pointer transition-all duration-300",
                  epochColors[release.epoch_id] || "border-l-primary",
                  selected
                    ? "bg-surface-container-lowest shadow-[0_20px_40px_rgba(31,38,46,0.02)] -translate-y-1"
                    : "bg-surface-container-low opacity-80 hover:opacity-100"
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] text-secondary bg-secondary/10 px-2 py-0.5 rounded">
                      v{release.version}
                    </span>
                    <div className={cn(
                      "font-label text-[10px] uppercase tracking-[0.2em]",
                      epochTextColors[release.epoch_id] || ""
                    )}>
                      {localized(release.epoch_name, rel.epoch_name_en)}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-outline">
                    {localized(release.display_date, rel.display_date_en)}
                  </span>
                </div>

                <h3 className="text-lg font-bold font-headline mb-3 leading-snug">
                  {localized(release.headline, rel.headline_en)}
                </h3>

                <div className="flex flex-wrap gap-2 mb-4">
                  {release.capabilities.slice(0, 3).map((capability) => (
                    <span
                      key={capability.id}
                      className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-label"
                    >
                      {localized(capability.name, (capability as any).name_en)}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[10px] font-label text-outline">
                    <span>{release.change_count} changes</span>
                    {release.hot_signal ? (
                      <span className="flex items-center gap-1 text-error font-bold uppercase tracking-wider">
                        <span
                          className="material-symbols-outlined text-sm"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          local_fire_department
                        </span>
                        Hot Signal
                      </span>
                    ) : null}
                  </div>
                  <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
                    arrow_forward_ios
                  </span>
                </div>
              </button>
            );
          })}

          {!visibleReleases.length ? (
            <div className="bg-surface-container-low p-8 rounded-xl">
              <p className="text-sm leading-7 text-secondary">
                {t("explore.no_results")}
              </p>
            </div>
          ) : null}

          {visibleCount < filteredReleases.length ? (
            <button
              type="button"
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
              className="w-full py-4 border-2 border-dashed border-outline-variant rounded-xl font-label text-xs uppercase tracking-[0.2em] text-secondary hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">expand_more</span>
              Load More Archives
            </button>
          ) : null}
        </div>

        {/* Right: DetailPanel (Sticky) */}
        <div className="hidden lg:block lg:col-span-7 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <DetailPanel release={selectedRelease} t={t} localized={localized} />
        </div>
      </div>
    </div>
  );
}
