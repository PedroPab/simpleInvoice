// ── Formatting utilities ───────────────────────────────────────

/** Format number as Colombian peso: $ 1.500.000 */
export function fmt(n: number): string {
  return '$ ' + Math.round(n).toLocaleString('es-CO');
}

/** Format ISO date string (YYYY-MM-DD) as long Spanish date.
 *  Empty / null → today's date. */
export function fmtDate(iso: string): string {
  if (!iso) {
    return new Date().toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Calculate invoice totals from raw data. */
export function calcTotals(inv: {
  items: { quantity: number; unitPrice: number }[];
  discount: { enabled: boolean; type: string; value: number };
  retention: { enabled: boolean; rate: number };
}) {
  const subtotal = inv.items.reduce(
    (s, it) => s + it.quantity * it.unitPrice, 0
  );
  let discountAmt = 0;
  if (inv.discount.enabled) {
    discountAmt = inv.discount.type === 'percentage'
      ? subtotal * (inv.discount.value / 100)
      : inv.discount.value;
  }
  const net = subtotal - discountAmt;
  const retentionAmt = inv.retention.enabled
    ? net * (inv.retention.rate / 100)
    : 0;
  const total = net - retentionAmt;
  return { subtotal, discountAmt, net, retentionAmt, total };
}
