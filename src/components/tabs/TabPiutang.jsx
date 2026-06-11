import React, { useState, useMemo } from 'react';
import { Landmark, Search, Trash2, Printer, CheckCircle2, Lock, Banknote, ArrowUpRight, ArrowDownToLine, FileText, Filter } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabPiutang({ 
  orders = [], orders_data, 
  purchases = [], purchases_data,
  cashflow_transactions = [], cashflow_transactions_data,
  user, sendToSheet, showToast, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  const [subTab, setSubTab] = useState('OUTSTANDING'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('SEMUA'); 

  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);

  const ledgerData = useMemo(() => {
    let activeRecords = [];
    let archivedRecords = [];

    let totalPiutangMacet = 0;
    let totalHutangGantung = 0;

    realOrders.filter(o => !o.isDeleted).forEach(o => {
      if (!isHQ && o.branch_id !== currentBranch) return;
      if (!['DP', 'HUTANG', 'PIUTANG'].includes(o.payment_method) && o.status !== 'PIUTANG') return;

      const totalTagihan = Number(o.total_amount || 0);
      let totalTerbayar = Number(o.amount_paid || 0);

      realCashflow.filter(c => !c.isDeleted && c.type === 'IN' && c.reference_id === o.id).forEach(c => {
        totalTerbayar += Number(c.amount || 0);
      });

      const sisaHutang = Math.max(0, totalTagihan - totalTerbayar);
      const isLunas = sisaHutang === 0 || o.status === 'SELESAI';

      const recordObj = {
        id: o.id, date: o.date, branch_id: o.branch_id,
        kategori: 'PIUTANG_AGEN', labelKategori: 'PIUTANG AGEN',
        clientName: o.customer_name?.toUpperCase() || 'AGEN ANONIM',
        total: totalTagihan, terbayar: totalTerbayar, sisa: sisaHutang,
        isLunas, rawOrder: o
      };

      if (isLunas) {
        archivedRecords.push(recordObj);
      } else {
        totalPiutangMacet += sisaHutang;
        activeRecords.push(recordObj);
      }
    });

    realPurchases.filter(p => !p.isDeleted).forEach(p => {
      if (!isHQ && p.branch_id !== currentBranch) return;
      if (!['BON_GANTUNG', 'HUTANG'].includes(p.payment_method) && p.status !== 'HUTANG') return;

      const totalTagihan = Number(p.total_amount || p.amount || 0);
      let totalTerbayar = Number(p.amount_paid || 0);

      realCashflow.filter(c => !c.isDeleted && c.type === 'OUT' && c.reference_id === p.id).forEach(c => {
        totalTerbayar += Number(c.amount || 0);
      });

      const sisaHutang = Math.max(0, totalTagihan - totalTerbayar);
      const isLunas = sisaHutang === 0 || p.status === 'LUNAS';

      const recordObj = {
        id: p.id, date: p.date, branch_id: p.branch_id,
        kategori: 'HUTANG_BON', labelKategori: 'HUTANG BON GANTUNG',
        clientName: p.supplier_name?.toUpperCase() || 'SUPPLIER AYAM',
        total: totalTagihan, terbayar: totalTerbayar, sisa: sisaHutang,
        isLunas, rawPurchase: p
      };

      if (isLunas) {
        archivedRecords.push(recordObj);
      } else {
        totalHutangGantung += sisaHutang;
        activeRecords.push(recordObj);
      }
    });

    const filterFn = (list) => list.filter(r => {
      if (filterType !== 'SEMUA' && r.kategori !== filterType) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!r.clientName.toLowerCase().includes(s) && !r.id.toLowerCase().includes(s)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      outstanding: filterFn(activeRecords),
      historyLunas: filterFn(archivedRecords),
      totalPiutangMacet,
      totalHutangGantung
    };
  }, [realOrders, realPurchases, realCashflow, isHQ, currentBranch, searchTerm, filterType]);

  const displayedList = subTab === 'OUTSTANDING' ? ledgerData.outstanding : ledgerData.historyLunas;

  // --- ACTIONS (DENGAN INJEKSI SINKRONISASI BUKU UTANG SUPPLIER) ---
  const handleEksekusiCicilan = async (record) => {
    const isPiutang = record.kategori === 'PIUTANG_AGEN';
    
    const inputNominal = window.prompt(
      `PROSES ${isPiutang ? 'PENERIMAAN PIUTANG AGEN' : 'PELUNASAN HUTANG BON AYAM'}\n` +
      `Klien: ${record.clientName}\n` +
      `Sisa Saldo Gantung: ${formatRupiah(record.sisa)}\n\n` +
      `Masukkan jumlah nominal uang bayar/tagih (Angka Mentah):`, record.sisa
    );

    if (!inputNominal) return;
    const nominal = Number(inputNominal.replace(/\D/g, ''));
    if (nominal <= 0 || isNaN(nominal)) return alert("Nominal pembayaran tidak valid!");
    if (nominal > record.sisa) return alert("Nominal melebihi sisa sisa tagihan dagang!");

    const trxId = generateId(isPiutang ? 'BYR' : 'PAY', todayStr);
    const isLunasFinal = nominal === record.sisa;

    // 1. DATA DOMPET PERUSAHAAN (CASHFLOW)
    const cashflowPayload = {
      id: trxId, date: todayStr, branch_id: record.branch_id,
      type: isPiutang ? 'IN' : 'OUT',
      category: isPiutang ? 'PELUNASAN PIUTANG AGEN' : 'PELUNASAN HUTANG SUPPLIER',
      description: `${isPiutang ? 'Terima cicilan' : 'Bayar hutang'} Nota: ${record.id} (${record.clientName})`,
      amount: nominal, method: 'CASH', reference_id: record.id
    };

    // 2. DATA BUKU UTANG PABRIK (SUPPLIER LEDGER) - HANYA JIKA BAYAR SUPPLIER
    let ledgerPayload = null;
    if (!isPiutang) {
      ledgerPayload = {
          id: generateId('SL-PAY', todayStr),
          date: todayStr,
          branch_id: record.branch_id,
          supplier_name: record.clientName.toUpperCase(),
          transaction_type: 'PAYMENT', 
          amount: nominal,
          description: `Cicilan/Pelunasan untuk PO: ${record.id}`,
          reference_id: record.id
      };
    }

    // --- TEMBAK KE DATABASE BERUNTUN ---
    if (await sendToSheet('insert', cashflowPayload, 'cashflow_transactions')) {
      
      // Tembak pengurangan hutang supplier secara diam-diam (Background Sync)
      if (ledgerPayload) {
          sendToSheet('insert', ledgerPayload, 'supplier_ledger');
      }

      // Update status nota induk jika sudah lunas total
      if (isLunasFinal) {
        if (isPiutang) {
          await sendToSheet('update', { ...record.rawOrder, status: 'SELESAI' }, 'orders');
        } else {
          await sendToSheet('update', { ...record.rawPurchase, status: 'LUNAS' }, 'purchases');
        }
      }

      showToast(`Transaksi sebesar ${formatRupiah(nominal)} sukses dicatat & Kas Dompet ter-update!`, 'success');
      
      if (window.confirm("Cetak Kwitansi Pelunasan Buku Besar?")) {
        triggerPrint('NOTA_DOTMATRIX', {
          title: isPiutang ? 'KWITANSI PENERIMAAN PIUTANG' : 'BUKTI BAYAR HUTANG DAGANG', id: trxId, date: formatDate(todayStr),
          branch_name: record.branch_id, admin_name: user?.name || 'FINANCE', customer_name: record.clientName,
          items: [{ name: `Angsuran/Pelunasan untuk ID Nota: ${record.id}`, qty: 1, subtotal: nominal }],
          amount: nominal, paymentMethod: 'KAS UTAMA'
        });
      }
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between border-l-4 border-l-orange-500">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ArrowDownToLine size={12} className="text-orange-500"/> Total Uang Piutang Macet di Luar</div>
            <div className="text-2xl font-black text-orange-600 tracking-tight mt-1">{formatRupiah(ledgerData.totalPiutangMacet)}</div>
          </div>
          <div className="bg-orange-50 text-orange-600 p-3 rounded-2xl border border-orange-100"><Landmark size={20}/></div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between border-l-4 border-l-rose-500">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ArrowUpRight size={12} className="text-rose-500"/> Total Hutang Bon Gantung Pabrik</div>
            <div className="text-2xl font-black text-rose-600 tracking-tight mt-1">{formatRupiah(ledgerData.totalHutangGantung)}</div>
          </div>
          <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl border border-rose-100"><Banknote size={20}/></div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex bg-slate-200 p-1 rounded-2xl border shadow-inner w-full sm:w-auto">
            <button type="button" onClick={() => setSubTab('OUTSTANDING')} className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${subTab === 'OUTSTANDING' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>⚠️ Tagihan Aktif ({displayedList.length})</button>
            <button type="button" onClick={() => setSubTab('HISTORY_LUNAS')} className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${subTab === 'HISTORY_LUNAS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>✅ Histori Lunas Arsir</button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-700 outline-none cursor-pointer shadow-sm">
                <option value="SEMUA">📊 Tampilkan Semua</option>
                <option value="PIUTANG_AGEN">🍊 PIUTANG AGEN</option>
                <option value="HUTANG_BON">🐔 HUTANG SUPPLIER</option>
              </select>
            </div>

            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input type="text" placeholder="Cari nama klien/ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-44 pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none bg-white focus:border-blue-400 shadow-sm" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto p-2 custom-scrollbar min-h-[45vh]">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-black">Tanggal &amp; ID Nota</th>
                <th className="px-4 py-3 font-black">Klasifikasi Buku</th>
                <th className="px-4 py-3 font-black">Nama Klien / Supplier</th>
                <th className="px-4 py-3 font-black text-right">Nilai Total</th>
                <th className="px-4 py-3 font-black text-right">Sudah Dicicil</th>
                <th className="px-4 py-3 font-black text-right">Sisa Saldo Gantung</th>
                <th className="px-4 py-3 font-black text-center">Aksi / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {displayedList.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">
                  <div className="flex justify-center mb-2 opacity-30"><FileText size={36}/></div>
                  Belum ada rekapan data {subTab === 'OUTSTANDING' ? 'tagihan aktif' : 'histori pelunasan'}
                </td></tr>
              ) : (
                displayedList.map(record => {
                  const isPiutang = record.kategori === 'PIUTANG_AGEN';
                  const isLogToday = record.date.substring(0, 10) === todayStr;
                  const canVoid = isHQ || isLogToday;

                  return (
                    <tr key={record.id} className={`hover:bg-slate-50/80 transition-colors group ${record.isLunas ? 'bg-slate-50/40 opacity-75' : ''}`}>
                      <td className="px-4 py-4 whitespace-nowrap"><div className="text-slate-800 font-black">{formatDate(record.date)}</div><div className="text-[9px] font-mono text-slate-400 mt-0.5">{record.id}</div></td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase border tracking-wider shadow-sm ${isPiutang ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {record.labelKategori}
                        </span>
                      </td>
                      <td className="px-4 py-4"><div className="font-black text-slate-800 text-sm uppercase line-clamp-1">{record.clientName}</div>{isHQ && <div className="text-[8px] text-slate-400 font-black tracking-wider uppercase mt-0.5">CAB: {record.branch_id}</div>}</td>
                      <td className="px-4 py-4 text-right whitespace-nowrap text-slate-500 font-bold">{formatRupiah(record.total)}</td>
                      <td className="px-4 py-4 text-right whitespace-nowrap text-emerald-600">{formatRupiah(record.terbayar)}</td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        {record.isLunas ? (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded uppercase inline-block"><CheckCircle2 size={10} className="inline mr-0.5"/> LUNAS</span>
                        ) : (
                          <span className="text-sm font-black text-rose-600">{formatRupiah(record.sisa)}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {!record.isLunas && (
                            <button type="button" onClick={() => handleEksekusiCicilan(record)} className={`px-3 py-1.5 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1 transition-transform active:scale-95 ${isPiutang ? 'bg-orange-600 hover:bg-orange-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                              <Banknote size={12}/> {isPiutang ? 'Tarik Bon' : 'Bayar Bon'}
                            </button>
                          )}

                          <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                            title: isPiutang ? 'BUKTI NOTA PIUTANG AGEN' : 'BUKTI NOTA HUTANG SUPPLIER', id: record.id, date: formatDate(record.date),
                            branch_name: record.branch_id, admin_name: user?.name || 'FINANCE', customer_name: record.clientName,
                            items: [{ name: `Tagihan Komponen Asal`, qty: 1, subtotal: record.total }], amount: record.total, paymentMethod: 'SISTEM BUKU BESAR',
                            history: { labelLama: 'Nilai Total Nota Awal', nominalLama: record.total, labelAksi: 'Total Berhasil Terbayar', nominalAksi: record.terbayar, labelBaru: 'SISA SALDO GANTUNG SEKARANG', nominalBaru: record.sisa }
                          })} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Cetak Slip Rekap"><Printer size={15}/></button>

                          {canVoid ? (
                            <button type="button" onClick={() => { if(window.confirm("Void total data transaksi induk ini?")) requestDelete(record.id); }} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-40 group-hover:opacity-100" title="Void Nota Induk">
                              <Trash2 size={15}/>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-300 px-1 font-black" title="Terkunci"><Lock size={12}/></span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
