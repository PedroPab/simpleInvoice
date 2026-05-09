// ── Quote (Cotización) data types ──────────────────────────────

export interface QuoteItem {
  tag: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface QuoteDiscount {
  enabled: boolean;
  description: string;
  amount: number;
}

export interface QuotePhase {
  name: string;
  time: string;
  bullets: string[];
}

export interface QuotePaymentStep {
  percentage: number;
  name: string;
  description: string;
}

export interface QuoteClient {
  name: string;
  nit: string;
  contact: string;
  email: string;
  address: string;
  city: string;
}

export interface QuoteTimingRow {
  phase: string;
  time: string;
}

export interface Quote {
  documentNumber: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  issuedAt: string;
  validDays: number;
  projectName: string;
  client: QuoteClient;
  summary: string;
  objectives: {
    problem: string;
    result: string;
    delivery: string;
  };
  scope: string[];
  items: QuoteItem[];
  discount: QuoteDiscount;
  phases: QuotePhase[];
  deliverables: string[];
  exclusions: string[];
  timingRows: QuoteTimingRow[];
  timingTotal: string;
  paymentSteps: QuotePaymentStep[];
  conditions: string[];
  notes: string;
}
