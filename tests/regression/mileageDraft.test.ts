import * as assert from "node:assert/strict";
import { createEmptyMileageDraft, normalizeMileageDraftMiles, toMileageTripPayload } from "../../src/features/mileage/draft";

export function runMileageDraftTests() {
  const fixedDate = new Date("2026-04-16T12:00:00.000Z");
  const draft = createEmptyMileageDraft(fixedDate);

  assert.equal(draft.date, "2026-04-16", "new mileage drafts should default to today's ISO date");
  assert.equal(draft.miles, "", "new mileage drafts should start with empty miles");
  assert.equal(draft.purpose, "");
  assert.equal(draft.client, "");
  assert.equal(draft.notes, "");

  assert.equal(normalizeMileageDraftMiles(""), "", "empty mileage input should stay empty");
  assert.equal(normalizeMileageDraftMiles("  11.0  "), "11", "mileage values should normalize numeric strings");
  assert.equal(normalizeMileageDraftMiles("1.50"), "1.5", "mileage values should normalize decimal strings");
  assert.equal(normalizeMileageDraftMiles("11a"), "11a", "invalid numeric text should not be silently changed");

  const payload = toMileageTripPayload({
    date: "2026-04-16",
    miles: "15.5",
    purpose: "Client visit",
    client: "Acme",
    notes: "Round trip"
  });

  assert.deepEqual(payload, {
    date: "2026-04-16",
    miles: 15.5,
    purpose: "Client visit",
    client: "Acme",
    notes: "Round trip"
  }, "mileage draft payloads should serialize cleanly for storage");
}
