import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Store,
  Factory,
  Wallet,
  Coins,
  AlertCircle,
  ShoppingCart,
  Users,
  CheckCircle,
  Percent,
} from 'lucide-react';

import { getTodayStr, formatDate, safeJsonParse } from '../../utils/helpers';
import {
  BRANCH_IDS,
  normalizeBranchId,
  filterRowsByBranchScope,
} from '../../utils/erpBranchScope';
import {
  calculateAmplopAllocation,
  AMPLOP_MODES,
} from '../../utils/erpAmplopRules';

const formatRupiah = (angka) => `Rp ${Number(angka || 0).toLocaleString('id-ID')}`;
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

const StatCard = ({ title, amount, icon, colorClass, textClass }) => (
  <div className={`p-6 rounded-3xl shadow-sm flex flex-col justify-between transition-transform hover:scale-[1.02] duration-300 border border-slate-100 ${colorClass}`}>
    <div className="flex justify-between items-start mb-4">
      <h3 className={`font-black text-[11px] uppercase tracking-wider opacity-80 leading-snug max-w-[120px] ${textClass}`}>
        {title}
      </h3>
      <div className={`p-3 bg-white rounded-2xl shadow-sm border border-slate-100 shrink-0 ${textClass}`}>
        {icon}
      </div>
    </div>
    <div className={`text-3xl font-black tracking-tighter mt-2 ${textClass}`}>
      {amount}
    </div>
  </div>
);

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

const rowLooksLikePemalang = (row = {}) => {
  const branchText = String(
    row.branch_id ||
    row.branchId ||
    row.location_id ||
    row.locationId ||
    row.type ||
    row.category ||
    row.source_branch_id ||
    row.sourceBranchId ||
    '',
  ).toUpperCase();

  return (
    normalizeBranchId(branchText, '') === BRANCH_IDS.PRODUKSI_PEMALANG ||
    branchText.includes('PEMALANG') ||
    branchText.includes('PRODUKSI_PEMALANG')
  );
};

const resolveConversionRules = (rules = []) => {
  const activeRule = asArray(rules).find((rule) => (
    !isDeletedRow(rule) &&
    (
      rule.id === 'RULE-GLOBAL' ||
      rule.kode_rule === 'RULE-GLOBAL' ||
      rule.code === 'RULE-GLOBAL' ||
      String(rule.nama_rule || '').toUpperCase().includes('GLOBAL')
    )
  ));

  return {
    kgPerAdukan: Number(activeRule?.kg_per_adukan || activeRule?.kgPerAdukan || activeRule?.kg_per_batch || 30),
    pcsPerAdukan: Number(activeRule?.pcs_per_adukan || activeRule?.pcsPerAdukan || activeRule?.pcs_per_batch || 1000),
    kgPerKantong: Number(activeRule?.kg_per_kantong || activeRule?.kgPerKantong || 10),
    pcsPerMika: Number(activeRule?.pcs_per_mika || activeRule?.pcsPerMika || 50),
    source: activeRule ? 'MASTER_CONVERSION_RULE' : 'DEFAULT_FALLBACK',
  };
};

export default function TabMonitoringPemalang({
  orders = [],
  orders_data,
  pemalangReports = [],
  pemalang = [],
  pemalang_reports = [],
  purchases_data,
  purchases = [],
  stokData,
  stok_data,
  stockMovements = [],
  stock_movements = [],
  productionBatches = [],
  production_batches = [],

  piutangPayments = [],
  piutang_payments = [],

  masterAmplopRules = [],
  master_amplop_rules = [],
  masterConversionRules = [],
  master_conversion_rules = [],

  monitorBranchId = BRANCH_IDS.PRODUKSI_PEMALANG,
  user,
}) {
  const todayStr = getTodayStr();
  const currentBranch = normalizeBranchId(monitorBranchId || BRANCH_IDS.PRODUKSI_PEMALANG);

  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const realOrders = useMemo(() => {
    return pickRows(orders_data, orders);
  }, [orders_data, orders]);

  const realPurchases = useMemo(() => {
    return pickRows(purchases_data, purchases);
  }, [purchases_data, purchases]);

  const realReports = useMemo(() => {
    return pickRows(pemalangReports, pemalang_reports, pemalang);
  }, [pemalangReports, pemalang_reports, pemalang]);

  const realStokData = useMemo(() => {
    return pickRows(stokData, stok_data, stockMovements, stock_movements, productionBatches, production_batches);
  }, [stokData, stok_data, stockMovements, stock_movements, productionBatches, production_batches]);

  const realPiutangPayments = useMemo(() => {
    return pickRows(piutang_payments, piutangPayments);
  }, [piutang_payments, piutangPayments]);

  const realAmplopRules = useMemo(() => {
    return [
      ...asArray(masterAmplopRules),
      ...asArray(master_amplop_rules),
    ];
  }, [masterAmplopRules, master_amplop_rules]);

  const realConversionRules = useMemo(() => {
    return [
      ...asArray(masterConversionRules),
      ...asArray(master_conversion_rules),
    ];
  }, [masterConversionRules, master_conversion_rules]);

  const conversion = useMemo(() => {
    return resolveConversionRules(realConversionRules);
  }, [realConversionRules]);

  const stats = useMemo(() => {
    const isPeriod = (dateVal) => {
      const cleanDate = getDateYmd(dateVal);
      if (!cleanDate) return false;
      return cleanDate >= dateFrom && cleanDate <= dateTo;
    };

    const branchScopeUser = {
      branch_id: currentBranch,
      branch_type: 'PRODUCTION_BRANCH',
    };

    const branchOrdersAll = filterRowsByBranchScope({
      rows: realOrders,
      user: branchScopeUser,
      branchId: currentBranch,
      includeGlobal: false,
      includeDeleted: false,
    });

    const branchPurchasesAll = filterRowsByBranchScope({
      rows: realPurchases,
      user: branchScopeUser,
      branchId: currentBranch,
      includeGlobal: false,
      includeDeleted: false,
    });

    const branchPiutangPaymentsAll = filterRowsByBranchScope({
      rows: realPiutangPayments,
      user: branchScopeUser,
      branchId: currentBranch,
      includeGlobal: false,
      includeDeleted: false,
    });

    const branchReportsAll = realReports
      .filter((report) => !isDeletedRow(report))
      .filter((report) => {
        const hasExplicitBranch =
          report.branch_id ||
          report.branchId ||
          report.location_id ||
          report.locationId;

        if (!hasExplicitBranch) return true;

        return rowLooksLikePemalang(report);
      });

    const branchProductionRowsAll = realStokData
      .filter((row) => !isDeletedRow(row))
      .filter((row) => rowLooksLikePemalang(row));

    let mutasiAyamPemalang = 0;

    branchPurchasesAll
      .filter((purchase) => !isDeletedRow(purchase))
      .filter((purchase) => {
        const category = String(purchase.category || '').toUpperCase();
        const itemName = String(purchase.item_name || purchase.itemName || purchase.name || '').toUpperCase();

        return (
          category.includes('BAHAN_BAKU') ||
          category.includes('BAHAN BAKU') ||
          itemName.includes('AYAM') ||
          itemName.includes('CHICKEN')
        );
      })
      .forEach((purchase) => {
        mutasiAyamPemalang += Number(purchase.qty_kg || purchase.qtyKg || purchase.qty || purchase.quantity || 0);
      });

    const prodPemalangAll = branchProductionRowsAll.reduce((sum, row) => {
      return sum + Number(row.qty || row.jumlah_adukan || row.adukan || row.batch_qty || 0);
    }, 0);

    const sisaAyamCabang = Math.max(0, mutasiAyamPemalang - (prodPemalangAll * conversion.kgPerAdukan));

    let terjualPcsAll = 0;

    branchOrdersAll.forEach((order) => {
      const items = safeJsonParse(order.items, []);
      let subPcs = 0;

      items.forEach((item) => {
        subPcs += Number(item.qty || item.quantity || 0);
      });

      if (subPcs === 0) subPcs = Number(order.qty || order.quantity || 0);
      terjualPcsAll += subPcs;
    });

    const totalOmsetAll = branchOrdersAll.reduce((sum, order) => {
      return sum + getOrderGrossAmount(order);
    }, 0);

    const sisaStokFreezer = Math.max(0, (prodPemalangAll * conversion.pcsPerAdukan) - terjualPcsAll);

    const branchOrdersPeriod = branchOrdersAll.filter((order) => isPeriod(order.date));
    const branchReportsPeriod = branchReportsAll.filter((report) => isPeriod(report.date));
    const branchPiutangPaymentsPeriod = branchPiutangPaymentsAll.filter((payment) => isPeriod(payment.date));

    const prodPeriode = branchProductionRowsAll
      .filter((row) => isPeriod(row.date))
      .reduce((sum, row) => {
        return sum + Number(row.qty || row.jumlah_adukan || row.adukan || row.batch_qty || 0);
      }, 0);

    const omsetPeriode = branchOrdersPeriod.reduce((sum, order) => {
      return sum + getOrderGrossAmount(order);
    }, 0);

    const uangMasukRiilPeriode = branchOrdersPeriod.reduce((sum, order) => {
      return sum + getOrderCashInAmount(order);
    }, 0) + branchPiutangPaymentsPeriod.reduce((sum, payment) => {
      return sum + getPaymentAmount(payment);
    }, 0);

    const setoranPeriode = branchReportsPeriod.reduce((sum, report) => {
      return sum + Number(report.nominal || report.amount || report.setoran || 0);
    }, 0);

    const amplopAllocation = calculateAmplopAllocation({
      cashIn: uangMasukRiilPeriode,
      date: dateTo || todayStr,
      branchId: currentBranch,
      mode: AMPLOP_MODES.SURVIVAL,
      rules: realAmplopRules,
      dbData: {
        master_amplop_rules: realAmplopRules,
        master_conversion_rules: realConversionRules,
      },
    });

    const customerMap = {};

    branchOrdersPeriod.forEach((order) => {
      const customerName = String(order.customer_name || order.customerName || 'Umum / Cash').toUpperCase();

      if (!customerMap[customerName]) {
        customerMap[customerName] = {
          name: customerName,
          qty: 0,
          porsi: 0,
          total: 0,
          frequency: 0,
        };
      }

      let subPcs = 0;
      const items = safeJsonParse(order.items, []);

      items.forEach((item) => {
        subPcs += Number(item.qty || item.quantity || 0);
      });

      if (subPcs === 0) subPcs = Number(order.qty || order.quantity || 0);

      customerMap[customerName].qty += subPcs;
      customerMap[customerName].porsi += subPcs / 4;
      customerMap[customerName].total += getOrderGrossAmount(order);
      customerMap[customerName].frequency += 1;
    });

    const topCustomersList = Object.values(customerMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const laporanUrut = [...branchReportsPeriod].sort((a, b) => {
      return new Date(getDateYmd(b.date)) - new Date(getDateYmd(a.date));
    });

    return {
      sisaAyamCabang,
      sisaStokFreezer,
      totalOmsetAll,
      omsetPeriode,
      uangMasukRiilPeriode,
      setoranPeriode,
      prodPeriode,

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

      ayamTerpakaiPeriode: prodPeriode * conversion.kgPerAdukan,
      dimsumMasukPeriode: prodPeriode * conversion.pcsPerAdukan,

      laporanUrut,
      branchOrdersPeriod,
      topCustomersList,
    };
  }, [
    realOrders,
    realPurchases,
    realReports,
    realStokData,
    realPiutangPayments,
    realAmplopRules,
    realConversionRules,
    conversion,
    currentBranch,
    dateFrom,
    dateTo,
    todayStr,
  ]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Calendar size={18} className="text-orange-600" />
            Filter Rentang Pemantauan Cabang
          </h3>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl shadow-inner">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Dari</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
            />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-l border-slate-200 pl-3 ml-1">
              Sampai
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
            />
          </div>
        </div>

        <button
          type="button"
          className="bg-slate-900 text-white px-5 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md hover:bg-slate-800 transition-transform active:scale-95 cursor-pointer"
        >
          <CheckCircle size={16} />
          Mode Audit Sinkron HQ
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative text-slate-700 border-t-4 border-t-red-600">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50">
          <div>
            <h2 className="text-base font-black text-slate-800 flex items-center gap-2 tracking-wide uppercase">
              <Factory className="text-red-600" />
              Pantauan Live Hasil Dapur Produksi
            </h2>
            <p className="text-[11px] font-bold text-slate-400 normal-case mt-1">
              Monitoring otomatis pergerakan adonan dan isi freezer langsung dari server pusat.
            </p>
            <p className="text-[9px] font-bold text-red-500 normal-case mt-1">
              Rule konversi: {conversion.kgPerAdukan} kg/adukan · {conversion.pcsPerAdukan} pcs/adukan · {conversion.kgPerKantong} kg/kantong · {conversion.pcsPerMika} pcs/mika · Source: {conversion.source}
            </p>
          </div>

          <div className="text-right hidden sm:block">
            <div className="text-xs font-black text-emerald-600 flex items-center justify-end gap-1.5 uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse" />
              Live Data Sinkron
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-100 text-center bg-white">
          <div className="p-6 hover:bg-slate-50 transition-colors">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Adukan Cabang
            </div>
            <div className="text-3xl font-black text-slate-800 tracking-tight">
              {formatNumber(stats.prodPeriode)}
              {' '}
              <span className="text-sm text-amber-600 font-bold uppercase tracking-wider">Adk</span>
            </div>
          </div>

          <div className="p-6 hover:bg-slate-50 transition-colors">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Daging Terpakai
            </div>
            <div className="text-3xl font-black text-slate-800 tracking-tight">
              -
              {formatNumber(stats.ayamTerpakaiPeriode)}
              {' '}
              <span className="text-sm text-red-500 font-bold uppercase tracking-wider">Kg</span>
            </div>
          </div>

          <div className="p-6 hover:bg-slate-50 transition-colors bg-red-50/20 relative">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Sisa Ayam Gudang
            </div>
            <div className="text-3xl font-black text-red-600 tracking-tight">
              {formatNumber(stats.sisaAyamCabang)}
              {' '}
              <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">Kg</span>
            </div>
            <div className="text-[9px] font-black text-red-700 bg-red-100 px-2 py-1 rounded-md border border-red-200 mt-2 inline-block uppercase tracking-wider shadow-3xs">
              {formatNumber((stats.sisaAyamCabang / conversion.kgPerKantong).toFixed(0))}
              {' '}
              Kantong
            </div>
          </div>

          <div className="p-6 hover:bg-slate-50 transition-colors">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Masuk Freezer
            </div>
            <div className="text-3xl font-black text-slate-800 tracking-tight">
              +
              {formatNumber(stats.dimsumMasukPeriode)}
              {' '}
              <span className="text-sm text-emerald-600 font-bold uppercase tracking-wider">Pcs</span>
            </div>
            <div className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 mt-2 inline-block uppercase tracking-wider shadow-3xs">
              {formatNumber((stats.dimsumMasukPeriode / conversion.pcsPerMika).toFixed(0))}
              {' '}
              Mika
            </div>
          </div>

          <div className="p-6 hover:bg-slate-50 transition-colors bg-emerald-50/20">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Sisa Freezer (Live)
            </div>
            <div className="text-3xl font-black text-emerald-600 tracking-tight">
              {formatNumber(stats.sisaStokFreezer)}
              {' '}
              <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">Pcs</span>
            </div>
            <div className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 mt-2 inline-block uppercase tracking-wider shadow-3xs">
              {formatNumber((stats.sisaStokFreezer / conversion.pcsPerMika).toFixed(0))}
              {' '}
              Mika
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 lg:p-8">
        <div className="mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Wallet size={20} className="text-blue-600" />
            Analitik Keuangan Buku Cabang Pemalang
          </h2>
          <p className="text-[11px] font-bold text-slate-400 mt-1 normal-case">
            Laporan otomatis periode terpilih harian.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Omset Cabang (All time)"
            amount={formatRupiah(stats.totalOmsetAll)}
            icon={<Store size={20} />}
            colorClass="bg-slate-50"
            textClass="text-slate-800"
          />
          <StatCard
            title="Omset Cabang (Periode ini)"
            amount={formatRupiah(stats.omsetPeriode)}
            icon={<Wallet size={20} />}
            colorClass="bg-blue-50/50 border-blue-100"
            textClass="text-blue-700"
          />
          <StatCard
            title="Total Setoran Kasir Masuk"
            amount={formatRupiah(stats.setoranPeriode)}
            icon={<Coins size={20} />}
            colorClass="bg-emerald-50/50 border-emerald-100"
            textClass="text-emerald-700"
          />
        </div>
      </div>

      {stats.uangMasukRiilPeriode > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-8 border-l-amber-500">
          <h3 className="font-black text-sm text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-2">
            <Percent size={18} className="text-amber-600" />
            Proyeksi Kuota Jatah 4 Amplop Pemalang
          </h3>

          <p className="text-[10px] font-bold text-slate-500 mb-5 normal-case">
            Dihitung dari uang masuk riil periode ini:
            {' '}
            <b className="text-slate-800">
              {formatRupiah(stats.uangMasukRiilPeriode)}
            </b>
            {' '}
            · Rule aktif:
            {' '}
            <b className="text-amber-700">
              {stats.amplopRule?.name || 'Survival Mode Dimsum Aditya'}
            </b>
            {' '}
            · Source:
            {' '}
            {stats.amplopPercentSource}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-center">
            <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 p-4 rounded-2xl shadow-sm border-t-4 border-t-blue-500">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                Amplop 1: Ayam / Nana ({Number(stats.percentAyam || 0).toFixed(0)}%)
              </div>
              <div className="text-xl font-black text-blue-700 mt-2">
                {formatRupiah(stats.jatahAyam)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-4 rounded-2xl shadow-sm border-t-4 border-t-emerald-500">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                Amplop 2: Ops &amp; Gaji ({Number(stats.percentOps || 0).toFixed(0)}%)
              </div>
              <div className="text-xl font-black text-emerald-700 mt-2">
                {formatRupiah(stats.jatahOps)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-white border border-orange-100 p-4 rounded-2xl shadow-sm border-t-4 border-t-orange-500">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                Amplop 3: Cadangan ({Number(stats.percentCadangan || 0).toFixed(0)}%)
              </div>
              <div className="text-xl font-black text-orange-700 mt-2">
                {formatRupiah(stats.jatahCadangan)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 p-4 rounded-2xl shadow-sm border-t-4 border-t-amber-500">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                Amplop 4: Profit ({Number(stats.percentCuan || 0).toFixed(0)}%)
              </div>
              <div className="text-xl font-black text-amber-700 mt-2">
                {formatRupiah(stats.jatahCuan)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <AlertCircle size={18} className="text-red-600" />
          <h4 className="font-black text-slate-800 text-sm uppercase tracking-wide">
            Jurnal Pengecekan Silang Setoran (EOD Cabang)
          </h4>
        </div>

        <div className="overflow-x-auto p-2 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 font-black">Tanggal Lapor</th>
                <th className="px-5 py-4 text-center font-black">Klaim Adukan Dapur</th>
                <th className="px-5 py-4 font-black">Fisik Freezer Kulkas</th>
                <th className="px-5 py-4 font-black">Fisik Stok Ayam</th>
                <th className="px-5 py-4 text-right font-black">Uang Setoran Masuk</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-bold text-xs bg-white">
              {(!stats.laporanUrut || stats.laporanUrut.length === 0) ? (
                <tr>
                  <td colSpan="5" className="text-center py-16 text-slate-400 font-medium text-sm normal-case">
                    Tidak ada setoran EOD tertulis dari cabang di rentang tanggal ini.
                  </td>
                </tr>
              ) : (
                stats.laporanUrut.map((report, index) => (
                  <tr key={report.id || index} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-black text-slate-800">{formatDate(report.date)}</div>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap font-black text-blue-700 bg-blue-50/50 rounded-xl">
                      {report.produksiMika || report.produksi_mika || '0'}
                      {' '}
                      Batch /
                      {' '}
                      {report.pesananMika || report.pesanan_mika || '0'}
                      {' '}
                      Order
                    </td>
                    <td className="px-5 py-4 font-black uppercase text-indigo-700">
                      {formatNumber(report.stokFreezer || report.stok_freezer)}
                      {' '}
                      Pcs
                    </td>
                    <td className="px-5 py-4 font-black uppercase text-orange-700">
                      {formatNumber(report.stokAyam || report.stok_ayam)}
                      {' '}
                      Kg
                    </td>
                    <td className="px-5 py-4 text-right font-black text-emerald-600 text-base tracking-tight">
                      {formatRupiah(report.nominal || report.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <ShoppingCart size={18} className="text-orange-600" />
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">
              Buku Harian Antrean Invoice Jualan Pemalang
            </h3>
          </div>

          <div className="overflow-x-auto p-2 custom-scrollbar max-h-[400px]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-4 font-black">Tanggal &amp; ID</th>
                  <th className="px-5 py-4 font-black">Nama Pelanggan</th>
                  <th className="px-5 py-4 text-center font-black">Volume</th>
                  <th className="px-5 py-4 text-right font-black">Total Tagihan</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {(!stats.branchOrdersPeriod || stats.branchOrdersPeriod.length === 0) ? (
                  <tr>
                    <td colSpan="4" className="text-center py-16 text-slate-400 font-medium text-sm normal-case">
                      Tidak ada struk transaksi penjualan pada rentang periode ini.
                    </td>
                  </tr>
                ) : (
                  stats.branchOrdersPeriod.map((order, index) => {
                    let totalPcsInvoice = 0;
                    const items = safeJsonParse(order.items, []);

                    items.forEach((item) => {
                      totalPcsInvoice += Number(item.qty || item.quantity || 0);
                    });

                    if (totalPcsInvoice === 0) {
                      totalPcsInvoice = Number(order.qty || order.quantity || 0);
                    }

                    return (
                      <tr key={order.id || index} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="font-black text-slate-800">{formatDate(order?.date)}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-1">{order?.id || '-'}</div>
                        </td>
                        <td className="px-5 py-4 uppercase font-black text-sm text-slate-800 whitespace-nowrap tracking-wide">
                          {order?.customer_name || order?.customerName || '-'}
                        </td>
                        <td className="px-5 py-4 text-center font-black text-blue-700 bg-blue-50/30 rounded-xl whitespace-nowrap">
                          {formatNumber(totalPcsInvoice)}
                          {' '}
                          <span className="text-[10px] text-blue-500 font-bold uppercase">Pcs</span>
                        </td>
                        <td className="px-5 py-4 text-right font-black text-emerald-600 text-base tracking-tight whitespace-nowrap">
                          {formatRupiah(order?.total_amount || order?.total)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl shadow-sm p-6 flex flex-col max-h-[480px]">
          <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2 mb-5 border-b border-slate-100 pb-3">
            <Users size={18} className="text-red-600" />
            Klasemen Pelanggan Terloyal
          </h3>

          <div className="overflow-y-auto pr-2 flex-1 space-y-3 custom-scrollbar">
            {(!stats.topCustomersList || stats.topCustomersList.length === 0) ? (
              <div className="text-center text-slate-400 font-bold text-xs py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 normal-case">
                Belum ada pelanggan loyal yang masuk hitungan.
              </div>
            ) : (
              stats.topCustomersList.map((customer, index) => (
                <div
                  key={`${customer.name}-${index}`}
                  className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-orange-300 hover:bg-orange-50/50 transition-colors shadow-sm group"
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
                      <div className="font-black text-slate-800 text-sm uppercase tracking-wide line-clamp-1 group-hover:text-red-600 transition-colors">
                        {customer.name}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                        {customer.frequency}
                        x Belanja •
                        {' '}
                        {formatNumber(customer.qty)}
                        {' '}
                        Pcs (
                        {formatNumber(customer.porsi.toFixed(0))}
                        {' '}
                        Porsi)
                      </div>
                    </div>
                  </div>

                  <div className="font-black text-emerald-600 text-base tracking-tight shrink-0 pl-3">
                    {formatRupiah(customer.total)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
