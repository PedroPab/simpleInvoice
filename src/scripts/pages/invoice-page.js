import {
  applySettingsToPage,
  getProviderFromSettings,
  getSettings,
  escapeHtml,
} from '../app-settings.js';
import {
  getActiveInvoiceRecord,
  getInvoiceRecord,
  migrateLegacyInvoice,
  registerPwa,
  saveInvoice,
} from '../invoice-store.js';

export function initInvoicePage() {
  let state = JSON.parse(document.getElementById('default-data').textContent);
  let currentRecord = null;

  function fmt(n) {
    return '$ ' + Math.round(n).toLocaleString('es-CO');
  }

  function fmtDate(iso) {
    if (!iso) return new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function calcTotals(inv) {
    const subtotal = inv.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    const disc = inv.discount || {};
    let discountAmt = 0;
    if (disc.enabled) {
      discountAmt = disc.type === 'percentage'
        ? subtotal * ((disc.value || 0) / 100)
        : (disc.value || 0);
    }
    const net = subtotal - discountAmt;
    const retentionAmt = inv.retention.enabled ? net * (inv.retention.rate / 100) : 0;
    return { subtotal, discountAmt, retentionAmt, total: net - retentionAmt };
  }

  function updateTotals() {
    const inv = state.invoice;
    const disc = inv.discount || {};
    const { subtotal, discountAmt, retentionAmt, total } = calcTotals(inv);

    document.getElementById('tot-subtotal').textContent = fmt(subtotal);

    const tableDiscRow = document.getElementById('table-disc-row');
    if (disc.enabled && discountAmt > 0) {
      tableDiscRow.style.display = '';
      const typeStr = disc.type === 'percentage' ? `${disc.value}% del subtotal` : `monto fijo`;
      document.getElementById('table-disc-label').textContent =
        disc.description ? `Descuento — ${disc.description} (${typeStr})` : `Descuento — ${typeStr}`;
      document.getElementById('table-disc-value').textContent = '− ' + fmt(discountAmt);
    } else {
      tableDiscRow.style.display = 'none';
    }

    const retRow = document.getElementById('retention-row');
    if (inv.retention.enabled) {
      retRow.style.display = '';
      document.getElementById('retention-label').textContent =
        `${inv.retention.label} (${inv.retention.rate}%)`;
      document.getElementById('tot-retention').textContent = '− ' + fmt(retentionAmt);
    } else {
      retRow.style.display = 'none';
    }

    document.getElementById('tot-total').textContent = fmt(total);
  }

  function render() {
    const inv = state.invoice;
    const prov = state.provider;
    const settings = getSettings();
    applySettingsToPage(settings);

    document.getElementById('inv-doc-number').textContent = inv.documentNumber;
    document.getElementById('footer-doc').textContent = inv.documentNumber;
    const statusEl = document.getElementById('inv-status');
    statusEl.textContent = inv.status === 'paid' ? 'Pagado' : 'Pendiente de pago';
    statusEl.className = 'badge badge-dot ' + (inv.status === 'paid' ? 'badge-paid' : 'badge-pending');

    document.getElementById('prov-name').textContent = prov.name;
    document.getElementById('prov-detail').innerHTML =
      `${escapeHtml(prov.title)}<br>` +
      `NIT / CC: <span class="mono-val">${escapeHtml(prov.cc)}</span><br>` +
      (prov.rut ? `RUT: <span class="mono-val">${escapeHtml(prov.rut)}</span><br>` : '') +
      `<a href="mailto:${escapeHtml(prov.email)}">${escapeHtml(prov.email)}</a><br>` +
      `<span class="mono-val">${escapeHtml(prov.phone)}</span><br>${escapeHtml(prov.city)}`;

    document.getElementById('client-name').textContent = inv.client.name;
    document.getElementById('client-detail').innerHTML =
      `NIT: <span class="mono-val">${inv.client.nit}</span><br>Contacto: ${inv.client.contact}<br>` +
      `<a href="mailto:${inv.client.email}">${inv.client.email}</a><br>` +
      `${inv.client.address}<br>${inv.client.city}`;

    document.getElementById('inv-issued').textContent = fmtDate(inv.issuedAt);
    document.getElementById('inv-period').textContent = inv.servicePeriod;
    document.getElementById('inv-due').textContent = inv.dueDate ? fmtDate(inv.dueDate) : '—';

    document.getElementById('items-body').innerHTML = inv.items.map(item => `
      <tr>
        <td data-label="Descripción del servicio">
          <p class="item-name">${item.name}</p>
          ${item.description ? `<p class="item-desc">${item.description}</p>` : ''}
        </td>
        <td data-label="Cant.">${item.quantity}${item.unit && item.unit !== 'proyecto' ? ' ' + item.unit : ''}</td>
        <td data-label="Valor unitario">${fmt(item.unitPrice)}</td>
        <td data-label="Total">${fmt(item.quantity * item.unitPrice)}</td>
      </tr>
    `).join('');

    document.getElementById('inv-notes-text').textContent = inv.notes;

    document.getElementById('pay-bank').textContent = prov.bank;
    document.getElementById('pay-account-type').textContent = prov.accountType;
    document.getElementById('pay-account-number').textContent = prov.accountNumber;
    document.getElementById('pay-account-holder').textContent = prov.accountHolder;
    document.getElementById('pay-cc').textContent = prov.cc;
    document.getElementById('pay-rut').textContent = prov.rut || '';
    document.getElementById('pay-rut-row').style.display = prov.rut ? '' : 'none';
    document.getElementById('pay-nequi').textContent = prov.nequi;
    document.getElementById('pay-breve').textContent = prov.breve;

    const signatureBlock = document.getElementById('provider-signature-block');
    const signatureImg = document.getElementById('provider-signature-img');
    signatureBlock.style.display = prov.signatureDataUrl ? '' : 'none';
    if (prov.signatureDataUrl) {
      signatureImg.src = prov.signatureDataUrl;
      signatureImg.alt = `Firma de ${prov.name}`;
    }
    document.getElementById('provider-signature-name').textContent = prov.name;
    document.getElementById('provider-signature-id').textContent = [
      `CC / NIT: ${prov.cc}`,
      prov.rut ? `RUT: ${prov.rut}` : '',
    ].filter(Boolean).join(' · ');

    document.getElementById('footer-contact').textContent =
      `${prov.website} · ${prov.email} · ${prov.phone}`;

    updateTotals();

    const editLink = document.getElementById('btn-edit-current');
    if (editLink && currentRecord?.id) {
      editLink.href = `/editor?id=${encodeURIComponent(currentRecord.id)}`;
    }
  }

  document.getElementById('json-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(ev) {
      try {
        const parsed = JSON.parse(ev.target.result);
        currentRecord = await saveInvoice(parsed);
        state.invoice = currentRecord.invoice;
        render();
      } catch {
        alert('El archivo JSON no es válido o el número de documento ya existe.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-md').addEventListener('click', function() {
    const inv = state.invoice;
    const prov = state.provider;
    const settings = getSettings();
    const disc = inv.discount || {};
    const { subtotal, discountAmt, retentionAmt, total } = calcTotals(inv);

    const itemsTable = [
      '| Descripción | Cant. | Valor Unitario | Total |',
      '|---|---|---|---|',
      ...inv.items.map(it => {
        const qty = it.quantity + (it.unit && it.unit !== 'proyecto' ? ' ' + it.unit : '');
        return `| ${it.name} | ${qty} | ${fmt(it.unitPrice)} | ${fmt(it.quantity * it.unitPrice)} |`;
      })
    ].join('\n');

    let totalsLines = `- Subtotal: ${fmt(subtotal)}\n`;
    if (disc.enabled && discountAmt > 0) {
      const dLabel = disc.description || (disc.type === 'percentage' ? disc.value + '%' : 'monto fijo');
      totalsLines += `- Descuento (${dLabel}): − ${fmt(discountAmt)}\n`;
    }
    if (inv.retention.enabled) {
      totalsLines += `- ${inv.retention.label} (${inv.retention.rate}%): − ${fmt(retentionAmt)}\n`;
    }
    totalsLines += `- **Total a pagar: ${fmt(total)}**`;

    const md = [
      `# Cuenta de Cobro — ${inv.documentNumber}`,
      '',
      `**Estado:** ${inv.status === 'paid' ? 'Pagado' : 'Pendiente de pago'}`,
      `**Fecha de emisión:** ${fmtDate(inv.issuedAt)}`,
      `**Período de servicio:** ${inv.servicePeriod}`,
      `**Fecha límite de pago:** ${inv.dueDate ? fmtDate(inv.dueDate) : '—'}`,
      '', '---', '',
      '## Prestador', '',
      `- **Nombre:** ${prov.name}`,
      `- **CC / NIT:** ${prov.cc}`,
      prov.rut ? `- **RUT:** ${prov.rut}` : '',
      `- **Email:** ${prov.email}`,
      `- **Teléfono:** ${prov.phone}`,
      `- **Ciudad:** ${prov.city}`,
      '',
      '## Cliente', '',
      `- **Empresa:** ${inv.client.name}`,
      `- **NIT:** ${inv.client.nit}`,
      `- **Contacto:** ${inv.client.contact}`,
      `- **Email:** ${inv.client.email}`,
      `- **Dirección:** ${inv.client.address}, ${inv.client.city}`,
      '', '---', '',
      '## Servicios', '',
      itemsTable,
      '', '---', '',
      '## Totales', '',
      totalsLines,
      '', '---', '',
      '## Datos de Pago', '',
      `- **Banco:** ${prov.bank} — ${prov.accountType}`,
      `- **N.° Cuenta:** ${prov.accountNumber}`,
      `- **Titular:** ${prov.accountHolder}`,
      `- **CC / NIT:** ${prov.cc}`,
      prov.rut ? `- **RUT:** ${prov.rut}` : '',
      `- **Nequi / Daviplata:** ${prov.nequi}`,
      '', '---', '',
      '## Notas', '',
      inv.notes,
      '', '---', '',
      `*Generado por ${settings.brand.shortName} ${settings.brand.tagLine} · ${prov.email}*`,
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuenta-cobro-${inv.documentNumber}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });

  async function init() {
    registerPwa();
    state.provider = getProviderFromSettings();
    await migrateLegacyInvoice(state.invoice);

    const id = new URLSearchParams(window.location.search).get('id');
    currentRecord = id ? await getInvoiceRecord(id) : await getActiveInvoiceRecord();

    if (currentRecord) {
      state.invoice = currentRecord.invoice;
    }

    render();
  }

  init();
}
