export const LEGACY_TABLE_KEYS = {
  ORDERS: ['orders', 'orders_data'],
  PAYMENTS: ['payments'],
  EXPENSES: ['expenses', 'expenses_data'],
  CASHFLOW: ['cashflow_transactions', 'cashflowTransactions'],
  SUPPLIER_LEDGER: ['supplier_ledger', 'supplierLedger'],
  BRANCHES: ['master_branches', 'masterBranches'],
  PRODUCTS: ['master_products', 'masterProducts'],
  CUSTOMERS: ['master_customers', 'masterCustomers'],
  SUPPLIERS: ['master_suppliers', 'masterSuppliers'],
};

export const normalizeDate = (value) => {
  if (!value) return '';
  const raw = String(value);
  if (raw.length >= 10 && raw[4] === '-' && raw[7] === '-') return raw.substring(0, 10);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw.substring(0, 10);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const numberValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const clean = String(value ?? '0').replace(/[^0-9.-]/g, '');
  const parsed = Number(clean || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const upper = (value) => String(value || '').toUpperCase().trim();
