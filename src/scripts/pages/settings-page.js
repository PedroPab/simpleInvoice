import {
  DEFAULT_SETTINGS,
  applySettingsToPage,
  escapeHtml,
  getSettings,
  logoMarkup,
  resetSettings,
  saveSettings,
} from '../app-settings.js';
import { registerPwa } from '../invoice-store.js';

export function initSettingsPage() {
  let settings = getSettings();
  let currentStep = 0;
  const totalSteps = 5;
  const stepNames = ['Identidad', 'Pago', 'Documento', 'Marca', 'Revisión'];
  const wizardPanels = Array.from(document.querySelectorAll('[data-step]'));
  const wizardTabs = Array.from(document.querySelectorAll('[data-step-target]'));
  const wizardStatus = document.getElementById('wizard-status');
  const wizardProgress = document.getElementById('wizard-progress-bar');
  const wizardPrev = document.getElementById('wizard-prev');
  const wizardNext = document.getElementById('wizard-next');
  const validationNote = document.getElementById('validation-note');
  const reviewRoot = document.getElementById('settings-review');

  const fields = {
    provider: {
      name: document.getElementById('provider-name'),
      title: document.getElementById('provider-title'),
      cc: document.getElementById('provider-cc'),
      rut: document.getElementById('provider-rut'),
      email: document.getElementById('provider-email'),
      phone: document.getElementById('provider-phone'),
      city: document.getElementById('provider-city'),
      website: document.getElementById('provider-website'),
      bank: document.getElementById('provider-bank'),
      accountType: document.getElementById('provider-account-type'),
      accountNumber: document.getElementById('provider-account-number'),
      accountHolder: document.getElementById('provider-account-holder'),
      nequi: document.getElementById('provider-nequi'),
      breve: document.getElementById('provider-breve'),
    },
    brand: {
      shortName: document.getElementById('brand-short'),
      tagLine: document.getElementById('brand-tag'),
      primaryColor: document.getElementById('brand-primary'),
      primaryDarkColor: document.getElementById('brand-primary-dark'),
      accentColor: document.getElementById('brand-accent'),
      darkColor: document.getElementById('brand-dark'),
      backgroundColor: document.getElementById('brand-bg'),
      textColor: document.getElementById('brand-text'),
      headingFont: document.getElementById('font-heading'),
      bodyFont: document.getElementById('font-body'),
      monoFont: document.getElementById('font-mono'),
    },
    document: {
      typeLabel: document.getElementById('doc-type'),
      title: document.getElementById('doc-title'),
      subtitle: document.getElementById('doc-subtitle'),
    },
  };

  function signatureMarkup(nextSettings = settings) {
    const src = nextSettings.provider?.signatureDataUrl;
    if (!src) return '<span class="signature-placeholder">Sin firma</span>';
    return `<img src="${escapeHtml(src)}" alt="Firma configurada" />`;
  }

  function populateForm(nextSettings) {
    settings = JSON.parse(JSON.stringify(nextSettings));
    Object.entries(fields.provider).forEach(([key, el]) => el.value = settings.provider[key] || '');
    Object.entries(fields.brand).forEach(([key, el]) => el.value = settings.brand[key] || DEFAULT_SETTINGS.brand[key] || '');
    Object.entries(fields.document).forEach(([key, el]) => el.value = settings.document[key] || '');
    document.getElementById('signature-upload-preview').innerHTML = signatureMarkup(settings);
    renderPreview();
    renderReview();
  }

  function readForm() {
    const next = JSON.parse(JSON.stringify(settings));
    Object.entries(fields.provider).forEach(([key, el]) => next.provider[key] = el.value);
    Object.entries(fields.brand).forEach(([key, el]) => next.brand[key] = el.value);
    Object.entries(fields.document).forEach(([key, el]) => next.document[key] = el.value);
    return next;
  }

  function renderPreview() {
    settings = readForm();
    applySettingsToPage(settings);
    document.getElementById('logo-upload-preview').innerHTML = logoMarkup(settings, 'lg');

    const p = settings.provider;
    document.getElementById('preview-name').textContent = p.name;
    document.getElementById('preview-detail').innerHTML = [
      p.title,
      `NIT / CC: ${p.cc}`,
      p.rut ? `RUT: ${p.rut}` : '',
      p.email,
      p.phone,
      p.city,
    ].filter(Boolean).map(escapeHtml).join('<br>');
    document.getElementById('preview-payment').innerHTML = [
      `${p.bank} — ${p.accountType}`,
      `Cuenta: ${p.accountNumber}`,
      `Titular: ${p.accountHolder}`,
      `Nequi: ${p.nequi}`,
      `Breve: ${p.breve}`,
    ].filter(line => !line.endsWith(': ')).map(escapeHtml).join('<br>');
    renderReview();
  }

  function renderReview() {
    if (!reviewRoot) return;
    const next = readForm();
    const p = next.provider;
    const doc = next.document;
    const brand = next.brand;
    const rows = [
      ['Prestador', p.name],
      ['Identificación', p.cc],
      ['RUT', p.rut],
      ['Contacto', [p.email, p.phone, p.city].filter(Boolean).join(' · ')],
      ['Banco', [p.bank, p.accountType, p.accountNumber].filter(Boolean).join(' · ')],
      ['Titular', p.accountHolder],
      ['Firma', p.signatureDataUrl ? 'PNG cargado' : 'Pendiente'],
      ['Documento', [doc.typeLabel, doc.title, doc.subtitle].filter(Boolean).join(' · ')],
      ['Marca', [brand.shortName, brand.tagLine].filter(Boolean).join(' · ')],
    ];
    reviewRoot.innerHTML = rows.map(([label, value]) => `
      <div class="review-row">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(value || 'Pendiente')}</span>
      </div>
    `).join('');
  }

  function requiredValuesForStep(step) {
    if (step === 0) {
      return [
        ['Nombre', fields.provider.name.value],
        ['CC / NIT', fields.provider.cc.value],
        ['Email', fields.provider.email.value],
      ];
    }
    if (step === 1) {
      return [
        ['Banco', fields.provider.bank.value],
        ['Tipo de cuenta', fields.provider.accountType.value],
        ['N.° cuenta', fields.provider.accountNumber.value],
        ['Titular', fields.provider.accountHolder.value],
      ];
    }
    if (step === 2) {
      return [
        ['Tipo de documento', fields.document.typeLabel.value],
        ['Título principal', fields.document.title.value],
      ];
    }
    return [];
  }

  function validateStep(step) {
    const missing = requiredValuesForStep(step)
      .filter(([, value]) => !String(value || '').trim())
      .map(([label]) => label);
    if (!missing.length) {
      validationNote.classList.remove('visible');
      validationNote.textContent = '';
      return true;
    }
    validationNote.textContent = `Completa estos datos para continuar: ${missing.join(', ')}.`;
    validationNote.classList.add('visible');
    return false;
  }

  function saveCurrentSettings(button = document.getElementById('btn-save-settings')) {
    settings = saveSettings(readForm());
    populateForm(settings);
    button.textContent = 'Configuración guardada';
    setTimeout(() => button.textContent = 'Guardar configuración', 1600);
  }

  function showStep(step) {
    currentStep = Math.max(0, Math.min(totalSteps - 1, step));
    wizardPanels.forEach(panel => panel.classList.toggle('is-active', Number(panel.dataset.step) === currentStep));
    wizardTabs.forEach(tab => tab.classList.toggle('is-active', Number(tab.dataset.stepTarget) === currentStep));
    wizardStatus.textContent = `Paso ${currentStep + 1} de ${totalSteps}: ${stepNames[currentStep]}`;
    wizardProgress.style.width = `${((currentStep + 1) / totalSteps) * 100}%`;
    wizardPrev.disabled = currentStep === 0;
    wizardNext.textContent = currentStep === totalSteps - 1 ? 'Guardar configuración' : 'Siguiente';
    validationNote.classList.remove('visible');
    validationNote.textContent = '';
    renderReview();
  }

  Object.values(fields).forEach(group => {
    Object.values(group).forEach(el => {
      el.addEventListener('input', renderPreview);
      el.addEventListener('change', renderPreview);
    });
  });

  document.getElementById('brand-logo').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecciona un archivo de imagen válido.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      settings.brand.logoDataUrl = ev.target.result;
      renderPreview();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  });

  document.getElementById('provider-signature').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== 'image/png') {
      alert('Selecciona una firma en formato PNG.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      settings.provider.signatureDataUrl = ev.target.result;
      document.getElementById('signature-upload-preview').innerHTML = signatureMarkup(settings);
      renderPreview();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  });

  document.getElementById('btn-save-settings').addEventListener('click', event => saveCurrentSettings(event.currentTarget));

  wizardTabs.forEach(tab => {
    tab.addEventListener('click', () => showStep(Number(tab.dataset.stepTarget)));
  });

  wizardPrev.addEventListener('click', () => showStep(currentStep - 1));

  wizardNext.addEventListener('click', event => {
    if (currentStep === totalSteps - 1) {
      saveCurrentSettings(event.currentTarget);
      return;
    }
    if (!validateStep(currentStep)) return;
    showStep(currentStep + 1);
  });

  document.getElementById('btn-export-settings').addEventListener('click', () => {
    const data = saveSettings(readForm());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cuenta-cobro-configuracion.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('settings-import').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const imported = saveSettings(parsed);
        populateForm(imported);
        showStep(4);
        alert('Configuración importada correctamente.');
      } catch {
        alert('El archivo de configuración no es un JSON válido.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  });

  document.getElementById('btn-reset-settings').addEventListener('click', () => {
    if (!confirm('¿Resetear la configuración visual y del prestador?')) return;
    populateForm(resetSettings());
    showStep(0);
  });

  registerPwa();
  populateForm(settings);
  showStep(0);
}
