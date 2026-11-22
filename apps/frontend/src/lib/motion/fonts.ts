/**
 * Resolves once the given CSS font shorthands have loaded, or after the timeout
 * so a missing local font never blocks the page. Text is split only afterwards.
 */
export async function waitForFonts(
  fonts: readonly string[],
  timeoutMs = 1200,
): Promise<void> {
  if (!('fonts' in document)) {
    return;
  }
  const loads = Promise.all(
    fonts.map((font) => document.fonts.load(font)),
  ).then(
    () => undefined,
    () => undefined,
  );
  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, timeoutMs);
  });
  await Promise.race([loads, timeout]);
}
