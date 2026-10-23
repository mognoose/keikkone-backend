import { collectHashtags, extractHashtags, normalizeTag } from './hashtags.js';

describe('hashtags', () => {
  it('normalizes case, whitespace and leading #', () => {
    expect(normalizeTag('  #Metal ')).toBe('metal');
    expect(normalizeTag('##Öljyä')).toBe('öljyä');
  });

  it('rejects empty, too long and punctuated tags', () => {
    expect(normalizeTag('#')).toBeNull();
    expect(normalizeTag('a'.repeat(51))).toBeNull();
    expect(normalizeTag('rock-n-roll')).toBeNull();
  });

  it('extracts tags from text but not from URLs or emails', () => {
    expect(
      extractHashtags('Gig! #metal,#Doom see https://x.fi/#anchor and a#b'),
    ).toEqual(['metal', 'Doom']);
  });

  it('merges explicit and text tags without duplicates', () => {
    expect(
      collectHashtags(['#Metal', 'live'], 'Tonight #metal #helsinki'),
    ).toEqual(['metal', 'live', 'helsinki']);
  });
});
