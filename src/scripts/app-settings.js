import { PROVIDER } from '../config/provider';

const SETTINGS_KEY = 'cuentaCobroSettings';
const SETTINGS_VERSION = 1;

const DEFAULT_BRAND = {
  shortName: 'Cuenta',
  tagLine: 'Cobro',
  logoDataUrl: '',
  primaryColor: '#F2B705',
  primaryDarkColor: '#c99404',
  accentColor: '#17A078',
  darkColor: '#0F0F0F',
  backgroundColor: '#FAFAF8',
  textColor: '#1a1a1a',
  headingFont: 'Syne',
  bodyFont: 'DM Sans',
  monoFont: 'JetBrains Mono',
};

export const DEFAULT_SETTINGS = {
  version: SETTINGS_VERSION,
  provider: { ...PROVIDER },
  brand: DEFAULT_BRAND,
  document: {
    typeLabel: 'Documento de cobro',
    title: 'Cuenta de Cobro',
    subtitle: 'Servicios de desarrollo de software',
  },
};

function clone(value) {
  if (globalThis.structuredClone) return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function mergeSettings(candidate) {
  const incoming = candidate && typeof candidate === 'object' ? candidate : {};
  return {
    ...clone(DEFAULT_SETTINGS),
    ...incoming,
    version: SETTINGS_VERSION,
    provider: {
      ...DEFAULT_SETTINGS.provider,
      ...(incoming.provider || {}),
    },
    brand: {
      ...DEFAULT_SETTINGS.brand,
      ...(incoming.brand || {}),
    },
    document: {
      ...DEFAULT_SETTINGS.document,
      ...(incoming.document || {}),
    },
  };
}

export function getSettings() {
  try {
    return mergeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  } catch {
    return clone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings) {
  const next = mergeSettings(settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function resetSettings() {
  localStorage.removeItem(SETTINGS_KEY);
  return clone(DEFAULT_SETTINGS);
}

export function getProviderFromSettings(settings = getSettings()) {
  return mergeSettings(settings).provider;
}

export function applySettingsTheme(settings = getSettings()) {
  const { brand } = mergeSettings(settings);
  const root = document.documentElement;
  const cssVars = {
    '--brand-primary': brand.primaryColor,
    '--brand-primary-dark': brand.primaryDarkColor,
    '--brand-accent': brand.accentColor,
    '--brand-dark': brand.darkColor,
    '--brand-bg': brand.backgroundColor,
    '--brand-text': brand.textColor,
    '--font-heading': `"${brand.headingFont}", sans-serif`,
    '--font-body': `"${brand.bodyFont}", system-ui, sans-serif`,
    '--font-mono': `"${brand.monoFont}", monospace`,
  };

  Object.entries(cssVars).forEach(([name, value]) => root.style.setProperty(name, value));
}

export function logoMarkup(settings = getSettings(), size = 'md') {
  const { brand } = mergeSettings(settings);
  const dims = { sm: 28, md: 32, lg: 52 };
  const dim = dims[size] || dims.md;
  const alt = `${brand.shortName || 'Logo'} ${brand.tagLine || ''}`.trim();

  if (brand.logoDataUrl) {
    return `<img class="logo-mark logo-image" src="${escapeHtml(brand.logoDataUrl)}" width="${dim}" height="${dim}" alt="${escapeHtml(alt)}" />`;
  }

  const rx = size === 'lg' ? 10 : size === 'md' ? 7 : 6;
  const textSize = { sm: [20, 22, 9, 21], md: [23, 25, 11, 24], lg: [38, 41, 17, 40] };
  const [pFs, pY, aFs, aY] = textSize[size] || textSize.md;
  const pX = size === 'lg' ? 6 : size === 'md' ? 3.5 : 3;
  const aX = size === 'lg' ? 32 : size === 'md' ? 20 : 17;

  return `
    <svg class="logo-mark" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" aria-hidden="true">
      <rect width="${dim}" height="${dim}" rx="${rx}" fill="var(--gold)" />
      <text x="${pX}" y="${pY}" font-family="Georgia,serif" font-size="${pFs}" font-weight="700" fill="var(--black)">C</text>
      <text x="${aX}" y="${aY}" font-family="var(--font-mono)" font-size="${aFs}" font-weight="700" fill="var(--emerald)">&gt;</text>
    </svg>
  `;
}

export function applySettingsToPage(settings = getSettings()) {
  const merged = mergeSettings(settings);
  applySettingsTheme(merged);

  document.querySelectorAll('[data-logo-slot]').forEach(slot => {
    slot.innerHTML = logoMarkup(merged, slot.dataset.logoSize || 'md');
  });
  document.querySelectorAll('[data-brand-short]').forEach(el => {
    el.textContent = merged.brand.shortName;
  });
  document.querySelectorAll('[data-brand-tag]').forEach(el => {
    const suffix = el.dataset.brandSuffix || '';
    el.textContent = [merged.brand.tagLine, suffix].filter(Boolean).join(' · ');
  });
  document.querySelectorAll('[data-document-type]').forEach(el => {
    el.textContent = merged.document.typeLabel;
  });
  document.querySelectorAll('[data-document-title]').forEach(el => {
    el.innerHTML = escapeHtml(merged.document.title).replace(/\s+/g, '<br />');
  });
  document.querySelectorAll('[data-document-subtitle]').forEach(el => {
    el.textContent = merged.document.subtitle;
  });
}

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
