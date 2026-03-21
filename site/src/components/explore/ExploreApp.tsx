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

const PAGE_SIZE = 24;

type Props = {
  data: ExploreData;
};

type SegmentedOption = {
  label: string;
  value: string;
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
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--page-muted)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value || `${label}-all`}
              type="button"
              onClick={() => onChange(active ? "" : option.value)}
              className={cn(
                "rounded-full border px-3 py-2 text-sm transition",
                active
                  ? "border-transparent bg-[var(--page-ink)] text-white"
                  : "border-[var(--page-line)] bg-white/70 text-[var(--page-muted)] hover:bg-white hover:text-[var(--page-ink)]"
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
}: {
  count: number;
  total: number;
  queryState: QueryState;
  capabilityName?: string;
}) {
  const parts = [];

  if (queryState.q) {
    parts.push(`搜索 “${queryState.q}”`);
  }
  if (queryState.epoch) {
    parts.push(queryState.epoch.replace("epoch", "阶段 "));
  }
  if (capabilityName) {
    parts.push(capabilityName);
  }
  if (queryState.category) {
    parts.push(queryState.category);
  }
  if (queryState.importance) {
    parts.push(`重要度 ${queryState.importance}+`);
  }
  if (queryState.source) {
    parts.push(queryState.source);
  }
  if (queryState.signal !== "all") {
    parts.push(queryState.signal === "with-signal" ? "含社区信号" : "只看热点");
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="section-kicker">Result Summary</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--page-ink)] sm:text-4xl">
          {count} / {total} 个版本
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--page-muted)]">
          {parts.length
            ? `当前筛选条件：${parts.join(" · ")}`
            : "当前显示全部版本，按日期倒序排列。"}
        </p>
      </div>

      <div className="rounded-[1.5rem] border border-[var(--page-line)] bg-white/65 px-4 py-3 text-sm text-[var(--page-muted)]">
        {countActiveFilters(queryState)} active filters
      </div>
    </div>
  );
}

function DetailPanel({
  release,
  onClose,
}: {
  release: ExploreRelease | null;
  onClose?: () => void;
}) {
  if (!release) {
    return (
      <div className="surface-panel p-6">
        <p className="section-kicker">Release Detail</p>
        <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--page-ink)]">
          选择一个版本
        </h3>
        <p className="mt-4 text-sm leading-7 text-[var(--page-muted)]">
          点击左侧版本卡片后，这里会展开完整 changes、社区信号、来源和阶段信息。
        </p>
      </div>
    );
  }

  return (
    <div className="surface-panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--page-muted)]">
            {release.display_date}
          </p>
          <h3 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--page-ink)]">
            v{release.version}
          </h3>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--page-line)] bg-white/80 px-3 py-2 text-sm text-[var(--page-muted)]"
          >
            关闭
          </button>
        ) : null}
      </div>

      <p className="mt-4 text-sm leading-7 text-[var(--page-ink)]">{release.headline}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full border border-[var(--page-line)] bg-white/75 px-3 py-1 text-xs text-[var(--page-muted)]">
          {release.epoch_name}
        </span>
        <span className="rounded-full border border-[var(--page-line)] bg-white/75 px-3 py-1 text-xs text-[var(--page-muted)]">
          {release.source}
        </span>
        <span className="rounded-full border border-[var(--page-line)] bg-white/75 px-3 py-1 text-xs text-[var(--page-muted)]">
          milestone {release.milestone_score}
        </span>
        {release.hot_signal ? (
          <span className="rounded-full border border-transparent bg-[rgba(213,146,122,0.16)] px-3 py-1 text-xs text-[var(--page-ink)]">
            hot signal
          </span>
        ) : null}
      </div>

      {release.capabilities.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {release.capabilities.map((capability) => (
            <span
              key={capability.id}
              className="rounded-full border border-[var(--page-line)] px-3 py-1 text-xs text-[var(--page-muted)]"
            >
              {capability.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {release.changes.map((change, index) => (
          <div
            key={`${release.version}-${index}-${change.raw}`}
            className="rounded-[1.4rem] border border-[var(--page-line)] bg-white/62 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--page-muted)]">
                0{index + 1} · {change.category}
              </p>
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs text-[var(--page-muted)]">
                importance {change.importance}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-[var(--page-ink)]">
              {change.summary || change.raw}
            </p>
            {change.summary && change.summary !== change.raw ? (
              <p className="mt-3 text-sm leading-7 text-[var(--page-muted)]">{change.raw}</p>
            ) : null}
            {change.why_matters ? (
              <p className="mt-3 text-sm leading-7 text-[var(--page-muted)]">
                {change.why_matters}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {release.signals.length ? (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--page-muted)]">
            Community signals
          </p>
          <div className="mt-3 space-y-3">
            {release.signals.map((signal) => (
              <a
                key={signal.objectID || signal.url}
                href={signal.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-[1.4rem] border border-[var(--page-line)] bg-white/62 p-4 transition hover:bg-white/92"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--page-ink)]">{signal.title}</p>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs text-[var(--page-muted)]">
                    {signal.points} pts
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ExploreApp({ data }: Props) {
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

  const capabilityName = data.filters.capabilities.find(
    (capability) => capability.id === queryState.capability
  )?.name;

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
    <div className="space-y-8">
      <section className="surface-panel px-6 py-8 sm:px-8 lg:px-10">
        <QuerySummary
          count={filteredReleases.length}
          total={data.meta.total_versions}
          queryState={queryState}
          capabilityName={capabilityName}
        />

        <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <div className="space-y-5">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--page-muted)]">
                Search
              </span>
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="搜索版本号、变更摘要或 why matters"
                className="mt-3 w-full rounded-[1.2rem] border border-[var(--page-line)] bg-white/72 px-4 py-3 text-sm text-[var(--page-ink)] outline-none ring-0 transition placeholder:text-[var(--page-muted)] focus:border-[rgba(31,38,46,0.2)]"
              />
            </label>

            <div className="grid gap-4">
              <FilterGroup
                label="Epoch"
                value={queryState.epoch}
                options={data.filters.epochs.map((epoch) => ({
                  label: epoch.name,
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
                label="Capability"
                value={queryState.capability}
                options={data.filters.capabilities.map((capability) => ({
                  label: capability.name,
                  value: capability.id,
                }))}
                onChange={(capability) =>
                  updateState((current) => ({
                    ...current,
                    capability,
                    release: "",
                  }))
                }
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FilterGroup
                  label="Category"
                  value={queryState.category}
                options={data.filters.categories.map((category) => ({
                  label: category,
                  value: category,
                }))}
                onChange={(category) =>
                  updateState((current) => ({
                    ...current,
                    category: category as QueryState["category"],
                    release: "",
                  }))
                }
              />

                <FilterGroup
                  label="Source"
                  value={queryState.source}
                options={data.filters.sources.map((source) => ({
                  label: source,
                  value: source,
                }))}
                onChange={(source) =>
                  updateState((current) => ({
                    ...current,
                    source: source as QueryState["source"],
                    release: "",
                  }))
                }
              />

                <FilterGroup
                  label="Importance"
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

                <FilterGroup
                  label="Signal"
                  value={queryState.signal}
                  options={[
                    { label: "全部", value: "all" },
                    { label: "含信号", value: "with-signal" },
                    { label: `热点 >= ${HOT_SIGNAL_THRESHOLD}`, value: "hot-only" },
                  ]}
                  onChange={(signal) =>
                    updateState((current) => ({
                      ...current,
                      signal: (signal || "all") as QueryState["signal"],
                      release: "",
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="surface-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--page-muted)]">
              Shareable state
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--page-muted)]">
              全部过滤状态都绑定在 query string 上。刷新、复制链接、回退前进都会保留当前上下文。
            </p>

            <div className="mt-5 space-y-3 rounded-[1.2rem] border border-[var(--page-line)] bg-white/62 p-4 text-sm text-[var(--page-ink)]">
              <div className="flex items-center justify-between gap-4">
                <span>已匹配版本</span>
                <span>{filteredReleases.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>当前页尺寸</span>
                <span>{data.meta.page_size}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>热点阈值</span>
                <span>{data.meta.hot_signal_threshold} pts</span>
              </div>
            </div>

            <button
              type="button"
              onClick={clearAll}
              className="mt-5 inline-flex items-center justify-center rounded-full border border-[var(--page-line)] bg-white/72 px-4 py-2 text-sm text-[var(--page-ink)] transition hover:bg-white"
            >
              清空全部筛选
            </button>
          </div>
        </div>
      </section>

      <div className="lg:hidden">
        <DetailPanel
          release={selectedRelease}
          onClose={() =>
            updateState((current) => ({
              ...current,
              release: "",
            }))
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="space-y-4">
          {visibleReleases.map((release) => {
            const selected = queryState.release === release.version;
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
                  "surface-card block w-full p-5 text-left transition",
                  selected
                    ? "border-transparent bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,255,255,0.7))] shadow-[0_40px_90px_-58px_rgba(31,38,46,0.65)]"
                    : "hover:bg-white/92"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--page-muted)]">
                      {release.display_date}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--page-ink)]">
                      v{release.version}
                    </h3>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <span className="rounded-full border border-[var(--page-line)] bg-white/78 px-3 py-1 text-xs text-[var(--page-muted)]">
                      {release.epoch_name}
                    </span>
                    <span className="rounded-full border border-[var(--page-line)] bg-white/78 px-3 py-1 text-xs text-[var(--page-muted)]">
                      {release.source}
                    </span>
                    {release.hot_signal ? (
                      <span className="rounded-full border border-transparent bg-[rgba(213,146,122,0.14)] px-3 py-1 text-xs text-[var(--page-ink)]">
                        {release.signal_max_points} pts
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="mt-4 text-base font-medium leading-7 text-[var(--page-ink)]">
                  {release.headline}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {release.capabilities.slice(0, 4).map((capability) => (
                    <span
                      key={capability.id}
                      className="rounded-full border border-[var(--page-line)] px-3 py-1 text-xs text-[var(--page-muted)]"
                    >
                      {capability.name}
                    </span>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {release.highlights.map((highlight) => (
                    <div
                      key={`${release.version}-${highlight}`}
                      className="rounded-[1.2rem] border border-[var(--page-line)] bg-white/62 px-4 py-3 text-sm text-[var(--page-muted)]"
                    >
                      {highlight}
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-[var(--page-muted)]">
                  <span>{release.change_count} changes</span>
                  <span className="h-1 w-1 rounded-full bg-[var(--page-line)]"></span>
                  <span>importance {release.max_importance}</span>
                  <span className="h-1 w-1 rounded-full bg-[var(--page-line)]"></span>
                  <span>{release.signal_count} signals</span>
                </div>
              </button>
            );
          })}

          {!visibleReleases.length ? (
            <div className="surface-panel p-8">
              <p className="text-sm leading-7 text-[var(--page-muted)]">
                没有匹配结果。可以放宽 epoch、capability 或 importance 条件后再试。
              </p>
            </div>
          ) : null}

          {visibleCount < filteredReleases.length ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                className="inline-flex items-center justify-center rounded-full border border-[var(--page-line)] bg-white/75 px-5 py-3 text-sm font-medium text-[var(--page-ink)] transition hover:bg-white"
              >
                Load more 24
              </button>
            </div>
          ) : null}
        </section>

        <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
          <DetailPanel release={selectedRelease} />
        </aside>
      </div>
    </div>
  );
}
