import React, { useState, useMemo } from 'react';
import {
  Factory,
  Store,
  Wallet,
  Coins,
  ArrowRightLeft,
  TrendingUp,
  DollarSign,
} from 'lucide-react';

import TabMonitoringPemalang from './TabMonitoringPemalang';
import { getTodayStr, safeJsonParse } from '../../utils/helpers';
import {
  BRANCH_IDS,
  filterRowsByBranchScope,
} from '../../utils/erpBranchScope';
import {
  calculateAmplopAllocation,
  AMPLOP_MODES,
} from '../../utils/erpAmplopRules';

const formatRupiah = (angka) => `Rp ${Number(angka || 0).toLocaleString('id-ID')}`;
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};

const pickRows = (...sources) => {
  for (const source of sources) {
    const rows = asArray(source);
    if (rows.length > 0) return rows;
  }

  return [];
};

const isDeletedRow = (row = {}) => {
  return (
    row.isDeleted === true ||
    row.is_deleted === true ||
    String(row.isDeleted).toUpperCase() === 'TRUE' ||
    String(row.is_deleted).toUpperCase() === 'TRUE' ||
    String(row.status || '').toUpperCase() === 'DELETED'
  );
};

const getDateYmd = (value) => {
  if (!value) return '';

  const raw = String(value);
  if (raw.length >= 10 && raw[4] === '-' && raw[7] === '-') {
    return raw.substring(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return raw.substring(0, 10);

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const isSameDate = (value, targetYmd) => {
  return getDateYmd(value) === targetYmd;
};

const isSameMonth = (value, targetYm) => {
  return getDateYmd(value).startsWith(targetYm);
};

const parseItems = (value) => {
  if (Array.isArray(value)) return value;
  return safeJsonParse(value, []);
};

const getOrderGrossAmount = (order = {}) => {
  return Number(
    order.total_amount ||
    order.totalAmount ||
    order.total ||
    order.grand_total ||
    order.grandTotal ||
    0,
  );
};

const getOrderCashInAmount = (order = {}) => {
  const explicitCashIn =
    order.amount_paid ??
    order.paidAmount ??
    order.paid_amount ??
    order.cash_received ??
    order.cashReceived ??
    order.payment_amount ??
    order.paymentAmount;

  if (explicitCashIn !== undefined && explicitCashIn !== null && explicitCashIn !== '') {
    return Number(explicitCashIn || 0);
  }

  // Fallback untuk data lama yang belum punya kolom amount_paid.
  // Ini menjaga dashboard tetap hidup, tapi ke depan transaksi baru tetap wajib isi paid amount.
  return getOrderGrossAmount(order);
};

const getPaymentAmount = (payment = {}) => {
  return Number(
    payment.amount ||
    payment.amount_paid ||
    payment.paid_amount ||
    payment.nominal ||
    0,
  );
};

export default function TabMonitoringCabangUniversal(props) {
  const [selectedMonitor, setSelectedMonitor] = useState('PEMALANG');
  const todayStr = getTodayStr();
  const currentMonth = todayStr.substring(0, 7);

  const cibinongBranchId = BRANCH_IDS.RESTO_CIBINONG;

  const realOrders = useMemo(() => {
    return pickRows(props.orders_data, props.orders);
  }, [props.orders_data, props.orders]);

  const realExpenses = useMemo(() => {
    return pickRows(props.expenses_data, props.expenses);
  }, [props.expenses_data, props.expenses]);

  const realSettlements = useMemo(() => {
    return pickRows(
      props.branch_settlements,
      props.branchSettlements,
      props.branch_settlements_data,
    );
  }, [
    props.branch_settlements,
    props.branchSettlements,
    props.branch_settlements_data,
  ]);

  const realPiutangPayments = useMemo(() => {
    return pickRows(
      props.piutang_payments,
      props.piutangPayments,
      props.piutang_payments_data,
    );
  }, [
    props.piutang_payments,
    props.piutangPayments,
    props.piutang_payments_data,
  ]);

  const realAmplopRules = useMemo(() => {
    return [
      ...asArray(props.masterAmplopRules),
      ...asArray(props.master_amplop_rules),
    ];
  }, [props.masterAmplopRules, props.master_amplop_rules]);

  const realConversionRules = useMemo(() => {
    return [
      ...asArray(props.masterConversionRules),
      ...asArray(props.master_conversion_rules),
    ];
  }, [props.masterConversionRules, props.master_conversion_rules]);

  const cibinongStats = useMemo(() => {
    if (selectedMonitor !== 'CIBINONG') return null;

    const cibinongOrders = filterRowsByBranchScope({
      rows: realOrders,
      user: { branch_id: cibinongBranchId, branch_type: 'OUTLET_RESTO' },
      branchId: cibinongBranchId,
      includeGlobal: false,
      includeDeleted: false,
    });

    const cibinongExpenses = filterRowsByBranchScope({
      rows: realExpenses,
      user: { branch_id: cibinongBranchId, branch_type: 'OUTLET_RESTO' },
      branchId: cibinongBranchId,
      includeGlobal: false,
      includeDeleted: false,
    });

    const cibinongSettlements = filterRowsByBranchScope({
      rows: realSettlements,
      user: { branch_id: cibinongBranchId, branch_type: 'OUTLET_RESTO' },
      branchId: cibinongBranchId,
      includeGlobal: false,
      includeDeleted: false,
    });

    const cibinongPiutangPayments = filterRowsByBranchScope({
      rows: realPiutangPayments,
      user: { branch_id: cibinongBranchId, branch_type: 'OUTLET_RESTO' },
      branchId: cibinongBranchId,
      includeGlobal: false,
      includeDeleted: false,
    });

    let omsetHariIni = 0;
    let omsetBulanIni = 0;
    let uangMasukRiilHariIni = 0;
    let uangMasukRiilBulanIni = 0;
    let totalBebanHariIni = 0;
    let setoranMenungguVal = 0;

    cibinongOrders
      .filter((order) => !isDeletedRow(order))
      .forEach((order) => {
        const grossAmount = getOrderGrossAmount(order);
        const cashInAmount = getOrderCashInAmount(order);

        if (isSameDate(order.date, todayStr)) {
          omsetHariIni += grossAmount;
          uangMasukRiilHariIni += cashInAmount;
        }

        if (isSameMonth(order.date, currentMonth)) {
          omsetBulanIni += grossAmount;
          uangMasukRiilBulanIni += cashInAmount;
        }
      });

    cibinongPiutangPayments
      .filter((payment) => !isDeletedRow(payment))
      .forEach((payment) => {
        const amount = getPaymentAmount(payment);

        if (isSameDate(payment.date, todayStr)) {
          uangMasukRiilHariIni += amount;
        }

        if (isSameMonth(payment.date, currentMonth)) {
          uangMasukRiilBulanIni += amount;
        }
      });

    cibinongExpenses
      .filter((expense) => !isDeletedRow(expense))
      .forEach((expense) => {
        if (isSameDate(expense.date, todayStr)) {
          totalBebanHariIni += Number(expense.amount || expense.total_amount || 0);
        }
      });

    cibinongSettlements
      .filter((settlement) => !isDeletedRow(settlement))
      .forEach((settlement) => {
        if (String(settlement.status || '').toUpperCase() === 'PENDING_VALIDASI') {
          setoranMenungguVal += Number(settlement.nominal || settlement.amount || 0);
        }
      });

    const amplopAllocation = calculateAmplopAllocation({
      cashIn: uangMasukRiilBulanIni,
      date: todayStr,
      branchId: cibinongBranchId,
      mode: AMPLOP_MODES.SURVIVAL,
      rules: realAmplopRules,
      dbData: {
        master_amplop_rules: realAmplopRules,
        master_conversion_rules: realConversionRules,
      },
    });

    const productMap = {};

    cibinongOrders
      .filter((order) => !isDeletedRow(order))
      .forEach((order) => {
        const items = parseItems(order.items);

        items.forEach((item) => {
          const qty = Number(item.qty || item.quantity || 0);
          const price = Number(item.price || item.unit_price || 0);
          const revenue = Number(item.subtotal || item.total || 0) || (qty * price);
          const productName = String(item.name || item.product_name || item.item_name || 'PRODUK TANPA NAMA').toUpperCase();

          if (!productMap[productName]) {
            productMap[productName] = {
              name: productName,
              qty: 0,
              revenue: 0,
            };
          }

          productMap[productName].qty += qty;
          productMap[productName].revenue += revenue;
        });
      });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    return {
      branchId: cibinongBranchId,
      omsetHariIni,
      omsetBulanIni,
      uangMasukRiilHariIni,
      uangMasukRiilBulanIni,
      totalBebanHariIni,
      setoranMenungguVal,

      amplopRule: amplopAllocation.rule,
      amplopPercentSource: amplopAllocation.rule?.percentSource || 'DEFAULT',

      jatahAyam: amplopAllocation.bahanBakuHutangNana,
      jatahOps: amplopAllocation.operasionalLogistikGaji,
      jatahCadangan: amplopAllocation.cicilanKomitmenBuffer,
      jatahCuan: amplopAllocation.ownerSurvival,

      percentAyam: amplopAllocation.bahanBakuPercent,
      percentOps: amplopAllocation.operasionalPercent,
      percentCadangan: amplopAllocation.cicilanBufferPercent,
      percentCuan: amplopAllocation.ownerPercent,

      topProducts,
    };
  }, [
    selectedMonitor,
    realOrders,
    realExpenses,
    realSettlements,
    realPiutangPayments,
    realAmplopRules,
    realConversionRules,
    todayStr,
    currentMonth,
    cibinongBranchId,
  ]);

  return (
    <div className="space-y-6 text-slate-700 animate-in fade-in duration-300 pb-10">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-wide uppercase">
            Command Center Multi Cabang
          </h2>
          <p className="text-[11px] font-bold text-slate-400 mt-1 max-w-md leading-relaxed normal-case">
            Gunakan tombol kendali di samping untuk berpindah pantauan analitik secara langsung antara pabrik produksi dan resto outlet.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto shadow-inner border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedMonitor('PEMALANG')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all cursor-pointer uppercase tracking-wider ${
              selectedMonitor === 'PEMALANG'
                ? 'bg-white text-red-600 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Factory size={16} />
            Pabrik Pemalang
          </button>

          <button
            type="button"
            onClick={() => setSelectedMonitor('CIBINONG')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all cursor-pointer uppercase tracking-wider ${
              selectedMonitor === 'CIBINONG'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store size={16} />
            Resto Cibinong
          </button>
        </div>
      </div>

      <div className="key-render-container animate-in fade-in slide-in-from-bottom-2 duration-300">
        {selectedMonitor === 'PEMALANG' ? (
          <TabMonitoringPemalang
            {...props}
            monitorBranchId={BRANCH_IDS.PRODUKSI_PEMALANG}
          />
        ) : (
          cibinongStats && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 p-6 lg:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-blue-800">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Store size={120} className="text-blue-400" />
                </div>

                <div className="relative z-10 flex items-center gap-3 mb-2">
                  <Store size={24} className="text-blue-400" />
                  <h2 className="text-xl font-black text-white uppercase tracking-wide">
                    Radar Eksekutif: Resto Cibinong
                  </h2>
                </div>

                <p className="relative z-10 text-[11px] font-bold text-slate-300 normal-case max-w-lg leading-relaxed">
                  Layar analitik khusus memantau performa penjualan, uang masuk riil, beban operasional, dan peringkat menu terlaris outlet Resto Cibinong.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <TrendingUp size={14} className="text-blue-500" />
                    Omset Hari Ini
                  </div>
                  <div className="text-3xl font-black text-blue-700 tracking-tight">
                    {formatRupiah(cibinongStats.omsetHariIni)}
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 mt-2 normal-case">
                    Uang masuk riil hari ini: {formatRupiah(cibinongStats.uangMasukRiilHariIni)}
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <ArrowRightLeft size={14} className="text-red-500" />
                    Beban Operasional (H)
                  </div>
                  <div className="text-3xl font-black text-red-600 tracking-tight">
                    -
                    {formatRupiah(cibinongStats.totalBebanHariIni)}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-emerald-500">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Wallet size={14} className="text-emerald-500" />
                    Total Omset (Bulan Ini)
                  </div>
                  <div className="text-3xl font-black text-emerald-700 tracking-tight">
                    {formatRupiah(cibinongStats.omsetBulanIni)}
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 mt-2 normal-case">
                    Cash basis bulan ini: {formatRupiah(cibinongStats.uangMasukRiilBulanIni)}
                  </p>
                </div>

                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 shadow-sm">
                  <div className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Coins size={14} />
                    Setoran Menunggu Validasi
                  </div>
                  <div className="text-3xl font-black text-amber-700 tracking-tight">
                    {formatRupiah(cibinongStats.setoranMenungguVal)}
                  </div>
                </div>
              </div>

              {cibinongStats.uangMasukRiilBulanIni > 0 && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-8 border-l-blue-500">
                  <h3 className="font-black text-sm text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <DollarSign size={18} className="text-blue-600" />
                    Proyeksi Jatah 4 Amplop Cibinong
                  </h3>

                  <p className="text-[10px] font-bold text-slate-500 mb-5 normal-case">
                    Dihitung dari uang masuk riil bulan ini:
                    {' '}
                    <b className="text-slate-800">
                      {formatRupiah(cibinongStats.uangMasukRiilBulanIni)}
                    </b>
                    {' '}
                    · Rule aktif:
                    {' '}
                    <b className="text-blue-700">
                      {cibinongStats.amplopRule?.name || 'Survival Mode Dimsum Aditya'}
                    </b>
                    {' '}
                    · Source:
                    {' '}
                    {cibinongStats.amplopPercentSource}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-center">
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-inner">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Amplop 1 Ayam / Nana ({Number(cibinongStats.percentAyam || 0).toFixed(0)}%)
                      </div>
                      <div className="text-xl font-black text-blue-700 mt-2">
                        {formatRupiah(cibinongStats.jatahAyam)}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-inner">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Amplop 2 Ops ({Number(cibinongStats.percentOps || 0).toFixed(0)}%)
                      </div>
                      <div className="text-xl font-black text-emerald-700 mt-2">
                        {formatRupiah(cibinongStats.jatahOps)}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-inner">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Amplop 3 Cicilan ({Number(cibinongStats.percentCadangan || 0).toFixed(0)}%)
                      </div>
                      <div className="text-xl font-black text-orange-700 mt-2">
                        {formatRupiah(cibinongStats.jatahCadangan)}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-inner">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Amplop 4 Owner ({Number(cibinongStats.percentCuan || 0).toFixed(0)}%)
                      </div>
                      <div className="text-xl font-black text-amber-700 mt-2">
                        {formatRupiah(cibinongStats.jatahCuan)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col max-h-[480px]">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2 mb-5 border-b border-slate-100 pb-4">
                  <TrendingUp size={18} className="text-emerald-500" />
                  Klasemen Menu / Produk Terlaris Cibinong (All Time)
                </h3>

                <div className="overflow-y-auto pr-2 flex-1 space-y-3 custom-scrollbar">
                  {cibinongStats.topProducts.length === 0 ? (
                    <div className="text-center text-slate-400 font-bold text-xs py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 normal-case">
                      Belum ada data penjualan tercatat.
                    </div>
                  ) : (
                    cibinongStats.topProducts.map((product, index) => (
                      <div
                        key={`${product.name}-${index}`}
                        className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors shadow-sm group"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm shrink-0 border border-slate-200 ${
                            index === 0
                              ? 'bg-amber-400 text-white'
                              : index === 1
                                ? 'bg-slate-300 text-slate-800'
                                : index === 2
                                  ? 'bg-orange-400 text-white'
                                  : 'bg-white text-slate-400'
                          }`}
                          >
                            #
                            {index + 1}
                          </div>

                          <div>
                            <div className="font-black text-slate-800 text-sm uppercase tracking-wide line-clamp-1 group-hover:text-emerald-600 transition-colors">
                              {product.name}
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                              {formatNumber(product.qty)}
                              {' '}
                              Pcs Terjual
                            </div>
                          </div>
                        </div>

                        <div className="font-black text-emerald-600 text-base tracking-tight shrink-0 pl-3">
                          {formatRupiah(product.revenue)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
