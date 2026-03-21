import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSearchParams,
  serializeQueryState,
} from "../src/lib/query-state";

test("parseSearchParams falls back to defaults for invalid values", () => {
  const state = parseSearchParams(
    "epoch=epoch7&category=nope&source=feed&signal=loud&importance=9&q=  loop  "
  );

  assert.deepEqual(state, {
    q: "loop",
    epoch: "",
    capability: "",
    category: "",
    importance: "",
    source: "",
    signal: "all",
    release: "",
  });
});

test("serializeQueryState omits empty defaults", () => {
  const serialized = serializeQueryState({
    q: "voice",
    epoch: "epoch5",
    capability: "",
    category: "feat",
    importance: "",
    source: "github",
    signal: "hot-only",
    release: "2.1.71",
  });

  assert.equal(
    serialized,
    "q=voice&epoch=epoch5&category=feat&source=github&signal=hot-only&release=2.1.71"
  );
});
