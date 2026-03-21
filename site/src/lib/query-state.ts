import { z } from "zod";
import {
  CATEGORY_VALUES,
  EPOCH_VALUES,
  IMPORTANCE_VALUES,
  SIGNAL_VALUES,
  SOURCE_VALUES,
} from "./data/schema";

const QueryStateSchema = z.object({
  q: z.string().trim().max(160).default(""),
  epoch: z.union([z.literal(""), z.enum(EPOCH_VALUES)]).default(""),
  capability: z.string().trim().max(80).default(""),
  category: z.union([z.literal(""), z.enum(CATEGORY_VALUES)]).default(""),
  importance: z.union([z.literal(""), z.enum(IMPORTANCE_VALUES)]).default(""),
  source: z.union([z.literal(""), z.enum(SOURCE_VALUES)]).default(""),
  signal: z.enum(SIGNAL_VALUES).default("all"),
  release: z.string().trim().max(64).default(""),
});

export type QueryState = z.infer<typeof QueryStateSchema>;

export const DEFAULT_QUERY_STATE: QueryState = QueryStateSchema.parse({});

function getString(value: string | null) {
  return (value ?? "").trim();
}

function readEnumValue<T extends readonly string[]>(
  value: string | null,
  allowed: T,
  fallback: T[number] | ""
) {
  const normalized = getString(value);
  return (allowed as readonly string[]).includes(normalized)
    ? (normalized as T[number])
    : fallback;
}

export function parseSearchParams(
  input: URLSearchParams | string
): QueryState {
  const params =
    typeof input === "string" ? new URLSearchParams(input) : input;

  return QueryStateSchema.parse({
    q: getString(params.get("q")),
    epoch: readEnumValue(params.get("epoch"), EPOCH_VALUES, ""),
    capability: getString(params.get("capability")),
    category: readEnumValue(params.get("category"), CATEGORY_VALUES, ""),
    importance: readEnumValue(params.get("importance"), IMPORTANCE_VALUES, ""),
    source: readEnumValue(params.get("source"), SOURCE_VALUES, ""),
    signal: readEnumValue(params.get("signal"), SIGNAL_VALUES, "all"),
    release: getString(params.get("release")),
  });
}

export function serializeQueryState(state: QueryState) {
  const next = new URLSearchParams();

  if (state.q) {
    next.set("q", state.q);
  }
  if (state.epoch) {
    next.set("epoch", state.epoch);
  }
  if (state.capability) {
    next.set("capability", state.capability);
  }
  if (state.category) {
    next.set("category", state.category);
  }
  if (state.importance) {
    next.set("importance", state.importance);
  }
  if (state.source) {
    next.set("source", state.source);
  }
  if (state.signal !== "all") {
    next.set("signal", state.signal);
  }
  if (state.release) {
    next.set("release", state.release);
  }

  return next.toString();
}

export function countActiveFilters(state: QueryState) {
  return [
    state.q,
    state.epoch,
    state.capability,
    state.category,
    state.importance,
    state.source,
    state.signal !== "all" ? state.signal : "",
  ].filter(Boolean).length;
}

