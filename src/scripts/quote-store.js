const DB_NAME = 'cotizacion-db';
const DB_VERSION = 1;
const STORE_NAME = 'quotes';
const ACTIVE_KEY = 'cotizacionActiveId';

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
      if (!cursor) { resolve(rows); return; }
      rows.push(cursor.value);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sin-cliente';
}

function cleanNit(value) {
  return String(value || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
}

function cloneData(value) {
  if (globalThis.structuredClone) return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function getClientKey(quote) {
  const nit = cleanNit(quote?.client?.nit);
  return nit ? `nit-${nit}` : `name-${normalizeText(quote?.client?.name)}`;
}

export function getQuoteTitle(quote) {
  const clientName = quote?.client?.name?.trim() || 'Cliente sin nombre';
  const number = quote?.documentNumber?.trim() || 'Sin número';
  return `Cotización - ${clientName} - ${number}`;
}

export function createQuoteId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `cot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseDocumentNumber(documentNumber) {
  const match = String(documentNumber || '').match(/^COT-(\d{4})-(\d{3,})$/i);
  if (!match) return null;
  return { year: Number(match[1]), sequence: Number(match[2]) };
}

export async function listQuotes() {
  const db = await openDatabase();
  const store = txStore(db);
  const index = store.index('updatedAt');
  return allFromIndex(index);
}

export async function getQuoteRecord(id) {
  if (!id) return null;
  const db = await openDatabase();
  return promisify(txStore(db).get(id));
}

export async function getLatestQuoteRecord() {
  const quotes = await listQuotes();
  return quotes[0] || null;
}

export async function getActiveQuoteRecord() {
  const activeId = localStorage.getItem(ACTIVE_KEY);
  return (await getQuoteRecord(activeId)) || getLatestQuoteRecord();
}

export async function getNextDocumentNumber(year = new Date().getFullYear()) {
  const quotes = await listQuotes();
  const maxSequence = quotes.reduce((max, record) => {
    const parsed = parseDocumentNumber(record.documentNumber);
    if (!parsed || parsed.year !== year) return max;
    return Math.max(max, parsed.sequence);
  }, 0);
  return `COT-${year}-${String(maxSequence + 1).padStart(3, '0')}`;
}

async function getByDocumentNumber(documentNumber) {
  const db = await openDatabase();
  const index = txStore(db).index('documentNumber');
  return promisify(index.get(documentNumber));
}

export async function saveQuote(quote, options = {}) {
  const db = await openDatabase();
  const now = new Date().toISOString();
  const id = options.id || createQuoteId();
  const existing = options.id ? await getQuoteRecord(options.id) : null;
  const nextQuote = cloneData(quote);

  if (!nextQuote.documentNumber || options.forceNewNumber) {
    nextQuote.documentNumber = await getNextDocumentNumber();
  }

  const duplicate = await getByDocumentNumber(nextQuote.documentNumber);
  if (duplicate && duplicate.id !== id) {
    const error = new Error(`Ya existe una cotización con el número ${nextQuote.documentNumber}.`);
    error.code = 'DUPLICATE_DOCUMENT_NUMBER';
    throw error;
  }

  const record = {
    id,
    documentNumber: nextQuote.documentNumber,
    title: getQuoteTitle(nextQuote),
    clientKey: getClientKey(nextQuote),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    quote: nextQuote,
  };

  await promisify(txStore(db, 'readwrite').put(record));
  localStorage.setItem(ACTIVE_KEY, id);
  return record;
}

export async function deleteQuoteRecord(id) {
  if (!id) return;
  const db = await openDatabase();
  await promisify(txStore(db, 'readwrite').delete(id));
  if (localStorage.getItem(ACTIVE_KEY) === id) {
    localStorage.removeItem(ACTIVE_KEY);
  }
}
