export enum VenueSize {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  ARENA = 'ARENA',
}

/** Capacity ranges per bucket; `max` is exclusive. */
export const VENUE_SIZE_RANGES: Record<
  VenueSize,
  { min: number; max?: number }
> = {
  [VenueSize.SMALL]: { min: 0, max: 300 },
  [VenueSize.MEDIUM]: { min: 300, max: 1500 },
  [VenueSize.LARGE]: { min: 1500, max: 5000 },
  [VenueSize.ARENA]: { min: 5000 },
};

export function venueSizeOf(capacity: number): VenueSize {
  const match = (Object.keys(VENUE_SIZE_RANGES) as VenueSize[]).find((size) => {
    const { min, max } = VENUE_SIZE_RANGES[size];
    return capacity >= min && (max === undefined || capacity < max);
  });
  return match ?? VenueSize.ARENA;
}
