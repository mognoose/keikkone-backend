import { slugify } from './slug.js';

describe('slugify', () => {
  it('strips diacritics and punctuation', () => {
    expect(slugify('Mötley Crüe')).toBe('motley-crue');
    expect(slugify('Haloo Helsinki!')).toBe('haloo-helsinki');
    expect(slugify('  Pää  Kii  ')).toBe('paa-kii');
  });
});
