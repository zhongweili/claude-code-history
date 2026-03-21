import test from "node:test";
import assert from "node:assert/strict";
import { deriveCapabilityIds } from "../src/lib/data/schema";

test("deriveCapabilityIds matches capability keywords case-insensitively", () => {
  const capabilities = [
    {
      id: "reasoning_workflows",
      keywords: ["plan mode", "ultrathink"],
    },
    {
      id: "multimodal_interfaces",
      keywords: ["voice", "image"],
    },
  ];

  const matches = deriveCapabilityIds(
    [
      "The new Plan Mode can explore before it edits.",
      "Voice control landed later.",
    ],
    capabilities
  );

  assert.deepEqual(matches, [
    "reasoning_workflows",
    "multimodal_interfaces",
  ]);
});

test("deriveCapabilityIds only returns unique capability ids", () => {
  const capabilities = [
    {
      id: "automation_autonomy",
      keywords: ["background", "loop"],
    },
  ];

  const matches = deriveCapabilityIds(
    ["Background mode keeps a loop running.", "background tasks again"],
    capabilities
  );

  assert.deepEqual(matches, ["automation_autonomy"]);
});

