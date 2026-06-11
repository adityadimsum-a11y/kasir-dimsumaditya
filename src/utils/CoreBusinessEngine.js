// src/utils/CoreBusinessEngine.js

export const CORE_BUSINESS_RULES = {
  ayamDropKg: 1020,
  ayamPricePerKg: 37500,
  batchPerDrop: 34,
  pcsPerBatch: 1000,
  targetDaysPerDrop: 3,

  allocation: {
    ayamReserve: 0.55,
    operational: 0.20,
    investment: 0.10,
    netProfit: 0.15,
  },
};

export function toNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

export function getOrderRevenue(order) {
  if (!order || String(order.isDeleted).toUpperCase() === 'TRUE') return 0;

  return (
    toNumber(order.total_amount) ||
    toNumber(order.totalAll) ||
    toNumber(order.total) ||
    toNumber(order.amount) ||
    0
  );
}

export function calculateCoreBusiness({
  orders = [],
  purchases = [],
  cashflowTransactions = [],
  productionBatches = [],
  stockMovements = [],
  rules = CORE_BUSINESS_RULES,
} = {}) {
  const targetPcsPerDrop = rules.batchPerDrop * rules.pcsPerBatch;
  const targetPcsPerDay = Math.round(targetPcsPerDrop / rules.targetDaysPerDrop);
  const ayamCostPerDrop = rules.ayamDropKg * rules.ayamPricePerKg;

  const totalRevenue = (orders || []).reduce((sum, order) => {
    return sum + getOrderRevenue(order);
  }, 0);

  const ayamReserve = totalRevenue * rules.allocation.ayamReserve;
  const operational = totalRevenue * rules.allocation.operational;
  const investment = totalRevenue * rules.allocation.investment;
  const netProfit = totalRevenue * rules.allocation.netProfit;

  const totalProducedPcs = (productionBatches || []).reduce((sum, batch) => {
    if (!batch || String(batch.isDeleted).toUpperCase() === 'TRUE') return sum;

    return (
      sum +
      toNumber(batch.total_yield_pcs) +
      toNumber(batch.actual_yield) +
      toNumber(batch.yield_pcs)
    );
  }, 0);

  const totalSoldPcs = (orders || []).reduce((sum, order) => {
    if (!order || String(order.isDeleted).toUpperCase() === 'TRUE') return sum;

    let qtyFromItems = 0;
    try {
      const items = JSON.parse(order.items || '[]');
      if (Array.isArray(items)) {
        qtyFromItems = items.reduce((s, item) => s + toNumber(item.qty), 0);
      }
    } catch {
      qtyFromItems = 0;
    }

    return sum + (qtyFromItems || toNumber(order.qty));
  }, 0);

  const ayamPurchasedKg = (purchases || []).reduce((sum, purchase) => {
    if (!purchase || String(purchase.isDeleted).toUpperCase() === 'TRUE') return sum;

    const itemName = String(purchase.item_name || purchase.itemName || '').toUpperCase();
    const category = String(purchase.category || '').toUpperCase();

    if (itemName.includes('AYAM') || category === 'BAHAN_BAKU') {
      return sum + (toNumber(purchase.qty_kg) || toNumber(purchase.qtyKg) || toNumber(purchase.qty));
    }

    return sum;
  }, 0);

  const ayamUsedKg = (stockMovements || []).reduce((sum, movement) => {
    if (!movement || String(movement.isDeleted).toUpperCase() === 'TRUE') return sum;

    const itemName = String(movement.item_name || movement.itemName || '').toUpperCase();
    const movementType = String(movement.movement_type || movement.type || '').toUpperCase();

    if (itemName.includes('AYAM') && ['INVENTORY_OUT', 'PRODUCTION_USAGE', 'PRODUKSI_PEMALANG'].includes(movementType)) {
      return sum + toNumber(movement.qty);
    }

    return sum;
  }, 0);

  const estimatedAyamRemainingKg = Math.max(0, ayamPurchasedKg - ayamUsedKg);

  const allocationStatus = {
    ayamSafe: ayamReserve >= ayamCostPerDrop,
    operationalSafe: operational >= ayamCostPerDrop * 0.35,
    investmentSafe: investment > 0,
    netProfitSafe: netProfit > 0,
  };

  let healthStatus = 'AMAN';
  const warnings = [];

  if (!allocationStatus.ayamSafe) {
    healthStatus = 'BAHAYA';
    warnings.push('Cadangan beli ayam belum cukup untuk 1x drop 1.020 Kg.');
  }

  if (!allocationStatus.operationalSafe) {
    healthStatus = healthStatus === 'BAHAYA' ? 'BAHAYA' : 'WASPADA';
    warnings.push('Amplop operasional masih rendah.');
  }

  if (targetPcsPerDay > 0 && totalSoldPcs > 0) {
    const estimatedSalesDays = totalSoldPcs / targetPcsPerDay;
    if (estimatedSalesDays < 1) {
      healthStatus = healthStatus === 'BAHAYA' ? 'BAHAYA' : 'WASPADA';
      warnings.push('Run-rate penjualan belum mencapai ritme target harian.');
    }
  }

  return {
    rules,
    totalRevenue,
    allocation: {
      ayamReserve,
      operational,
      investment,
      netProfit,
    },
    status: {
      ...allocationStatus,
      healthStatus,
      warnings,
    },
    production: {
      targetPcsPerDrop,
      targetPcsPerDay,
      totalProducedPcs,
      totalSoldPcs,
      ayamPurchasedKg,
      ayamUsedKg,
      estimatedAyamRemainingKg,
    },
    thresholds: {
      ayamCostPerDrop,
      minOperationalRecommended: ayamCostPerDrop * 0.35,
    },
  };
}

export function formatCoreMoney(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}
