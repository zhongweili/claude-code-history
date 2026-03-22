export type Lang = "cn" | "en";

export const messages = {
  // -- ExploreApp: QuerySummary --
  "explore.search": { cn: "搜索", en: "Search" },
  "explore.epoch_prefix": { cn: "阶段 ", en: "Epoch " },
  "explore.importance_suffix": { cn: "重要度", en: "Importance" },
  "explore.signal.with": { cn: "含社区信号", en: "With signals" },
  "explore.signal.hot": { cn: "只看热点", en: "Hot only" },
  "explore.results_unit": { cn: "个版本", en: "releases" },
  "explore.filter_summary": { cn: "当前筛选条件：", en: "Active filters: " },
  "explore.filter_none": {
    cn: "当前显示全部版本，按日期倒序排列。",
    en: "Showing all releases, sorted by date descending.",
  },
  "explore.active_filters": { cn: "个活跃筛选", en: "active filters" },
  "explore.no_results": {
    cn: "没有匹配结果。可以放宽 epoch、capability 或 importance 条件后再试。",
    en: "No matching results. Try loosening epoch, capability, or importance filters.",
  },

  // -- ExploreApp: DetailPanel --
  "detail.select_title": { cn: "选择一个版本", en: "Select a release" },
  "detail.select_desc": {
    cn: "点击左侧版本卡片后，这里会展开完整 changes、社区信号、来源和阶段信息。",
    en: "Click a release card on the left to see full changes, community signals, source, and epoch info.",
  },
  "detail.close": { cn: "关闭", en: "Close" },
  "detail.changes_heading": { cn: "变更详情", en: "Detailed Changes" },

  // -- ExploreApp: Filters --
  "filter.search_label": { cn: "搜索归档", en: "Search Archives" },
  "filter.search_placeholder": {
    cn: "关键词、版本号或功能名称...",
    en: "Keyword, version, or feature name...",
  },
  "filter.epoch_label": { cn: "时代", en: "Epoch" },
  "filter.importance_label": { cn: "重要度", en: "Importance" },
  "filter.capabilities_label": { cn: "能力线：", en: "Capabilities:" },
  "filter.signal_all": { cn: "全部", en: "All" },
  "filter.signal_with": { cn: "含信号", en: "With signal" },
  "filter.signal_hot_prefix": { cn: "热点 >=", en: "Hot >=" },
  "filter.clear": { cn: "清空筛选", en: "Clear filters" },

  // -- Kickers --
  "explore.result_kicker": { cn: "筛选结果", en: "Result Summary" },
  "detail.kicker": { cn: "版本详情", en: "Release Detail" },

  // -- EpochRail --
  "epochrail.desc": {
    cn: "5 个阶段，覆盖从研究预览到自主运行的完整演进。",
    en: "5 epochs spanning the full arc from research preview to autonomous operation.",
  },
} as const;

export type MessageKey = keyof typeof messages;
