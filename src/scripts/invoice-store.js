const DB_NAME = 'cuenta-cobro-db';
const DB_VERSION = 1;
const STORE_NAME = 'invoices';
const ACTIVE_KEY = 'cuentaCobroActiveId';
const LEGACY_KEY = 'cuentaCobro';
const MIGRATION_KEY = 'cuentaCobroMigratedToIndexedDB';

let dbPromise;

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('documentNumber', 'documentNumber', { unique: true });
        store.createIndex('clientKey', 'clientKey', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function txStore(db, mode = 'readonly') {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function allFromIndex(index) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const request = index.openCursor(null, 'prev');
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(rows);
        return;
      }
      rows.push(cursor.value);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sin-cliente';
}

function cleanNit(value) {
  return String(value || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
}

function cloneData(value) {
  if (globalThis.structuredClone) return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function getClientKey(invoice) {
  const nit = cleanNit(invoice?.client?.nit);
  return nit ? `nit-${nit}` : `name-${normalizeText(invoice?.client?.name)}`;
}

export function getInvoiceTitle(invoice) {
  const clientName = invoice?.client?.name?.trim() || 'Cliente sin nombre';
  const number = invoice?.documentNumber?.trim() || 'Sin numero';
  return `Cuenta de cobro - ${clientName} - ${number}`;
}

export function createInvoiceId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `inv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseDocumentNumber(documentNumber) {
  const match = String(documentNumber || '').match(/^CC-(\d{4})-(\d{3,})$/i);
  if (!match) return null;
  return { year: Number(match[1]), sequence: Number(match[2]) };
}

export async function listInvoices() {
  const db = await openDatabase();
  const store = txStore(db);
  const index = store.index('updatedAt');
  return allFromIndex(index);
}

export async function getInvoiceRecord(id) {
  if (!id) return null;
  const db = await openDatabase();
  return promisify(txStore(db).get(id));
}

export async function getLatestInvoiceRecord() {
  const invoices = await listInvoices();
  return invoices[0] || null;
}

export async function getActiveInvoiceRecord() {
  const activeId = localStorage.getItem(ACTIVE_KEY);
  return (await getInvoiceRecord(activeId)) || getLatestInvoiceRecord();
}

export async function getNextDocumentNumber(year = new Date().getFullYear()) {
  const invoices = await listInvoices();
  const maxSequence = invoices.reduce((max, record) => {
    const parsed = parseDocumentNumber(record.documentNumber);
    if (!parsed || parsed.year !== year) return max;
    return Math.max(max, parsed.sequence);
  }, 0);
  return `CC-${year}-${String(maxSequence + 1).padStart(3, '0')}`;
}

async function getByDocumentNumber(documentNumber) {
  const db = await openDatabase();
  const index = txStore(db).index('documentNumber');
  return promisify(index.get(documentNumber));
}

export async function saveInvoice(invoice, options = {}) {
  const db = await openDatabase();
  const now = new Date().toISOString();
  const id = options.id || createInvoiceId();
  const existing = options.id ? await getInvoiceRecord(options.id) : null;
  const nextInvoice = cloneData(invoice);

  if (!nextInvoice.documentNumber || options.forceNewNumber) {
    nextInvoice.documentNumber = await getNextDocumentNumber();
  }

  const duplicate = await getByDocumentNumber(nextInvoice.documentNumber);
  if (duplicate && duplicate.id !== id) {
    const error = new Error(`Ya existe una cuenta con el numero ${nextInvoice.documentNumber}.`);
    error.code = 'DUPLICATE_DOCUMENT_NUMBER';
    throw error;
  }

  const record = {
    id,
    documentNumber: nextInvoice.documentNumber,
    title: getInvoiceTitle(nextInvoice),
    clientKey: getClientKey(nextInvoice),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    invoice: nextInvoice,
  };

  await promisify(txStore(db, 'readwrite').put(record));
  localStorage.setItem(ACTIVE_KEY, id);
  return record;
}

export async function deleteInvoiceRecord(id) {
  if (!id) return;
  const db = await openDatabase();
  await promisify(txStore(db, 'readwrite').delete(id));
  if (localStorage.getItem(ACTIVE_KEY) === id) {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

export async function duplicateInvoiceRecord(id) {
  const record = await getInvoiceRecord(id);
  if (!record) return null;
  const invoice = cloneData(record.invoice);
  invoice.documentNumber = await getNextDocumentNumber();
  return saveInvoice(invoice, { forceNewNumber: true });
}

export async function migrateLegacyInvoice(defaultInvoice) {
  if (localStorage.getItem(MIGRATION_KEY) === '1') return null;

  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATION_KEY, '1');
      return null;
    }

    const invoice = JSON.parse(raw);
    const candidate = invoice?.documentNumber ? invoice : defaultInvoice;
    const duplicate = candidate?.documentNumber
      ? await getByDocumentNumber(candidate.documentNumber)
      : null;
    const record = duplicate || await saveInvoice(candidate);
    localStorage.setItem(ACTIVE_KEY, record.id);
    localStorage.setItem(MIGRATION_KEY, '1');
    return record;
  } catch {
    localStorage.setItem(MIGRATION_KEY, '1');
    return null;
  }
}

export function registerPwa() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}
