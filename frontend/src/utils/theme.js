// Canvas cannot resolve CSS variables; read the same theme used by the page.
export function themeValue(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}
