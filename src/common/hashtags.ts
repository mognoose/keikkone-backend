const MAX_TAG_LENGTH = 50;
// Letters (any script, so "#keikkailta" and "#öljyä" work), digits and underscore.
// Must follow start/whitespace/punctuation, so URL fragments (x.fi/#top) and
// "a#b" are not tags.
const TAG_IN_TEXT = /(?:^|[\s(,.;:!?"'])#([\p{L}\p{N}_]+)/gu;

/** "#Metal" / "metal" / " METAL " -> "metal"; returns null for invalid tags. */
export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().replace(/^#+/, '').toLowerCase();
  if (!tag || tag.length > MAX_TAG_LENGTH || !/^[\p{L}\p{N}_]+$/u.test(tag)) {
    return null;
  }
  return tag;
}

export function extractHashtags(text: string): string[] {
  return [...text.matchAll(TAG_IN_TEXT)].map((m) => m[1]);
}

/** Merges explicit tags with #words found in the text, normalised and deduplicated. */
export function collectHashtags(explicit: string[] = [], text = ''): string[] {
  const tags = [...explicit, ...extractHashtags(text)]
    .map(normalizeTag)
    .filter((t): t is string => t !== null);
  return [...new Set(tags)];
}
