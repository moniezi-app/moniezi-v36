const FONT_STYLE_ID = 'moniezi-embedded-fonts';

const SYSTEM_APP_STACK = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const SYSTEM_REPORT_STACK = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

const buildFontFaceCss = () => `
:root {
  --moniezi-app-font: ${SYSTEM_APP_STACK};
  --moniezi-report-font: ${SYSTEM_REPORT_STACK};
}
html body,
#root {
  font-family: var(--moniezi-app-font);
}
.moniezi-report-font,
.moniezi-report-font * {
  font-family: var(--moniezi-report-font);
}
.moniezi-report-font {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1, 'liga' 1, 'calt' 1;
}
`;

export const installMonieziFonts = () => {
  if (typeof document === 'undefined') return;
  const css = buildFontFaceCss();
  const existing = document.getElementById(FONT_STYLE_ID) as HTMLStyleElement | null;
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css;
    return;
  }
  const style = document.createElement('style');
  style.id = FONT_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
};

export const waitForMonieziFonts = async () => {
  installMonieziFonts();
};

const embeddedFontUnavailable = async (): Promise<Uint8Array> => {
  throw new Error('Embedded custom font assets unavailable; using standard PDF fonts.');
};

export const getEmbeddedAppRegularOtf = embeddedFontUnavailable;
export const getEmbeddedAppBoldOtf = embeddedFontUnavailable;
export const getEmbeddedReportRegularOtf = embeddedFontUnavailable;
export const getEmbeddedReportBoldOtf = embeddedFontUnavailable;
