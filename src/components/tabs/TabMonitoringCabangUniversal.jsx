import React, { useState, useMemo } from 'react';
import {
  Factory,
  Store,
  Wallet,
  Coins,
  ArrowRightLeft,
  TrendingUp,
  Package,
  Send,
  AlertTriangle,
} from 'lucide-react';

import TabMonitoringPemalang from './TabMonitoringPemalang';
import { getTodayStr, safeJsonParse } from '../../utils/helpers';
import {
  BRANCH_IDS,
  filterRowsByBranchScope,
} from '../../utils/erpBranchScope';

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

const getStockQty = (row = {}) => {
  return Number(
    row.qty_remaining ||
    row.qtyRemaining ||
    row.stock_qty ||
    row.stockQty ||
    row.current_stock ||
    row.currentStock ||
    row.qty ||
    row.quantity ||
    row.sisa ||
    0,
  );
};

const getRequestQty = (row = {}) => {
  return Number(
    row.qty ||
    row.quantity ||
    row.request_qty ||
    row.requestQty ||
    row.qty_requested ||
    row.qtyRequested ||
    0,
  );
};

const isFrozenOrMenuStock = (row = {}) => {
  const category = String(row.category || row.item_category || row.itemCategory || '').toUpperCase();
  const itemName = String(row.item_name || row.itemName || row.product_name || row.productName || row.name || '').toUpperCase();

  return (
    category.includes('FROZEN') ||
    category.includes('MENU') ||
    category.includes('PRODUK') ||
    category.includes('FINISHED') ||
    category.includes('BARANG_JADI') ||
    category.includes('BARANG JADI') ||
    itemName.includes('DIMSUM') ||
    itemName.includes('PANGSIT') ||
    itemName.includes('UDANG') ||
    itemName.includes('LUMPIA') ||
    itemName.includes('BOLA') ||
    itemName.includes('FROZEN')
  );
};

const isLowStockRow = (row = {}) => {
  const qty = getStockQty(row);
  const minimum = Number(
    row.minimum_stock ||
    row.minimumStock ||
    row.min_stock ||
    row.minStock ||
    row.reorder_point ||
    row.reorderPoint ||
    0,
  );

  if (minimum > 0) return qty <= minimum;

  return qty <= 10;
};

const isPendingRequestStatus = (statusValue) => {
  const status = String(statusValue || '').toUpperCase();

  return (
    status.includes('PENDING') ||
    status.includes('REQUEST') ||
    status.includes('MENUNGGU') ||
    status.includes('WAITING') ||
    status.includes('DIAJUKAN') ||
    status.includes('OPEN')
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

  const realStockRows = useMemo(() => {
    return [
      ...asArray(props.inventoryCostLayers),
      ...asArray(props.inventory_cost_layers),
      ...asArray(props.stokData),
      ...asArray(props.stok_data),
      ...asArray(props.stockMovements),
      ...asArray(props.stock_movements),
    ];
  }, [
    props.inventoryCostLayers,
    props.inventory_cost_layers,
    props.stokData,
    props.stok_data,
    props.stockMovements,
    props.stock_movements,
  ]);

  const realDistributionOrders = useMemo(() => {
    return [
      ...asArray(props.distributionOrders),
      ...asArray(props.distribution_orders),
      ...asArray(props.distribution_orders_data),
      ...asArray(props.branch_requests),
      ...asArray(props.branchRequests),
    ];
  }, [
    props.distributionOrders,
    props.distribution_orders,
    props.distribution_orders_data,
    props.branch_requests,
    props.branchRequests,
  ]);

  const cibinongStats = useMemo(() => {
    if (selectedMonitor !== 'CIBINONG') return null;

    const branchScopeUser = {
      branch_id: cibinongBranchId,
      branch_type: 'OUTLET_RESTO',
    };

    const cibinongOrders = filterRowsByBranchScope({
      rows: realOrders,
      user: branchScopeUser,
      branchId: cibinongBranchId,
      includeGlobal: false,
      includeDeleted: false,
    });

    const cibinongExpenses = filterRowsByBranchScope({
      rows: realExpenses,
      user: branchScopeUser,
      branchId: cibinongBranchId,
      includeGlobal: false,
      includeDeleted: false,
    });

    const cibinongSettlements = filterRowsByBranchScope({
      rows: realSettlements,
      user: branchScopeUser,
      branchId: cibinongBranchId,
      includeGlobal: false,
      includeDeleted: false,
    });

    const cibinongPiutangPayments = filterRowsByBranchScope({
      rows: realPiutangPayments,
      user: branchScopeUser,
      branchId: cibinongBranchId,
      includeGlobal: false,
      includeDeleted: false,
    });

    const cibinongStockRows = filterRowsByBranchScope({
      rows: realStockRows,
      user: branchScopeUser,
      branchId: cibinongBranchId,
      includeGlobal: false,
      includeDeleted: false,
    });

    const cibinongRequests = filterRowsByBranchScope({
      rows: realDistributionOrders,
      user: branchScopeUser,
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

    const frozenStockRows = cibinongStockRows
      .filter((stockRow) => !isDeletedRow(stockRow))
      .filter(isFrozenOrMenuStock);

    const stokFrozenPcs = frozenStockRows.reduce((sum, stockRow) => sum + getStockQty(stockRow), 0);

    const lowStockRows = frozenStockRows
      .filter(isLowStockRow)
      .sort((a, b) => getStockQty(a) - getStockQty(b))
      .slice(0, 8);

    const pendingRequests = cibinongRequests
      .filter((request) => !isDeletedRow(request))
      .filter((request) => isPendingRequestStatus(request.status || request.request_status || request.requestStatus))
      .sort((a, b) => String(getDateYmd(b.date || b.created_at || b.createdAt)).localeCompare(String(getDateYmd(a.date || a.created_at || a.createdAt))))
      .slice(0, 8);

    const pendingRequestQty = pendingRequests.reduce((sum, request) => sum + getRequestQty(request), 0);

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
      stokFrozenPcs,
      lowStockRows,
      pendingRequests,
      pendingRequestQty,
      topProducts,
    };
  }, [
    selectedMonitor,
    realOrders,
    realExpenses,
    realSettlements,
    realPiutangPayments,
    realStockRows,
    realDistributionOrders,
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
            Pantauan cabang produksi dan outlet. Tangerang tetap menjadi pusat kas, approval, stok, dan kontrol owner.
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
                    Radar Outlet: Resto Cibinong
                  </h2>
                </div>

                <p className="relative z-10 text-[11px] font-bold text-slate-300 normal-case max-w-lg leading-relaxed">
                  Fokus outlet: penjualan, uang masuk riil, setoran, stok frozen/menu, dan request barang ke Tangerang. Tidak menghitung 4 amplop dan tidak menghitung adukan.
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
                    Beban Operasional Hari Ini
                  </div>
                  <div className="text-3xl font-black text-red-600 tracking-tight">
                    -
                    {formatRupiah(cibinongStats.totalBebanHariIni)}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-emerald-500">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Wallet size={14} className="text-emerald-500" />
                    Omset Bulan Ini
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

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-start justify-between gap-4 mb-5 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                        <Package size={18} className="text-blue-600" />
                        Stok Frozen/Menu Outlet
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 normal-case">
                        Stok barang jadi/frozen yang tersedia di Cibinong.
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        Total Terpantau
                      </div>
                      <div className="text-2xl font-black text-blue-700 tracking-tight">
                        {formatNumber(cibinongStats.stokFrozenPcs)}
                      </div>
                    </div>
                  </div>

                  {cibinongStats.lowStockRows.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-center">
                      <div className="font-black text-emerald-700 text-xs uppercase tracking-wider">
                        Stok aman
                      </div>
                      <p className="text-[10px] font-bold text-emerald-600 mt-1 normal-case">
                        Belum ada stok frozen/menu yang masuk batas minimum.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] font-black text-red-600 uppercase tracking-wider">
                        <AlertTriangle size={14} />
                        Stok Menipis
                      </div>

                      {cibinongStats.lowStockRows.map((row, index) => (
                        <div
                          key={row.id || row.reference_id || index}
                          className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between gap-4"
                        >
                          <div>
                            <div className="font-black text-slate-800 text-xs uppercase tracking-wide">
                              {row.item_name || row.itemName || row.product_name || row.name || '-'}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 mt-1 normal-case">
                              Min:
                              {' '}
                              {formatNumber(row.minimum_stock || row.min_stock || row.reorder_point || 10)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-black text-red-600">
                              {formatNumber(getStockQty(row))}
                            </div>
                            <div className="text-[9px] font-bold text-red-400 uppercase">
                              tersisa
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-7 bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-start justify-between gap-4 mb-5 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                        <Send size={18} className="text-emerald-600" />
                        Request Barang ke Tangerang
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 normal-case">
                        Pantauan permintaan frozen/menu dari Cibinong yang menunggu approval/fulfillment Tangerang.
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        Pending Qty
                      </div>
                      <div className="text-2xl font-black text-emerald-700 tracking-tight">
                        {formatNumber(cibinongStats.pendingRequestQty)}
                      </div>
                    </div>
                  </div>

                  {cibinongStats.pendingRequests.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center">
                      <div className="font-black text-slate-500 text-xs uppercase tracking-wider">
                        Belum ada request pending
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 normal-case">
                        Kalau stok menipis, Cibinong bisa request barang/menu frozen ke Tangerang melalui flow distribusi/request yang sudah ada.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
                      {cibinongStats.pendingRequests.map((request, index) => (
                        <div
                          key={request.id || request.do_id || index}
                          className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between gap-4"
                        >
                          <div>
                            <div className="font-black text-slate-800 text-xs uppercase tracking-wide">
                              {request.item_name || request.itemName || request.product_name || request.name || request.title || 'REQUEST BARANG'}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 mt-1 normal-case">
                              {getDateYmd(request.date || request.created_at || request.createdAt) || '-'}
                              {' '}
                              ·
                              {' '}
                              {String(request.status || request.request_status || 'PENDING').replace(/_/g, ' ')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-black text-emerald-700">
                              {formatNumber(getRequestQty(request))}
                            </div>
                            <div className="text-[9px] font-bold text-emerald-500 uppercase">
                              qty request
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col max-h-[480px]">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2 mb-5 border-b border-slate-100 pb-4">
                  <TrendingUp size={18} className="text-emerald-500" />
                  Klasemen Menu / Produk Terlaris Cibinong
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
