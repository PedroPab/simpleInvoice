// ── Invoice data types ─────────────────────────────────────────

export interface InvoiceItem {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface InvoiceDiscount {
  enabled: boolean;
  type: 'percentage' | 'fixed';
  value: number;
  description?: string;
}

export interface InvoiceRetention {
  enabled: boolean;
  rate: number;
  label: string;
}

export interface InvoiceClient {
  name: string;
  nit: string;
  contact: string;
  email: string;
  address: string;
  city: string;
}

export interface Invoice {
  documentNumber: string;
  status: 'pending' | 'paid';
  issuedAt: string;
  servicePeriod: string;
  dueDate: string;
  client: InvoiceClient;
  items: InvoiceItem[];
  discount: InvoiceDiscount;
  retention: InvoiceRetention;
  notes: string;
}

export interface Provider {
  name: string;
  title: string;
  cc: string;
  email: string;
  phone: string;
  city: string;
  website: string;
  bank: string;
  accountType: string;
  accountNumber: string;
  accountHolder: string;
  nequi: string;
  breve: string;
}

export interface BrandSettings {
  shortName: string;
  tagLine: string;
  logoDataUrl: string;
  primaryColor: string;
  primaryDarkColor: string;
  accentColor: string;
  darkColor: string;
  backgroundColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  monoFont: string;
}

export interface DocumentSettings {
  typeLabel: string;
  title: string;
  subtitle: string;
}

export interface AppSettings {
  version: number;
  provider: Provider;
  brand: BrandSettings;
  document: DocumentSettings;
}
