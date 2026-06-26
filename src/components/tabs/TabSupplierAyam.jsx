import React, { useState, useMemo } from 'react';
import {
  ArrowDownToLine,
  Receipt,
  Send,
  AlertTriangle,
  ShieldAlert,
  X,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import {
  NANA_SUPPLIER_CANONICAL_NAME,
  NANA_LEDGER_TYPES,
  calculateNanaPayableSummary,
  makeNanaPaymentLedgerRecord,
  makeNanaOpeningBalanceRecord,
} from '../../utils/erpHutangAyamCore';

const formatRupiah = (angka) => `Rp ${Number(angka || 0).toLocaleString('id-ID')}`;
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

const asArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const normalizeCode = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

export default function TabSupplierAyam({
  purchases = [],
  purchases_data,
  cashflowTransactions = [],
  cashflow_transactions = [],
  cashflow_transactions_data,
  supplierLedger = [],
  supplier_ledger = [],
  supplier_ledger_data = [],
  sendToSheet,
  showToast,
  user,
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id)
    ? 'TANGERANG_PUSAT'
    : user?.branch_id;

  const CORE_SUPPLIER_TITLE = NANA_SUPPLIER_CANONICAL_NAME;

  const [formBayar, setFormBayar] = useState({
    date: todayStr,
    method: 'TF_BCA_PUSAT',
    notes: '',
  });

  const [showInjectModal, setShowInjectModal] = useState(false);
  const [injectForm, setInjectForm] = useState({
    date: todayStr,
    notes: 'Saldo hutang masa lalu (Excel)',
  });

  const [rawBayarAmount, setRawBayarAmount] = useState('');
  const [displayBayarAmount, setDisplayBayarAmount] = useState('');
  const [rawInjectAmount, setRawInjectAmount] = useState('');
  const [displayInjectAmount, setDisplayInjectAmount] = useState('');

  const handleBayarAmountChange = (event) => {
    const value = event.target.value.replace(/\D/g, '');
    setRawBayarAmount(value);
    setDisplayBayarAmount(value ? Number(value).toLocaleString('id-ID') : '');
  };

  const handleInjectAmountChange = (event) => {
    const value = event.target.value.replace(/\D/g, '');
    setRawInjectAmount(value);
    setDisplayInjectAmount(value ? Number(value).toLocaleString('id-ID') : '');
  };

  const realPurchases = useMemo(() => {
    return purchases_data || purchases || [];
  }, [purchases, purchases_data]);

  const realCashflow = useMemo(() => {
    return cashflow_transactions_data || cashflow_transactions || cashflowTransactions || [];
  }, [cashflow_transactions_data, cashflow_transactions, cashflowTransactions]);

  const realSupplierLedger = useMemo(() => {
    return [
      ...asArray(supplierLedger),
      ...asArray(supplier_ledger),
      ...asArray(supplier_ledger_data),
    ];
  }, [supplierLedger, supplier_ledger, supplier_ledger_data]);

  const legacyOpeningLedgerRows = useMemo(() => {
    return realCashflow
      .filter((row) => !row.isDeleted && String(row.isDeleted).toUpperCase() !== 'TRUE')
      .filter((row) => normalizeCode(row.category) === 'SALDO_AWAL_HUTANG_AYAM')
      .map((row) => ({
        id: row.id,
        date: row.date,
        branch_id: row.branch_id || currentBranch,
        supplier_name: CORE_SUPPLIER_TITLE,
        supplier_key: CORE_SUPPLIER_TITLE,
        transaction_type: NANA_LEDGER_TYPES.OPENING_BALANCE,
        amount: Number(row.amount || 0),
        method: row.method || 'SISTEM',
        notes: row.description || row.notes || 'Saldo hutang masa lalu',
        source_table: 'legacy_cashflow_transactions',
        source_id: row.id,
        isDeleted: false,
      }));
  }, [realCashflow, currentBranch, CORE_SUPPLIER_TITLE]);

  const cashflowWithoutLegacyOpening = useMemo(() => {
    return realCashflow.filter((row) => normalizeCode(row.category) !== 'SALDO_AWAL_HUTANG_AYAM');
  }, [realCashflow]);

  const nanaSummary = useMemo(() => {
    return calculateNanaPayableSummary({
      supplierLedger: [
        ...realSupplierLedger,
        ...legacyOpeningLedgerRows,
      ],
      purchases: realPurchases,
      cashflowTransactions: cashflowWithoutLegacyOpening,
      branchId: currentBranch,
      fallbackBranchId: currentBranch,
      includePurchaseFallback: true,
      includeCashflowPaymentFallback: true,
      allowAyamItemFallback: true,
    });
  }, [
    realSupplierLedger,
    legacyOpeningLedgerRows,
    realPurchases,
    cashflowWithoutLegacyOpening,
    currentBranch,
  ]);

  const bukuRekeningKoran = useMemo(() => {
    const chronologicalLedger = [...asArray(nanaSummary.ledger)].sort((a, b) => {
      const dateDiff = String(a.date || '').localeCompare(String(b.date || ''));
      if (dateDiff !== 0) return dateDiff;

      return String(a.id || '').localeCompare(String(b.id || ''));
    });

    let runningBalance = 0;
    let totalAyamTurun = 0;
    let totalUangDibayar = 0;

    const mappedLedger = chronologicalLedger.map((record) => {
      const amount = Number(record.amount || 0);
      const type = String(record.transaction_type || '').toUpperCase();

      const isDebit = [
        NANA_LEDGER_TYPES.OPENING_BALANCE,
        NANA_LEDGER_TYPES.PURCHASE,
        NANA_LEDGER_TYPES.ADJUSTMENT_ADD,
      ].includes(type);

      const isCredit = [
        NANA_LEDGER_TYPES.PAYMENT,
        NANA_LEDGER_TYPES.ADJUSTMENT_MINUS,
      ].includes(type);

      const debit = isDebit ? amount : 0;
      const kredit = isCredit ? amount : 0;

      runningBalance += debit;
      runningBalance -= kredit;

      if (isDebit) totalAyamTurun += debit;
      if (isCredit) totalUangDibayar += kredit;

      let labelType = 'Tagihan Masuk';
      if (type === NANA_LEDGER_TYPES.OPENING_BALANCE) labelType = 'Saldo Awal';
      if (type === NANA_LEDGER_TYPES.PAYMENT) labelType = 'Pembayaran';
      if (type === NANA_LEDGER_TYPES.ADJUSTMENT_ADD) labelType = 'Koreksi Tambah';
      if (type === NANA_LEDGER_TYPES.ADJUSTMENT_MINUS) labelType = 'Koreksi Kurang';

      const qtyText = record.qty > 0 ? `${formatNumber(record.qty)} Kg` : '-';

      let description = record.notes || record.description || '';
      if (!description && type === NANA_LEDGER_TYPES.PURCHASE) {
        description = `Ayam turun: ${qtyText} (Ref: ${record.source_id || record.id})`;
      }
      if (!description && type === NANA_LEDGER_TYPES.PAYMENT) {
        description = `Bayar / cicil (${String(record.method || '').replace(/_/g, ' ').toLowerCase()})`;
      }

      return {
        id: record.id,
        date: record.date,
        type: labelType,
        description,
        debit,
        kredit,
        saldoBerjalan: runningBalance,
        raw: record,
      };
    });

    return {
      ledger: [...mappedLedger].reverse(),
      sisaHutang: runningBalance,
      totalAyamTurun,
      totalUangDibayar,
    };
  }, [nanaSummary]);

  const handleBayarCicilan = async (event) => {
    event.preventDefault();

    const nominal = Number(rawBayarAmount);
    if (nominal <= 0) return alert('Nominal transfer tidak boleh kosong!');
    if (typeof sendToSheet !== 'function') return alert('Kabel sendToSheet belum tersambung!');

    const confirmMessage = `Konfirmasi Transfer & Potong Saldo ${formBayar.method.replace(/_/g, ' ')}:\n\nNominal: ${formatRupiah(nominal)}\n\nLanjutkan pembayaran ke Supplier ${CORE_SUPPLIER_TITLE}?`;

    if (!window.confirm(confirmMessage)) return;

    const cashflowId = generateId('CFO', formBayar.date);

    const ledgerPayload = makeNanaPaymentLedgerRecord({
      amount: nominal,
      date: formBayar.date,
      method: formBayar.method,
      notes: `Transfer pembayaran ayam / cicilan selipan: ${formBayar.notes}`,
      user,
      branchId: currentBranch,
      sourceId: cashflowId,
    });

    const cashflowPayload = {
      id: cashflowId,
      date: formBayar.date,
      branch_id: currentBranch,
      type: 'OUT',
      transaction_type: 'OUTFLOW',
      category: 'PELUNASAN HUTANG AYAM',
      description: `Transfer pembayaran ayam / cicilan selipan: ${formBayar.notes}`,
      amount: nominal,
      method: formBayar.method,
      source_table: 'supplier_ledger',
      source_id: ledgerPayload.id,
      isDeleted: false,
    };

    const cashflowSuccess = await sendToSheet('insert', cashflowPayload, 'cashflow_transactions');
    if (!cashflowSuccess) return;

    const ledgerSuccess = await sendToSheet('insert', ledgerPayload, 'supplier_ledger');

    if (ledgerSuccess) {
      if (typeof showToast === 'function') {
        showToast(`Pembayaran Rp ${formatNumber(nominal)} berhasil! Sisa hutang otomatis berkurang.`, 'success');
      }

      setFormBayar({ date: todayStr, method: 'TF_BCA_PUSAT', notes: '' });
      setRawBayarAmount('');
      setDisplayBayarAmount('');
    } else if (typeof showToast === 'function') {
      showToast('Cashflow berhasil, tapi ledger hutang gagal tersimpan. Cek koneksi supplier_ledger.', 'error');
    }
  };

  const handleInjectSaldoAwal = async (event) => {
    event.preventDefault();

    const nominal = Number(rawInjectAmount);
    if (nominal <= 0) return alert('Nominal hutang tidak valid!');
    if (typeof sendToSheet !== 'function') return alert('Kabel sendToSheet belum tersambung!');

    const confirmMessage = `PERINGATAN: Memasukkan Saldo Hutang Masa Lalu sebesar ${formatRupiah(nominal)}.\n\nData ini akan menjadi fondasi awal hutang pabrik.\nTidak memotong saldo dompet karena ini hanya pembukaan liability.\n\nLanjutkan?`;

    if (!window.confirm(confirmMessage)) return;

    const payload = makeNanaOpeningBalanceRecord({
      amount: nominal,
      date: injectForm.date,
      notes: injectForm.notes,
      user,
      branchId: currentBranch,
    });

    const success = await sendToSheet('insert', payload, 'supplier_ledger');

    if (success) {
      if (typeof showToast === 'function') {
        showToast('Saldo Hutang Masa Lalu berhasil disuntikkan ke ledger hutang ayam!', 'success');
      }

      setShowInjectModal(false);
      setRawInjectAmount('');
      setDisplayInjectAmount('');
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-red-900 via-rose-900 to-red-950 p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between relative overflow-hidden rounded-3xl shadow-xl border border-red-800">
        <div className="absolute -top-32 -left-32 w-72 h-72 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-72 h-72 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full md:w-1/2">
          <h2 className="text-white text-xl lg:text-2xl font-black uppercase tracking-tight flex items-center gap-3 mb-2">
            <ShieldAlert className="text-red-400" size={28} />
            Buku Hutang {CORE_SUPPLIER_TITLE}
          </h2>
          <p className="text-[11px] font-bold text-slate-300 leading-relaxed normal-case max-w-sm">
            Rekening koran akumulasi hutang khusus daging ayam &amp; histori pembayaran cicilan lintas waktu (Running Balance).
          </p>
        </div>

        <div className="relative z-10 mt-6 md:mt-0 w-full md:w-auto bg-slate-900/60 border border-slate-700/50 p-5 rounded-2xl shadow-inner backdrop-blur-sm shrink-0">
          <div className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            Sisa Hutang Berjalan Aktif
          </div>
          <div className="text-3xl lg:text-4xl font-black text-white tracking-tighter">
            {formatRupiah(bukuRekeningKoran.sisaHutang)}
          </div>
          {bukuRekeningKoran.sisaHutang <= 0 && (
            <div className="text-[9px] font-black text-emerald-300 mt-2 uppercase tracking-wider">
              Status: Lunas / Tidak ada hutang aktif
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-red-600 overflow-hidden">
            <form onSubmit={handleBayarCicilan} className="space-y-5">
              <h3 className="font-black text-slate-800 uppercase tracking-wider text-xs pb-3 border-b border-slate-100 flex items-center gap-2">
                <Send size={16} className="text-red-600" />
                Bayar Ayam &amp; Selipan Cicilan
              </h3>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">
                  Total Nominal Uang Transfer
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">Rp</span>
                  <input
                    type="text"
                    required
                    value={displayBayarAmount}
                    onChange={handleBayarAmountChange}
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-red-100 rounded-xl font-black text-xl text-red-700 bg-white focus:bg-white focus:border-red-500 outline-none transition-colors shadow-sm"
                    placeholder="0"
                  />
                </div>
                <p className="text-[9px] font-bold text-slate-400 mt-2 leading-relaxed normal-case">
                  Ket: Masukkan total transfer harian sekaligus cicilan ke Nana Ayam.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                    Tanggal Transfer
                  </label>
                  <input
                    type="date"
                    required
                    value={formBayar.date}
                    onChange={(event) => setFormBayar({ ...formBayar, date: event.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none cursor-pointer focus:border-red-500 focus:bg-white shadow-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                    Rekening Asal Dompet
                  </label>
                  <select
                    required
                    value={formBayar.method}
                    onChange={(event) => setFormBayar({ ...formBayar, method: event.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-50 outline-none cursor-pointer focus:border-red-500 focus:bg-white shadow-sm transition-colors"
                  >
                    <option value="TF_BCA_PUSAT">BCA Pusat</option>
                    <option value="TF_BRI_PUSAT">BRI Pusat</option>
                    <option value="CASH">Kas Tunai Laci</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Memo / Keterangan Transfer
                </label>
                <input
                  type="text"
                  required
                  value={formBayar.notes}
                  onChange={(event) => setFormBayar({ ...formBayar, notes: event.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-red-500 shadow-sm transition-colors normal-case"
                  placeholder="Cth: Bayar ayam turun + cicil selipan"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                Sahkan &amp; Kurangi Sisa Hutang
              </button>
            </form>
          </div>

          <div className="bg-red-50/50 border border-red-100 p-6 rounded-3xl flex flex-col justify-center items-center text-center shadow-sm">
            <AlertTriangle size={24} className="text-red-500 mb-2" />
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-1">
              Setup Hutang Legacy (Excel)
            </div>
            <div className="text-[10px] font-bold text-slate-500 leading-relaxed mb-4 normal-case max-w-[200px]">
              Pindahkan sisa tumpukan tagihan kemarin ke ledger hutang ayam. Cukup input sekali saja untuk fondasi.
            </div>
            <button
              type="button"
              onClick={() => setShowInjectModal(true)}
              className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 transition-colors shadow-md cursor-pointer"
            >
              Input Saldo Awal Legacy
            </button>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[75vh]">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <div>
              <h4 className="font-black text-sm uppercase tracking-wide text-slate-800 flex items-center gap-2">
                <Receipt size={18} className="text-red-600" />
                Buku Mutasi (Running Balance) Supplier
              </h4>
              <p className="text-[10px] text-slate-500 font-bold mt-1 normal-case">
                Histori kronologis ayam turun (Hutang) vs uang keluar (Pelunasan).
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm text-right shrink-0 w-full sm:w-auto flex flex-col sm:items-end">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                Total Ayam Turun:
                {' '}
                <span className="text-slate-700 font-black">{formatRupiah(bukuRekeningKoran.totalAyamTurun)}</span>
              </div>
              <div className="text-[9px] font-black text-emerald-600 uppercase tracking-wider mt-1">
                Total Uang Dibayar:
                {' '}
                {formatRupiah(bukuRekeningKoran.totalUangDibayar)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="px-5 py-4 font-black">Tgl &amp; ID Laporan</th>
                  <th className="px-5 py-4 font-black min-w-[220px]">Deskripsi Riwayat Transaksi</th>
                  <th className="px-5 py-4 text-right font-black">Tagihan (Debit)</th>
                  <th className="px-5 py-4 text-right font-black">Pembayaran (Kredit)</th>
                  <th className="px-5 py-4 text-right font-black bg-red-50/50 text-red-800">Sisa Hutang Berjalan</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-bold text-xs bg-white">
                {bukuRekeningKoran.ledger.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-24 text-slate-400 normal-case font-bold">
                      <div className="flex justify-center mb-3 opacity-20">
                        <ShieldAlert size={40} />
                      </div>
                      Belum ada riwayat transaksi dengan supplier {CORE_SUPPLIER_TITLE}.
                    </td>
                  </tr>
                ) : (
                  bukuRekeningKoran.ledger.map((log, index) => (
                    <tr key={log.id || index} className="hover:bg-red-50/20 transition-colors bg-white">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black">{formatDate(log.date)}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">{log.id}</div>
                      </td>

                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border mb-2 inline-block shadow-sm ${
                          log.type === 'Tagihan Masuk'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : log.type === 'Saldo Awal'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                        >
                          {log.type}
                        </span>
                        <div className="text-slate-700 text-xs font-bold normal-case leading-relaxed">
                          {log.description}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {log.debit > 0 ? (
                          <span className="text-slate-800 font-black text-sm">{formatRupiah(log.debit)}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {log.kredit > 0 ? (
                          <span className="text-emerald-600 font-black text-sm flex items-center justify-end gap-1">
                            <ArrowDownToLine size={12} />
                            {formatRupiah(log.kredit)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap bg-red-50/30">
                        <span className="text-red-600 font-black text-base tracking-tight">
                          {formatRupiah(log.saldoBerjalan)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showInjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[9999] flex justify-center items-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                <h3 className="font-black text-xs uppercase tracking-wider">Setup Hutang Legacy</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInjectModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleInjectSaldoAwal} className="p-6 space-y-5 bg-slate-50">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Tanggal Tercatat (Excel)
                </label>
                <input
                  type="date"
                  required
                  value={injectForm.date}
                  onChange={(event) => setInjectForm({ ...injectForm, date: event.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:border-red-500 shadow-sm cursor-pointer"
                />
              </div>

              <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-inner">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">
                  Total Sisa Tagihan Kemarin
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-red-400 text-base">Rp</span>
                  <input
                    type="text"
                    required
                    value={displayInjectAmount}
                    onChange={handleInjectAmountChange}
                    className="w-full pl-12 pr-4 py-3 border-2 border-red-200 rounded-xl text-xl font-black text-red-600 bg-red-50/50 outline-none focus:bg-white focus:border-red-500 transition-colors shadow-inner"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Keterangan Referensi
                </label>
                <input
                  type="text"
                  required
                  value={injectForm.notes}
                  onChange={(event) => setInjectForm({ ...injectForm, notes: event.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:border-red-500 shadow-sm normal-case"
                  placeholder="Contoh: Sisa hutang buku bulan lalu..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-transform active:scale-95 cursor-pointer mt-2"
              >
                Suntik Saldo &amp; Kunci Sistem
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
