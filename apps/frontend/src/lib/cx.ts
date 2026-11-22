type ClassValue = string | false | null | undefined;

/** Joins the truthy class names, so CSS Module lookups can be combined safely. */
export function cx(...classes: ClassValue[]): string {
  return classes
    .filter(
      (value): value is string => typeof value === 'string' && value !== '',
    )
    .join(' ');
}
