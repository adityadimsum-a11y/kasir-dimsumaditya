// utils/CoreBusinessEngine.js
export function allocateRevenue(totalRevenue) {
  return {
    ayamReserve: totalRevenue * 0.55,       // 55% untuk beli ayam berikutnya
    operational: totalRevenue * 0.20,       // 20% operasional & bahan pendukung
    investment: totalRevenue * 0.10,        // 10% cadangan/investasi pabrik
    netProfit: totalRevenue * 0.15          // 15% laba bersih pribadi
  };
}

// optional helper untuk alert status
export function checkRevenueStatus(allocation, thresholds = {}) {
  const { ayamReserve, operational, investment, netProfit } = allocation;
  const { minAyam = 38000000, minOp = 14000000 } = thresholds;
  return {
    ayamSafe: ayamReserve >= minAyam,
    operationalSafe: operational >= minOp
  };
}
