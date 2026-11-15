/** Local time, ISO without zone, as D1's started_at is kept. Its own module so the content script, which must stand alone, can use it. */
export function localIso(d: Date = new Date()): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}
