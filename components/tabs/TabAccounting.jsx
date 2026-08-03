import React, { useState, useMemo } from 'react';
import {
  Scale,
  ArrowDownToLine,
  ArrowUpRight,
  TrendingUp,
  Calculator,
  DollarSign,
  Percent,
  Printer,
  Wallet,
  CreditCard,
  Banknote,
  Info,
} from 'lucide-react';

import { getTodayStr, formatDate, safeJsonParse } from '../../utils/helpers';
import { calculateAmplopAllocation, AMPLOP_MODES } from '../../utils/erpAmplopRules';

const formatRupiah = (angka) => `Rp ${Number(angka || 0).toLocaleString('id-ID')}`;
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

const asArray = (value) => {
  return Array.isArray(value) ? value : [];
};

// 🔥 PATOKAN HPP STANDAR SEMENTARA
// Batch berikutnya akan kita ganti ke HPP actual bahan baku + packaging + resep/BOM.
const INTI_HPP_PER_PCS = 1125;

export default function TabAccounting({
  orders = [],
  orders_data,
  purchases = [],
  purchases_data,
  expenses = [],
  expenses_data,
  cashflowTransactions = [],
  cashflow_transactions,
  piutangPayments = [],
  piutang_payments = [],

  masterAmplopRules = [],
  master_amplop_rules = [],
  masterConversionRules = [],
  master_conversion_rules = [],

  user,
  setPrintData,
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id)
    ? 'TANGERANG_PUSAT'
    : user?.branch_id;

  const [dateFilter, setDateFilter] = useState('THIS_MONTH');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions || cashflowTransactions || [], [cashflow_transactions, cashflowTransactions]);
  const realPiutangPayments = useMemo(() => piutang_payments || piutangPayments || [], [piutang_payments, piutangPayments]);

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

  const filteredData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start = new Date(0);
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (dateFilter === 'TODAY') {
      start = new Date(today);
    } else if (dateFilter === '7_DAYS') {
      start = new Date(today);
      start.setDate(start.getDate() - 7);
    } else if (dateFilter === '14_DAYS') {
      start = new Date(today);
      start.setDate(start.getDate() - 14);
    } else if (dateFilter === 'THIS_MONTH') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (dateFilter === 'CUSTOM' && startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [dateFilter, startDate, endDate]);

  const ruleEffectiveDate = useMemo(() => {
    if (dateFilter === 'CUSTOM' && endDate) return endDate;
    return todayStr;
  }, [dateFilter, endDate, todayStr]);

  const walletBalances = useMemo(() => {
    let bca = 0;
    let bri = 0;
    let cash = 0;

    realCashflow
      .filter((cashRow) => !cashRow.isDeleted)
      .forEach((cashRow) => {
        const amount = Number(cashRow.amount || 0);
        const type = String(cashRow.type || cashRow.transaction_type || '').toUpperCase();
        const method = String(cashRow.method || cashRow.wallet || cashRow.account || '').toUpperCase();

        const isIn = type === 'IN' || type === 'CASH_IN' || type === 'INFLOW';
        const signedAmount = isIn ? amount : -amount;

        if (method === 'TF_BCA_PUSAT' || method.includes('BCA')) {
          bca += signedAmount;
        } else if (method === 'TF_BRI_PUSAT' || method.includes('BRI')) {
          bri += signedAmount;
        } else if (method === 'CASH' || method.includes('TUNAI')) {
          cash += signedAmount;
        }
      });

    return { bca, bri, cash };
  }, [realCashflow]);

  const profitLossMetrics = useMemo(() => {
    let omzetJualanKotor = 0;
    let totalUangMasukRiil = 0;
    let totalPcsTerjual = 0;

    let modalBelanjaAyam = 0;
    let operasionalLainnya = 0;

    const { start, end } = filteredData;

    realOrders
      .filter((order) => !order.isDeleted)
      .forEach((order) => {
        const orderDate = new Date(order.date);

        if (orderDate >= start && orderDate <= end) {
          omzetJualanKotor += Number(order.total_amount || order.total || 0);
          totalUangMasukRiil += Number(order.amount_paid || order.paidAmount || 0);

          const items = safeJsonParse(order.items, []);
          let pcsQty = 0;

          items.forEach((item) => {
            pcsQty += Number(item.qty || 0);
          });

          if (pcsQty === 0) pcsQty = Number(order.qty || 0);
          totalPcsTerjual += pcsQty;
        }
      });

    realPiutangPayments
      .filter((payment) => !payment.isDeleted)
      .forEach((payment) => {
        const paymentDate = new Date(payment.date);

        if (paymentDate >= start && paymentDate <= end) {
          totalUangMasukRiil += Number(payment.amount || payment.amount_paid || 0);
        }
      });

    realPurchases
      .filter((purchase) => !purchase.isDeleted)
      .forEach((purchase) => {
        const purchaseDate = new Date(purchase.date);

        if (purchaseDate >= start && purchaseDate <= end) {
          const category = String(purchase.category || '').toUpperCase();
          const itemName = String(purchase.item_name || purchase.name || '').toUpperCase();
          const amount = Number(purchase.total_amount || purchase.amount || 0);

          if (category.includes('BAHAN_BAKU') || category.includes('BAHAN BAKU') || itemName.includes('AYAM')) {
            modalBelanjaAyam += amount;
          } else {
            operasionalLainnya += amount;
          }
        }
      });

    realExpenses
      .filter((expense) => !expense.isDeleted)
      .forEach((expense) => {
        const expenseDate = new Date(expense.date);

        if (expenseDate >= start && expenseDate <= end) {
          operasionalLainnya += Number(expense.amount || 0);
        }
      });

    const totalHPPBarangTerjual = totalPcsTerjual * INTI_HPP_PER_PCS;
    const totalBebanRiil = totalHPPBarangTerjual + operasionalLainnya;
    const labaBersihPabrik = omzetJualanKotor - totalBebanRiil;
    const marginPersen = omzetJualanKotor > 0
      ? (labaBersihPabrik / omzetJualanKotor) * 100
      : 0;

    const amplopAllocation = calculateAmplopAllocation({
      cashIn: totalUangMasukRiil,
      date: ruleEffectiveDate,
      branchId: currentBranch,
      mode: AMPLOP_MODES.SURVIVAL,
      rules: realAmplopRules,
      dbData: {
        master_amplop_rules: realAmplopRules,
        master_conversion_rules: realConversionRules,
      },
    });

    return {
      omzetJualanKotor,
      totalUangMasukRiil,
      totalPcsTerjual,
      totalHPPBarangTerjual,
      modalBelanjaAyam,
      operasionalLainnya,
      totalBebanRiil,
      labaBersihPabrik,
      marginPersen,

      amplopRule: amplopAllocation.rule,
      amplopPercentSource: amplopAllocation.rule?.percentSource || 'DEFAULT',

      amplopAyam: amplopAllocation.bahanBakuHutangNana,
      amplopOperasional: amplopAllocation.operasionalLogistikGaji,
      amplopCicilan: amplopAllocation.cicilanKomitmenBuffer,
      amplopCuanOwner: amplopAllocation.ownerSurvival,

      amplopAyamPercent: amplopAllocation.bahanBakuPercent,
      amplopOperasionalPercent: amplopAllocation.operasionalPercent,
      amplopCicilanPercent: amplopAllocation.cicilanBufferPercent,
      amplopCuanOwnerPercent: amplopAllocation.ownerPercent,
    };
  }, [
    realOrders,
    realPurchases,
    realExpenses,
    realPiutangPayments,
    filteredData,
    ruleEffectiveDate,
    currentBranch,
    realAmplopRules,
    realConversionRules,
  ]);

  const handlePrintLaporan = () => {
    if (typeof setPrintData !== 'function') {
      alert('Fungsi printer belum tersambung!');
      return;
    }

    let periodeLabel = dateFilter.replace(/_/g, ' ');
    if (dateFilter === 'CUSTOM') periodeLabel = `${formatDate(startDate)} s.d ${formatDate(endDate)}`;

    setPrintData({
      type: 'INVOICE',
      id: `PL-${todayStr.replace(/-/g, '')}`,
      date: formatDate(todayStr),
      branch_name: 'PABRIK TANGERANG PUSAT',
      admin_name: user?.name || 'Sistem Akuntansi',
      customer_name: 'Laporan Laba Rugi Eksekutif',
      position: 'Laporan Keuangan',
      notes: `Periode Laporan: ${periodeLabel}`,
      items: [
        {
          name: '1. Total Uang Masuk (Kertas)',
          qty: 1,
          subtotal: profitLossMetrics.omzetJualanKotor,
        },
        {
          name: `2. Modal Pokok Terjual (${formatNumber(profitLossMetrics.totalPcsTerjual)} Pcs)`,
          qty: 1,
          subtotal: -profitLossMetrics.totalHPPBarangTerjual,
        },
        {
          name: '3. Biaya Operasional Pabrik',
          qty: 1,
          subtotal: -profitLossMetrics.operasionalLainnya,
        },
      ],
      amount: profitLossMetrics.labaBersihPabrik,
      paymentMethod: 'REKAP LAPORAN SISTEM',
      history: {
        labelLama: 'Omset Kotor',
        nominalLama: profitLossMetrics.omzetJualanKotor,
        labelAksi: 'Total Beban Pokok & Ops',
        nominalAksi: profitLossMetrics.totalBebanRiil,
        labelBaru: 'KEUNTUNGAN BERSIH (PROFIT)',
        nominalBaru: profitLossMetrics.labaBersihPabrik,
      },
    });
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Scale className="text-blue-600" size={18} />
            Jurnal Laba Rugi &amp; Cuan Bersih
          </h2>
          <p className="text-[10px] font-bold text-slate-500 mt-1">
            Rangkuman performa pabrik (Accrual) dan alokasi uang masuk (Cash-Basis).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl border flex-wrap sm:flex-nowrap w-full sm:w-auto shadow-inner">
            {[
              { id: 'TODAY', label: 'Hari Ini' },
              { id: '7_DAYS', label: '7 Hari' },
              { id: '14_DAYS', label: '2 Minggu' },
              { id: 'THIS_MONTH', label: 'Bulan Ini' },
              { id: 'CUSTOM', label: 'Kustom' },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setDateFilter(filter.id)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all whitespace-nowrap ${
                  dateFilter === filter.id
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handlePrintLaporan}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors"
          >
            <Printer size={14} />
            Cetak Laporan
          </button>
        </div>
      </div>

      {dateFilter === 'CUSTOM' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end animate-in fade-in duration-200">
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1.5">
              Mulai Tanggal
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="border border-slate-200 bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1.5">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="border border-slate-200 bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 rounded-3xl border border-blue-200 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-black text-blue-700 flex items-center gap-2 mb-2">
            <ArrowDownToLine size={16} />
            Total Omset Penjualan (Kertas)
          </div>
          <div className="text-3xl font-black text-blue-800 tracking-tight">
            {formatRupiah(profitLossMetrics.omzetJualanKotor)}
          </div>
          <p className="text-[10px] text-blue-600/80 font-bold mt-2">
            *Akumulasi Lunas + Piutang (Barang Laku).
          </p>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 p-6 rounded-3xl border border-rose-200 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-black text-rose-700 flex items-center gap-2 mb-2">
            <ArrowUpRight size={16} />
            HPP &amp; Beban Operasional Pabrik
          </div>
          <div className="text-3xl font-black text-rose-800 tracking-tight">
            -
            {formatRupiah(profitLossMetrics.totalBebanRiil)}
          </div>
          <p className="text-[10px] text-rose-600/80 font-bold mt-2">
            *HPP standar x volume + gaji + ops.
          </p>
        </div>

        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden">
          <DollarSign className="absolute -right-4 -bottom-4 text-emerald-500/10 pointer-events-none" size={130} />
          <div className="text-[11px] font-black text-emerald-400 flex items-center gap-2 mb-2 relative z-10">
            <TrendingUp size={16} />
            Keuntungan Bersih (Profit Pabrik)
          </div>
          <div className="text-3xl font-black text-white tracking-tight relative z-10">
            {formatRupiah(profitLossMetrics.labaBersihPabrik)}
          </div>
          <div className="mt-3 flex items-center gap-2 relative z-10">
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${
              profitLossMetrics.labaBersihPabrik >= 0
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/20 border-rose-500/30 text-rose-300'
            }`}
            >
              Sisa Margin Keuntungan:
              {' '}
              {Number(profitLossMetrics.marginPersen || 0).toFixed(1)}
              %
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 bg-slate-50 border-b border-slate-100">
              <h3 className="font-black text-xs text-slate-800 flex items-center gap-2">
                <Wallet size={16} className="text-blue-500" />
                Realita Saldo Dompet (Wadah Fisik)
              </h3>
              <p className="text-[9px] font-bold text-slate-500 mt-1">
                Sisa uang riil yang tercatat di dalam sistem kasir/bank saat ini.
              </p>
            </div>

            <div className="p-5 space-y-4 flex-1">
              <div className="flex items-start gap-4 p-4 border border-blue-200 bg-blue-50/50 rounded-2xl">
                <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl border border-blue-200">
                  <CreditCard size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-500">Saldo Rekening BCA</div>
                  <div className="text-xl font-black text-blue-700 my-0.5">
                    {formatRupiah(walletBalances.bca)}
                  </div>
                  <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                    <Info size={10} />
                    Wadah suci khusus Amplop 1 (Ayam).
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 border border-orange-200 bg-orange-50/50 rounded-2xl">
                <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl border border-orange-200">
                  <CreditCard size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-500">Saldo Rekening BRI</div>
                  <div className="text-xl font-black text-orange-700 my-0.5">
                    {formatRupiah(walletBalances.bri)}
                  </div>
                  <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                    <Info size={10} />
                    Wadah untuk Amplop 3 (Cicilan) &amp; Amplop 4.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 border border-emerald-200 bg-emerald-50/50 rounded-2xl">
                <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-xl border border-emerald-200">
                  <Banknote size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-500">
                    Uang Tunai (Laci &amp; Brankas)
                  </div>
                  <div className="text-xl font-black text-emerald-700 my-0.5">
                    {formatRupiah(walletBalances.cash)}
                  </div>
                  <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                    <Info size={10} />
                    Wadah khusus Amplop 2 (Ops &amp; Gaji Harian).
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 bg-slate-50 border-b border-slate-100">
              <h3 className="font-black text-xs text-slate-800 flex items-center gap-2">
                <Percent size={16} className="text-amber-500" />
                Kewajiban 4 Amplop (Dari Uang Masuk Riil)
              </h3>
              <p className="text-[9px] font-bold text-slate-500 mt-1">
                Pembagian jatah mutlak dari
                {' '}
                <b className="text-slate-800">
                  Total Uang Cair
                  {' '}
                  {formatRupiah(profitLossMetrics.totalUangMasukRiil)}
                </b>
                {' '}
                pada periode ini. Piutang tidak masuk hitungan!
              </p>
              <p className="text-[9px] font-bold text-amber-600 mt-1">
                Rule aktif:
                {' '}
                {profitLossMetrics.amplopRule?.name || 'Survival Mode Dimsum Aditya'}
                {' '}
                · Effective:
                {' '}
                {profitLossMetrics.amplopRule?.effective_from || '-'}
                {' '}
                · Source:
                {' '}
                {profitLossMetrics.amplopPercentSource}
              </p>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden border-t-4 border-t-blue-500">
                <div className="flex justify-between items-start">
                  <div className="text-[10px] font-black text-slate-500">
                    1. Uang Sakral Nana Ayam
                  </div>
                  <span className="bg-blue-100 text-blue-700 font-black text-[9px] px-1.5 py-0.5 rounded shadow-sm">
                    {Number(profitLossMetrics.amplopAyamPercent || 0).toFixed(0)}
                    %
                  </span>
                </div>
                <p className="text-xl font-black text-blue-700 mt-2 tracking-tight">
                  {formatRupiah(profitLossMetrics.amplopAyam)}
                </p>
                <div className="text-[9px] font-bold text-slate-400 mt-2 pt-2 border-t border-slate-100 leading-snug">
                  Wajib diamankan di BCA untuk modal ayam berikutnya + selipan hutang lama.
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden border-t-4 border-t-emerald-500">
                <div className="flex justify-between items-start">
                  <div className="text-[10px] font-black text-slate-500">
                    2. Ops, Bumbu, Logistik &amp; Gaji
                  </div>
                  <span className="bg-emerald-100 text-emerald-700 font-black text-[9px] px-1.5 py-0.5 rounded shadow-sm">
                    {Number(profitLossMetrics.amplopOperasionalPercent || 0).toFixed(0)}
                    %
                  </span>
                </div>
                <p className="text-xl font-black text-emerald-700 mt-2 tracking-tight">
                  {formatRupiah(profitLossMetrics.amplopOperasional)}
                </p>
                <div className="text-[9px] font-bold text-slate-400 mt-2 pt-2 border-t border-slate-100 leading-snug">
                  Jatah untuk uang laci. Jika kurang, baru tarik tunai dari BCA.
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden border-t-4 border-t-orange-500">
                <div className="flex justify-between items-start">
                  <div className="text-[10px] font-black text-slate-500">
                    3. Komitmen Cicilan &amp; Aset
                  </div>
                  <span className="bg-orange-100 text-orange-700 font-black text-[9px] px-1.5 py-0.5 rounded shadow-sm">
                    {Number(profitLossMetrics.amplopCicilanPercent || 0).toFixed(0)}
                    %
                  </span>
                </div>
                <p className="text-xl font-black text-orange-700 mt-2 tracking-tight">
                  {formatRupiah(profitLossMetrics.amplopCicilan)}
                </p>
                <div className="text-[9px] font-bold text-slate-400 mt-2 pt-2 border-t border-slate-100 leading-snug">
                  Transfer ke BRI untuk bayar Leasing Mobil, Motor, Mess, dan Auto-Debit.
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden border-t-4 border-t-amber-500">
                <div className="flex justify-between items-start">
                  <div className="text-[10px] font-black text-slate-500">
                    4. Laba Pribadi Bos (Survival)
                  </div>
                  <span className="bg-amber-100 text-amber-700 font-black text-[9px] px-1.5 py-0.5 rounded shadow-sm">
                    {Number(profitLossMetrics.amplopCuanOwnerPercent || 0).toFixed(0)}
                    %
                  </span>
                </div>
                <p className="text-xl font-black text-amber-700 mt-2 tracking-tight">
                  {formatRupiah(profitLossMetrics.amplopCuanOwner)}
                </p>
                <div className="text-[9px] font-bold text-slate-400 mt-2 pt-2 border-t border-slate-100 leading-snug">
                  Laba bersih Owner. Pindahkan ke BRI untuk dinikmati bersama keluarga.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LEMBAR KERJA AKUNTANSI (LAPORAN RUGI LABA ACCRUAL) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
          <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
            <Calculator size={18} className="text-blue-500" />
            Laporan Laba Rugi Operasional Pabrik (P&amp;L)
          </h3>
          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase hidden sm:block">
            Metode Accrual (Sesuai Barang Laku)
          </span>
        </div>

        <div className="space-y-3 max-w-4xl">
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div className="font-black text-xs text-slate-700">
                A. Pendapatan Penjualan (Kertas)
              </div>
              <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase">
                Termasuk Piutang Belum Tertagih
              </div>
            </div>
            <div className="font-black text-blue-600 text-sm">
              {formatRupiah(profitLossMetrics.omzetJualanKotor)}
            </div>
          </div>

          <div className="pl-4 sm:pl-6 space-y-3 border-l-2 border-slate-200/60 ml-2 sm:ml-4 py-2">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-[11px] text-slate-600">
                  (-) Harga Pokok Penjualan (HPP)
                </div>
                <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                  {formatNumber(profitLossMetrics.totalPcsTerjual)}
                  {' '}
                  Pcs x
                  {' '}
                  {formatRupiah(INTI_HPP_PER_PCS)}
                  {' '}
                  (HPP standar sementara)
                </div>
              </div>
              <div className="font-black text-rose-500 text-xs">
                -
                {formatRupiah(profitLossMetrics.totalHPPBarangTerjual)}
              </div>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200">
              <div>
                <div className="font-bold text-[11px] text-slate-600">
                  (-) Biaya Operasional &amp; Gaji
                </div>
                <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                  Listrik, Bensin, Plastik, Gaji, Lembur
                </div>
              </div>
              <div className="font-black text-rose-500 text-xs">
                -
                {formatRupiah(profitLossMetrics.operasionalLainnya)}
              </div>
            </div>
          </div>

          <div className={`flex justify-between items-center p-4 rounded-xl border transition-all mt-2 ${
            profitLossMetrics.labaBersihPabrik >= 0
              ? 'bg-emerald-50/50 border-emerald-200'
              : 'bg-rose-50/50 border-rose-200'
          }`}
          >
            <div className={`font-black text-xs ${
              profitLossMetrics.labaBersihPabrik >= 0 ? 'text-emerald-800' : 'text-rose-800'
            }`}
            >
              B. LABA BERSIH OPERASIONAL (NET PROFIT)
            </div>
            <div className={`font-black text-xl tracking-tight ${
              profitLossMetrics.labaBersihPabrik >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}
            >
              {formatRupiah(profitLossMetrics.labaBersihPabrik)}
            </div>
          </div>

          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
              Info Arus Kas Terpisah (Tidak memotong laba pabrik):
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-[11px] text-slate-600">
                Total Uang Dibelikan Stok Bahan Baku (Kulakan)
              </span>
              <span className="font-bold text-xs text-slate-800">
                {formatRupiah(profitLossMetrics.modalBelanjaAyam)}
              </span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 mt-2 italic">
              Uang kulakan tidak memotong laba pabrik karena sifatnya memindahkan bentuk kas dompet menjadi aset fisik di freezer. Laba murni dihitung saat barang fisik tersebut terjual (HPP).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
