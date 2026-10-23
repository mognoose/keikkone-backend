import { VenueSize, venueSizeOf } from './venue-size.js';

describe('venueSizeOf', () => {
  it.each([
    [1, VenueSize.SMALL],
    [299, VenueSize.SMALL],
    [300, VenueSize.MEDIUM],
    [1499, VenueSize.MEDIUM],
    [1500, VenueSize.LARGE],
    [4999, VenueSize.LARGE],
    [5000, VenueSize.ARENA],
    [50000, VenueSize.ARENA],
  ])('capacity %i -> %s', (capacity, size) => {
    expect(venueSizeOf(capacity)).toBe(size);
  });
});
