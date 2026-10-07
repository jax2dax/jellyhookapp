// app/docs/docsSync.ts
//
// THE RULE: when Hook, the preview (Silhouette) or the results canvas (Output) changes, the public
// docs under app/docs/hook, app/docs/preview and app/docs/results change in the same commit.
//
// This file is how that is enforced. It stores a fingerprint of what the docs were last reviewed
// against. `npm run docs:check` recomputes the fingerprints from the code and FAILS when they differ,
// which means "the feature changed and the docs have not been re-read yet". Re-read the pages listed
// in mds/documentation/doc_source_map.md, fix what changed, then run `npm run docs:stamp` and paste
// the printed values here. Never stamp without re-reading.
//
//   hookSchema        the vocabulary: entities, fields, types, relations, operators, measures
//   hookSpecVersion   the query format version (jh-hook/types.ts SPEC_VERSION)
//   previewRules      silhouette/rules.md, the contract for when each shape is drawn
//   resultsRules      output/rules.md, the contract for what each result looks like
//
// The Field reference page (app/docs/hook/field-reference) reads the schema directly, so its
// content can never go stale; the other pages are written by hand and are what this check guards.
export const DOCS_REVIEWED = {
  reviewedOn: "2026-10-07",
  hookSpecVersion: 3,
  hookSchema: "c495e466037dc3b9",
  previewRules: "c48aa8bb55c3b453",
  resultsRules: "5ecdc6005686ab09",
};
