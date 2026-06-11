// utils/CoreBusinessEngine.js

export function allocateRevenue(totalRevenue) {
  return {
    ayamReserve: totalRevenue * 0.55,
    operational: totalRevenue * 0.20,
    investment: totalRevenue * 0.10,
    netProfit: totalRevenue * 0.15
  };
}

export function checkRevenueStatus(allocation, thresholds = {}) {
  const { ayamReserve, operational } = allocation;
  const { minAyam = 38000000, minOp = 14000000 } = thresholds;
  return {
    ayamSafe: ayamReserve >= minAyam,
    operationalSafe: operational >= minOp
  };
}
