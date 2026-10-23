import { Transform } from 'class-transformer';

/**
 * Query strings arrive as `?genre=a&genre=b` (array) or `?genre=a,b` (string).
 * Normalises both into a string array.
 */
export const ToArray = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const list = Array.isArray(value) ? value : [value];
    return list
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter(Boolean);
  });

/** `?free=true` arrives as the string "true"; plain Boolean("false") would be true. */
export const ToBoolean = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === '') return undefined;
    return value === true || value === 'true' || value === '1';
  });
