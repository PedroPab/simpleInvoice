import {
  applySettingsToPage,
  getSettings,
} from '../app-settings.js';
import {
  deleteInvoiceRecord,
  listInvoices,
  migrateLegacyInvoice,
  registerPwa,
} from '../invoice-store.js';

function fmtDate(iso) {
  if (!iso) return 'Sin fecha';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSearchHaystack(record) {
  const client = record.invoice?.client || {};
  return normalize([
    record.title,
    record.documentNumber,
    client.name,
    client.nit,
    client.contact,
    client.email,
  ].join(' '));
}

function groupByClient(records) {
  const groups = new Map();
  records.forEach(record => {
    const name = record.invoice?.client?.name?.trim() || 'Cliente sin nombre';
    if (!groups.has(record.clientKey)) groups.set(record.clientKey, { name, records: [] });
    groups.get(record.clientKey).records.push(record);
  });
  return Array.from(groups.values());
}

function renderEmptyState(query) {
  return `
    <div class="empty-state">
      <strong>No hay cuentas para mostrar</strong>
      <p>${query ? 'Prueba con otra búsqueda.' : 'Crea tu primera cuenta de cobro desde el editor.'}</p>
    </div>
  `;
}

function renderInvoiceRow(record) {
  const client = record.invoice?.client || {};
  return `
    <article class="invoice-row">
      <div>
        <p class="invoice-title">${escapeHtml(record.title)}</p>
        <div class="invoice-meta">
          <span>${escapeHtml(record.documentNumber)}</span>
          <span>${escapeHtml(client.nit || 'Sin NIT')}</span>
          <span>Actualizada ${fmtDate(record.updatedAt)}</span>
        </div>
      </div>
      <div class="invoice-actions">
        <a class="btn btn-primary btn-sm" href="/cuenta?id=${encodeURIComponent(record.id)}">Ver</a>
        <a class="btn btn-ghost btn-sm" href="/editor?id=${encodeURIComponent(record.id)}">Editar</a>
        <a class="btn btn-ghost btn-sm" href="/editor?duplicate=${encodeURIComponent(record.id)}">Duplicar</a>
        <button class="btn btn-ghost btn-sm danger-btn" data-delete-id="${escapeHtml(record.id)}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderClientGroup(group) {
  return `
    <section class="client-group">
      <div class="client-heading">
        <div class="client-name">${escapeHtml(group.name)}</div>
        <div class="client-count">${group.records.length} cuenta${group.records.length === 1 ? '' : 's'}</div>
      </div>
      ${group.records.map(renderInvoiceRow).join('')}
    </section>
  `;
}

export function initHistoryPage(defaultInvoice) {
  let invoices = [];
  const root = document.getElementById('history-root');
  const search = document.getElementById('history-search');

  function render() {
    const query = normalize(search.value);
    const filtered = query
      ? invoices.filter(record => getSearchHaystack(record).includes(query))
      : invoices;

    root.innerHTML = filtered.length
      ? groupByClient(filtered).map(renderClientGroup).join('')
      : renderEmptyState(query);
  }

  async function refresh() {
    invoices = await listInvoices();
    render();
  }

  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-delete-id]');
    if (!button) return;

    const id = button.getAttribute('data-delete-id');
    const record = invoices.find(item => item.id === id);
    if (!confirm(`¿Eliminar ${record?.documentNumber || 'esta cuenta'}? Esta acción no se puede deshacer.`)) {
      return;
    }

    await deleteInvoiceRecord(id);
    await refresh();
  });

  search.addEventListener('input', render);

  registerPwa();
  applySettingsToPage(getSettings());
  migrateLegacyInvoice(defaultInvoice).then(refresh);
}
