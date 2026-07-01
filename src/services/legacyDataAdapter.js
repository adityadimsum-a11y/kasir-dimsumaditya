import { normalizeDate, numberValue, upper } from '../utils/erpNewSchemaMap';

const asArray = (value) => Array.isArray(value) ? value : [];
const compact = (items) => items.filter(Boolean);
const unique = (items) => Array.from(new Set(compact(items).map((item) => String(item))));

const getLocationScope = (user = {}) => {
  return user.location_id || user.branch_id || 'LOC-TGR';
};

const isOwner = (user = {}) => {
  return upper(user.branch_type).includes('HQ') || upper(user.role).includes('OWNER') || upper(user.role_id).includes('OWNER');
};

const filterHomeScope = (rows, user = {}) => {
  // Untuk Home Owner: default tetap lokasi login/Tangerang.
  // Data all-branch tetap tersedia via *_all agar Monitoring Cabang/CCTV bisa baca semua.
  const locationId = getLocationScope(user);
  return asArray(rows).filter((row) => {
    const rowLocation = row.location_id || row.branch_id || row.source_location_id || row.from_location_id || '';
    if (!rowLocation) return true;
    return String(rowLocation) === String(locationId);
  });
};

const mapLocationToBranch = (location = {}) => ({
  id: location.location_id || location.id || location.branch_id,
  branch_id: location.location_id || location.branch_id || location.id,
  branch_name: location.location_name || location.name || location.branch_name || location.location_code || 'Cabang',
  branch_type: location.location_type || location.branch_type || location.type || 'BRANCH',
  location_code: location.location_code || location.code || '',
  isDeleted: false,
  ...location,
});

const mapProduct = (product = {}) => ({
  id: product.product_id || product.id,
  product_id: product.product_id || product.id,
  name: product.product_name || product.name || product.item_name || '',
  product_name: product.product_name || product.name || product.item_name || '',
  category: product.category || product.product_category || '',
  selling_price: numberValue(product.selling_price || product.price || product.retail_price || product.default_price),
  retail_price: numberValue(product.retail_price || product.selling_price || product.price || product.default_price),
  wholesale_price: numberValue(product.wholesale_price || product.selling_price || product.price || product.default_price),
  unit: product.unit || product.default_unit || 'pcs',
  status: product.status || 'Active',
  isDeleted: false,
  ...product,
});

const mapCustomer = (customer = {}) => ({
  id: customer.customer_id || customer.id,
  customer_id: customer.customer_id || customer.id,
  name: customer.customer_name || customer.name || '',
  customer_name: customer.customer_name || customer.name || '',
  phone: customer.phone || customer.phone_number || '',
  address: customer.address || '',
  category: customer.category || customer.customer_type || '',
  status: customer.status || 'Active',
  isDeleted: false,
  ...customer,
});

const mapSupplier = (supplier = {}) => ({
  id: supplier.supplier_id || supplier.id,
  supplier_id: supplier.supplier_id || supplier.id,
  name: supplier.supplier_name || supplier.name || supplier.vendor_name || '',
  supplier_name: supplier.supplier_name || supplier.name || supplier.vendor_name || '',
  vendor_name: supplier.vendor_name || supplier.supplier_name || supplier.name || '',
  status: supplier.status || 'Active',
  isDeleted: false,
  ...supplier,
});

const buildItemsByOrder = (items = []) => {
  return asArray(items).reduce((map, item) => {
    const orderId = item.order_id || item.source_id || item.parent_id;
    if (!orderId) return map;
    if (!map[orderId]) map[orderId] = [];
    map[orderId].push({
      id: item.order_item_id || item.item_id || item.id,
      product_id: item.product_id || item.item_id || '',
      name: item.product_name || item.item_name || item.name || '',
      product_name: item.product_name || item.item_name || item.name || '',
      item_name: item.item_name || item.product_name || item.name || '',
      qty: numberValue(item.qty || item.quantity),
      unit: item.unit || 'pcs',
      price: numberValue(item.unit_price || item.price),
      unit_price: numberValue(item.unit_price || item.price),
      subtotal: numberValue(item.line_total || item.subtotal || item.total),
      total: numberValue(item.line_total || item.subtotal || item.total),
      ...item,
    });
    return map;
  }, {});
};

const buildPaymentsByInvoice = (payments = []) => {
  return asArray(payments).reduce((map, payment) => {
    const invoiceId = payment.invoice_id || payment.source_id || payment.order_id || '-';
    if (!map[invoiceId]) map[invoiceId] = [];
    map[invoiceId].push(payment);
    return map;
  }, {});
};

const mapOrder = (order = {}, context = {}) => {
  const { orderItemsByOrder, invoicesByOrder, paymentsByInvoice, receivablesByInvoice } = context;
  const orderId = order.order_id || order.id || order.order_no;
  const orderItems = orderItemsByOrder[orderId] || [];
  const invoice = invoicesByOrder[orderId] || {};
  const invoiceId = invoice.invoice_id || invoice.id || '';
  const payments = paymentsByInvoice[invoiceId] || [];
  const paidAmount = payments.reduce((sum, payment) => sum + numberValue(payment.amount || payment.payment_amount), 0);
  const totalAmount = numberValue(invoice.grand_total || order.grand_total || order.total_amount || order.total);
  const receivable = receivablesByInvoice[invoiceId] || {};
  const remainingAmount = numberValue(receivable.remaining_amount || receivable.sisa_piutang || Math.max(totalAmount - paidAmount, 0));
  const paymentStatus = invoice.payment_status || order.payment_status || receivable.payment_status || (remainingAmount <= 0 && totalAmount > 0 ? 'Lunas' : 'Piutang/Belum Bayar');

  return {
    id: orderId,
    order_id: orderId,
    order_no: order.order_no || orderId,
    date: normalizeDate(order.order_date || order.date || order.created_at),
    order_date: order.order_date || order.date || order.created_at,
    branch_id: order.location_id || order.branch_id || '',
    location_id: order.location_id || order.branch_id || '',
    customer_id: order.customer_id || '',
    customer_name: order.customer_name || order.customer_manual || order.customer || '',
    channel: order.channel || order.sales_channel || '',
    order_type: order.order_type || order.type || '',
    pickup_date: order.pickup_date || order.delivery_date || '',
    items: JSON.stringify(orderItems),
    items_json: JSON.stringify(orderItems),
    total_amount: totalAmount,
    total: totalAmount,
    grand_total: totalAmount,
    amount_paid: paidAmount,
    paid_amount: paidAmount,
    remaining_amount: remainingAmount,
    payment_status: paymentStatus,
    status: order.status || order.order_status || 'Active',
    invoice_id: invoiceId,
    invoice_no: invoice.invoice_no || invoiceId,
    isDeleted: false,
    ...order,
  };
};

const mapPayment = (payment = {}) => ({
  id: payment.payment_id || payment.id,
  payment_id: payment.payment_id || payment.id,
  date: normalizeDate(payment.payment_date || payment.date || payment.created_at),
  branch_id: payment.location_id || payment.branch_id || '',
  location_id: payment.location_id || payment.branch_id || '',
  order_id: payment.order_id || '',
  invoice_id: payment.invoice_id || payment.source_id || '',
  method: payment.payment_method || payment.method || '',
  payment_method: payment.payment_method || payment.method || '',
  amount: numberValue(payment.amount || payment.payment_amount || payment.nominal),
  description: payment.notes || payment.description || '',
  status: payment.status || 'Active',
  isDeleted: false,
  ...payment,
});

const mapWalletMutationToCashflow = (mutation = {}) => ({
  id: mutation.mutation_id || mutation.id,
  date: normalizeDate(mutation.mutation_date || mutation.date || mutation.created_at),
  branch_id: mutation.location_id || mutation.branch_id || '',
  location_id: mutation.location_id || mutation.branch_id || '',
  type: mutation.direction || mutation.mutation_type || '',
  category: mutation.mutation_type || mutation.category || '',
  method: mutation.wallet_id || mutation.method || '',
  amount: numberValue(mutation.amount),
  description: mutation.notes || mutation.description || '',
  reference_table: mutation.source_module || '',
  reference_id: mutation.source_id || '',
  status: mutation.status || 'Active',
  isDeleted: false,
  ...mutation,
});

const mapCashExpense = (expense = {}, items = []) => ({
  id: expense.expense_id || expense.id,
  expense_id: expense.expense_id || expense.id,
  date: normalizeDate(expense.expense_date || expense.date || expense.created_at),
  branch_id: expense.location_id || expense.branch_id || '',
  location_id: expense.location_id || expense.branch_id || '',
  category: expense.category || 'Operasional',
  method: expense.payment_method || expense.method || '',
  payment_method: expense.payment_method || expense.method || '',
  amount: numberValue(expense.amount || expense.total_amount),
  total_amount: numberValue(expense.amount || expense.total_amount),
  description: expense.description || expense.notes || expense.items_summary || '',
  items: JSON.stringify(items),
  notes: expense.notes || '',
  wallet_id: expense.wallet_id || '',
  status: expense.status || 'Active',
  isDeleted: false,
  ...expense,
});

const mapPayableToSupplierLedger = (payable = {}, payments = []) => ({
  id: payable.payable_id || payable.id,
  payable_id: payable.payable_id || payable.id,
  date: normalizeDate(payable.payable_date || payable.date || payable.created_at),
  branch_id: payable.location_id || payable.branch_id || '',
  location_id: payable.location_id || payable.branch_id || '',
  supplier_id: payable.supplier_id || '',
  supplier_name: payable.vendor_name || payable.supplier_name || payable.payee || '',
  vendor_name: payable.vendor_name || payable.supplier_name || payable.payee || '',
  amount: numberValue(payable.original_amount || payable.amount),
  original_amount: numberValue(payable.original_amount || payable.amount),
  paid_amount: numberValue(payable.paid_amount) || payments.reduce((sum, p) => sum + numberValue(p.amount), 0),
  remaining_amount: numberValue(payable.remaining_amount) || Math.max(numberValue(payable.original_amount || payable.amount) - payments.reduce((sum, p) => sum + numberValue(p.amount), 0), 0),
  status: payable.payment_status || payable.status || 'Open',
  description: payable.notes || '',
  notes: payable.notes || '',
  isDeleted: false,
  ...payable,
});


const isActiveRow = (row = {}) => {
  const status = upper(row.status || row.is_active || 'Active');
  const deleted = row.isDeleted === true || upper(row.is_deleted || row.deleted || row.isDeleted) === 'TRUE';
  return !deleted && status !== 'VOID' && status !== 'CANCELLED' && status !== 'INACTIVE';
};

const mapStockMovementToInventoryLayer = (movement = {}) => {
  const direction = upper(movement.direction || movement.movement_direction || 'IN');
  const itemType = upper(movement.item_type || movement.category || movement.stock_type || 'PRODUK_JADI');
  const qtyRaw = numberValue(movement.qty || movement.quantity || movement.qty_effect || movement.qty_remaining);
  const qtyEffectRaw = movement.qty_effect !== undefined && movement.qty_effect !== ''
    ? numberValue(movement.qty_effect)
    : (direction === 'OUT' ? -Math.abs(qtyRaw) : Math.abs(qtyRaw));

  const isFinishedGood = itemType.includes('FINISHED') || itemType.includes('PRODUK') || itemType.includes('JADI') || itemType.includes('DIMSUM');
  const status = isFinishedGood ? 'ACTIVE' : (direction === 'OUT' ? 'USED_IN_PRODUCTION' : 'ACTIVE');

  return {
    id: movement.movement_id || movement.id,
    date: normalizeDate(movement.movement_date || movement.date || movement.created_at),
    branch_id: movement.location_id || movement.branch_id || '',
    location_id: movement.location_id || movement.branch_id || '',
    category: isFinishedGood ? 'PRODUK_JADI' : 'BAHAN_BAKU',
    item_name: movement.item_name || movement.product_name || movement.material_name || '',
    product_id: movement.product_id || '',
    qty_received: direction === 'IN' ? Math.abs(qtyEffectRaw) : 0,
    qty_remaining: qtyEffectRaw,
    unit_cost: numberValue(movement.unit_cost || movement.hpp_per_unit || movement.hpp || 0),
    unit: movement.unit || 'pcs',
    status,
    direction,
    reference_id: movement.source_id || movement.reference_id || movement.production_id || movement.order_id || '',
    source_module: movement.source_module || '',
    notes: movement.notes || '',
    isDeleted: !isActiveRow(movement),
    ...movement,
  };
};

const mapProductionBatchToPemalang = (batch = {}) => {
  const adukanQty = numberValue(batch.adukan_qty || batch.adukan || batch.total_adukan);
  const actualPcs = numberValue(batch.actual_pcs || batch.actual_output_pcs || batch.qty || batch.output_qty);
  const chickenKg = numberValue(batch.chicken_kg_used || batch.ayam_kg || (adukanQty * 30));
  const productName = batch.product_name || batch.item_name || 'DIMSUM ORIGINAL';

  const items = [{
    name: productName,
    qty: actualPcs,
    adukan: adukanQty,
    ayam_kg: chickenKg,
    notes: batch.notes || '-',
    is_v2: true,
  }];

  return {
    id: batch.production_id || batch.batch_id || batch.id,
    production_id: batch.production_id || batch.batch_id || batch.id,
    date: normalizeDate(batch.production_date || batch.date || batch.created_at),
    branch_id: batch.location_id || batch.branch_id || '',
    location_id: batch.location_id || batch.branch_id || '',
    customer_name: 'PRODUKSI_ADUKAN',
    sales_channel: 'PRODUCTION_YIELD',
    items: JSON.stringify(items),
    items_json: JSON.stringify(items),
    qty: actualPcs,
    total_amount: 0,
    amount_paid: 0,
    payment_method: 'SISTEM_PRODUKSI',
    status: batch.status || 'POSTED',
    notes: batch.notes || '',
    item_name: productName,
    pic: batch.pic_name || batch.pic || '',
    isDeleted: !isActiveRow(batch),
    ...batch,
  };
};

const buildMapById = (rows, idField) => {
  return asArray(rows).reduce((map, row) => {
    const id = row[idField] || row.id;
    if (id) map[id] = row;
    return map;
  }, {});
};

export function adaptLegacyBootstrap(rawData = {}, options = {}) {
  const user = options.user || rawData.user || {};
  const defaultDbData = options.defaultDbData || {};

  const locations = asArray(rawData.locations).map(mapLocationToBranch);
  const products = asArray(rawData.products).map(mapProduct);
  const customers = asArray(rawData.customers).map(mapCustomer);
  const suppliers = asArray(rawData.suppliers).map(mapSupplier);

  const orderItemsByOrder = buildItemsByOrder(rawData.order_items);
  const invoicesByOrder = asArray(rawData.invoices).reduce((map, invoice) => {
    const orderId = invoice.order_id || invoice.source_id || '';
    if (orderId && !map[orderId]) map[orderId] = invoice;
    return map;
  }, {});
  const paymentsByInvoice = buildPaymentsByInvoice(rawData.payments);
  const receivablesByInvoice = asArray(rawData.receivables).reduce((map, row) => {
    const invoiceId = row.invoice_id || row.source_id || '';
    if (invoiceId) map[invoiceId] = row;
    return map;
  }, {});

  const mappedOrdersAll = asArray(rawData.orders).map((order) => mapOrder(order, {
    orderItemsByOrder,
    invoicesByOrder,
    paymentsByInvoice,
    receivablesByInvoice,
  }));

  const mappedPaymentsAll = asArray(rawData.payments).map(mapPayment);
  const mappedCashflowAll = asArray(rawData.wallet_mutations).map(mapWalletMutationToCashflow);

  const itemsByExpense = asArray(rawData.cash_expense_items).reduce((map, item) => {
    const expenseId = item.expense_id || item.source_id;
    if (!expenseId) return map;
    if (!map[expenseId]) map[expenseId] = [];
    map[expenseId].push(item);
    return map;
  }, {});

  const mappedExpensesAll = asArray(rawData.cash_expenses).map((expense) => {
    const id = expense.expense_id || expense.id;
    return mapCashExpense(expense, itemsByExpense[id] || []);
  });

  const payablePaymentsByPayable = asArray(rawData.payable_payments).reduce((map, payment) => {
    const payableId = payment.payable_id || '';
    if (!payableId) return map;
    if (!map[payableId]) map[payableId] = [];
    map[payableId].push(payment);
    return map;
  }, {});

  const mappedSupplierLedgerAll = asArray(rawData.payables).map((payable) => {
    const id = payable.payable_id || payable.id;
    return mapPayableToSupplierLedger(payable, payablePaymentsByPayable[id] || []);
  });

  const mappedInventoryLayersAll = asArray(rawData.stock_movements).map(mapStockMovementToInventoryLayer);
  const mappedProductionBatchesAll = asArray(rawData.production_batches).map(mapProductionBatchToPemalang);
  const scopedInventoryLayers = filterHomeScope(mappedInventoryLayersAll, user);
  const scopedProductionBatches = filterHomeScope(mappedProductionBatchesAll, user);

  const branchSettlementsAll = asArray(rawData.branch_deposits).map((deposit) => ({
    id: deposit.deposit_id || deposit.settlement_id || deposit.id,
    settlement_id: deposit.deposit_id || deposit.settlement_id || deposit.id,
    date: normalizeDate(deposit.deposit_date || deposit.report_date || deposit.created_at),
    branch_id: deposit.location_id || deposit.branch_id || deposit.source_location_id || '',
    amount: numberValue(deposit.deposit_amount || deposit.amount || deposit.total_deposit || deposit.nominal_setor),
    nominal: numberValue(deposit.deposit_amount || deposit.amount || deposit.total_deposit || deposit.nominal_setor),
    status: deposit.status || deposit.approval_status || '',
    notes: deposit.notes || '',
    isDeleted: false,
    ...deposit,
  }));

  const scopedOrders = filterHomeScope(mappedOrdersAll, user);
  const scopedPayments = filterHomeScope(mappedPaymentsAll, user);
  const scopedCashflow = filterHomeScope(mappedCashflowAll, user);
  const scopedExpenses = filterHomeScope(mappedExpensesAll, user);
  const scopedSupplierLedger = filterHomeScope(mappedSupplierLedgerAll, user);

  return {
    ...defaultDbData,

    // Default main arrays: scope login/home supaya Dashboard Owner Tangerang tidak campur cabang.
    orders: scopedOrders,
    orders_data: scopedOrders,
    payments: scopedPayments,
    cashflow_transactions: scopedCashflow,
    cashflowTransactions: scopedCashflow,
    expenses: scopedExpenses,
    expenses_data: scopedExpenses,
    supplier_ledger: scopedSupplierLedger,
    supplierLedger: scopedSupplierLedger,

    // All branch arrays untuk CCTV/monitoring cabang.
    all_orders: mappedOrdersAll,
    all_payments: mappedPaymentsAll,
    all_cashflow_transactions: mappedCashflowAll,
    all_expenses: mappedExpensesAll,
    all_supplier_ledger: mappedSupplierLedgerAll,
    all_branch_settlements: branchSettlementsAll,

    // Compatibility: beberapa komponen monitoring lama baca key utama untuk semua cabang.
    // Owner tetap bisa CCTV dari master branch + all_*; dashboard tetap pakai scoped arrays.
    monitoring_orders: mappedOrdersAll,
    monitoring_expenses: mappedExpensesAll,
    monitoring_cashflow_transactions: mappedCashflowAll,

    purchases: [],
    purchases_data: [],
    pemalang: scopedProductionBatches,
    pemalangReports: scopedProductionBatches,
    all_pemalang: mappedProductionBatchesAll,
    production_logs: mappedProductionBatchesAll,
    inventoryCostLayers: scopedInventoryLayers,
    inventory_cost_layers: scopedInventoryLayers,
    all_inventory_cost_layers: mappedInventoryLayersAll,
    stockMovements: asArray(rawData.stock_movements),
    stock_movements: asArray(rawData.stock_movements),
    stokData: asArray(rawData.stock_balances),
    stok_data: asArray(rawData.stock_balances),
    productionBatches: asArray(rawData.production_batches),
    production_batches: asArray(rawData.production_batches),

    branch_settlements: branchSettlementsAll,
    interbranch_treasury: branchSettlementsAll,

    master_branches: locations,
    masterBranches: locations,
    master_locations: locations,
    master_products: products,
    masterProducts: products,
    master_customers: customers,
    masterCustomers: customers,
    master_suppliers: suppliers,
    masterSuppliers: suppliers,

    invoices: asArray(rawData.invoices),
    order_items: asArray(rawData.order_items),
    receivables: asArray(rawData.receivables),
    wallets: asArray(rawData.wallets),
    wallet_mutations: asArray(rawData.wallet_mutations),
    cash_expense_items: asArray(rawData.cash_expense_items),
    payables: asArray(rawData.payables),
    payable_payments: asArray(rawData.payable_payments),
    archives: asArray(rawData.archives),
    search_index: asArray(rawData.search_index),
  };
}
