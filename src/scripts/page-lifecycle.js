import { applySettingsToPage, getSettings } from './app-settings.js';
import { registerPwa } from './invoice-store.js';

export function initStaticPage() {
  applySettingsToPage(getSettings());
  registerPwa();
}
