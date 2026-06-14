import React, { useState, useMemo } from 'react';
// 🔥 FIX CRASH: IKON 'X' TETAP TERJAGA DI SINI
import { Landmark, ArrowDownToLine, Receipt, Send, AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabSupplierAyam({ 
  purchases = [], purchases_data, cashflow_transactions = [], cashflow_transactions_data,
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // Nama Supplier Patokan Jantung Pabrik
  const CORE_SUPPLIER = 'Nana Ayam';

  const [formBayar, setFormBayar] = useState({ 
    date: todayStr, amount: '', method: 'TF_BCA', notes: '' 
  });
  
  const [showInjectModal, setShowInjectModal] = useState(false);
  const [injectForm, setInjectForm] = useState({ amount: '', date: todayStr, notes: 'Saldo hutang masa lalu (Excel)' });

  // --- SINKRONISASI DATABASE ---
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);

  // --- ALGORITMA REKENING KORAN (RUNNING BALANCE) ---
  const bukuRekeningKoran = useMemo(() => {
    let ledger = [];

    // 1. TARIK SEMUA DATA AYAM TURUN (Menambah Hutang / DEBIT)
    realPurchases.forEach(p => {
      if (p.isDeleted) return;
      if (p.category === 'BAHAN_BAKU' || String(p.supplier_name).toUpperCase().includes(CORE_SUPPLIER.toUpperCase())) {
        ledger.push({
          id: p.id,
          date: p.date,
          type: 'Tagihan masuk',
          description: `Ayam turun: ${p.qty_kg || p.qty} Kg (Nota: ${p.id})`,
          debit: Number(p.total_amount || 0), 
          kredit: 0,
          sortDate: new Date(p.date)
        });
      }
    });

    // 2. TARIK SEMUA DATA PEMBAYARAN & SELIPAN CICILAN (Mengurangi Hutang / KREDIT)
    realCashflow.forEach(c => {
      if (c.isDeleted || c.type !== 'OUT') return;
      if (c.category === 'PELUNASAN HUTANG AYAM' || c.category === 'SALDO_AWAL_HUTANG_AYAM' || (c.category === 'PEMBELIAN BAHAN_BAKU' && c.description.toUpperCase().includes(CORE_SUPPLIER.toUpperCase()))) {
        
        if (c.category === 'SALDO_AWAL_HUTANG_AYAM') {
           ledger.push({
             id: c.id, date: c.date, type: 'Saldo awal',
             description: c.description,
             debit: Number(c.amount || 0), 
             kredit: 0,
             sortDate: new Date(c.date)
           });
        } else {
           ledger.push({
             id: c.id, date: c.date, type: 'Pembayaran',
             description: `Bayar / cicil (${String(c.method).replace('_', ' ')}): ${c.description}`,
             debit: 0,
             kredit: Number(c.amount || 0), 
             sortDate: new Date(c.date)
           });
        }
      }
    });

    // 3. PROSES PENGHITUNGAN RUNNING BALANCE (SALDO BERJALAN)
    ledger.sort((a, b) => a.sortDate - b.sortDate);

    let currentBalance = 0;
    let totalAyamTurun = 0;
    let totalUangDibayar = 0;

    ledger.forEach(item => {
      currentBalance += item.debit;
      currentBalance -= item.kredit;
      item.saldoBerjalan = currentBalance;

      if (item.type === 'Tagihan masuk' || item.type === 'Saldo awal') totalAyamTurun += item.debit;
      if (item.type === 'Pembayaran') totalUangDibayar += item.kredit;
    });

    const finalLedger = [...ledger].reverse();

    return { 
      ledger: finalLedger, 
      sisaHutang: currentBalance,
      totalAyamTurun,
      totalUangDibayar
    };
  }, [realPurchases, realCashflow]);

  // --- ACTIONS: SUBMIT PEMBAYARAN ---
  const handleBayarCicilan = async (e) => {
    e.preventDefault();
    const nominal = Number(formBayar.amount);
    if (nominal <= 0) return alert("Nominal transfer tidak boleh kosong!");

    if (window.confirm(`Konfirmasi Transfer & Potong Saldo ${formBayar.method.replace('_', ' ')}:\n\nNominal: ${formatRupiah(nominal)}\n\nLanjutkan pembayaran ke Supplier ${CORE_SUPPLIER}?`)) {
      
      const trxId = generateId('CFO', formBayar.date);
      const payload = {
        id: trxId, date: formBayar.date, branch_id: currentBranch, type: 'OUT',
        category: 'PELUNASAN HUTANG AYAM',
        description: `Transfer pembayaran ayam / cicilan selipan: ${formBayar.notes.toUpperCase()}`,
        amount: nominal, method: formBayar.method
      };

      if (await sendToSheet('insert', payload, 'cashflow_transactions')) {
        showToast(`Pembayaran Rp ${formatNumber(nominal)} berhasil! Sisa hutang gantung otomatis berkurang.`, 'success');
        setFormBayar({ date: todayStr, amount: '', method: 'TF_BCA', notes: '' });
      }
    }
  };

  // --- ACTIONS: SUNTIK SALDO HUTANG MASA LALU ---
  const handleInjectSaldoAwal = async (e) => {
    e.preventDefault();
    const nominal = Number(injectForm.amount);
    if (nominal <= 0) return;

    if (window.confirm(`PERINGATAN: Memasukkan saldo hutang masa lalu sebesar ${formatRupiah(nominal)}.\nData ini akan menjadi fondasi awal hutang pabrik. Lanjutkan?`)) {
      
      const payload = {
        id: generateId('LGCY', injectForm.date), date: injectForm.date, branch_id: currentBranch, type: 'OUT',
        category: 'SALDO_AWAL_HUTANG_AYAM', description: injectForm.notes.toUpperCase(),
        amount: nominal, method: 'SISTEM'
      };

      if (await sendToSheet('insert', payload, 'cashflow_transactions')) {
        showToast('Saldo hutang masa lalu berhasil disuntikkan ke sistem!', 'success');
        setShowInjectModal(false);
      }
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      
      {/* BANNER UTAMA JANTUNG PABRIK - FLAT CARD EXCLUSIVE STYLE */}
      <div className="card-holo p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between relative overflow-hidden text-slate-800">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600"></div>
        <div className="relative z-10 w-full pl-2">
          <h2 className="text-lg md:text-xl font-extrabold flex items-center gap-3">
            <ShieldAlert className="text-red-600" size={22}/> 
            Buku jantung pabrik: Supplier {CORE_SUPPLIER}
          </h2>
          <p className="text-[10px] font-semibold text-slate-400 mt-1">
            Rekening koran akumulasi hutang daging ayam &amp; histori pembayaran cicilan lintas waktu.
          </p>
        </div>
        <div className="relative z-10 mt-6 md:mt-0 text-left md:text-right shrink-0">
          <div className="text-[9px] font-bold text-red-600 bg-red-50 px-3 py-1 rounded-md border border-red-200 inline-block mb-1">Grand total sisa hutang saat ini</div>
          <div className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{formatRupiah(bukuRekeningKoran.sisaHutang)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM TRANSFER PEMBAYARAN */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="card-holo p-6 border-t-4 border-t-red-600 shadow-sm">
            <form onSubmit={handleBayarCicilan} className="space-y-5">
              <h3 className="font-bold text-slate-800 text-xs pb-3 border-b flex items-center gap-2">
                <Send size={14} className="text-red-600"/> Bayar ayam &amp; selipan cicilan
              </h3>

              <div>
                <label className="text-[9px] font-bold text-slate-500 block mb-1">Total nominal uang transfer</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 font-bold text-slate-400 text-sm">Rp</span>
                  <input type="text" required value={formBayar.amount ? Number(formBayar.amount).toLocaleString('id-ID') : ''} onChange={e=>setFormBayar({...formBayar, amount: e.target.value.replace(/\D/g, '')})} className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 bg-slate-50 rounded-xl font-black text-base text-slate-800 outline-none focus:bg-white focus:border-red-500 transition-colors shadow-inner" placeholder="0" />
                </div>
                <p className="text-[9px] font-medium text-slate-400 mt-2 leading-relaxed">Ket: Masukkan total transfer (Contoh: Beli ayam hari ini 38 jt + cicilan 5 jt = ketik 43.000.000).</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1">Tanggal transfer</label>
                  <input type="date" required value={formBayar.date} onChange={e=>setFormBayar({...formBayar, date: e.target.value})} className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none cursor-pointer focus:border-red-400" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1">Rekening asal</label>
                  <select required value={formBayar.method} onChange={e=>setFormBayar({...formBayar, method: e.target.value})} className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none cursor-pointer focus:border-red-400">
                    <option value="TF_BCA">BCA pusat</option>
                    <option value="TF_BRI">BRI pusat</option>
                    <option value="CASH">Kas tunai laci</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 block mb-1">Memo / Keterangan transfer</label>
                <input type="text" required value={formBayar.notes} onChange={e=>setFormBayar({...formBayar, notes: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 outline-none focus:bg-white focus:border-red-400" placeholder="Cth: Bayar ayam turun + cicil 5 juta" />
              </div>

              <button type="submit" className="w-full btn-holo py-3 rounded-xl text-xs font-bold shadow-xs">
                Sah! Kurangi sisa hutang
              </button>
            </form>
          </div>

          {/* KOTAK TOMBOL SUNTIK SALDO AWAL */}
          <div className="card-holo border-l-4 border-l-red-500 p-5 shadow-sm text-center bg-red-50/10">
            <AlertTriangle size={20} className="text-red-500 mx-auto mb-2"/>
            <div className="text-[10px] font-bold text-slate-700 normal-case mb-1">Setup hutang legacy (Excel)</div>
            <div className="text-[9px] font-medium text-slate-400 normal-case leading-relaxed mb-3">Gunakan menu ini satu kali saja untuk memindahkan sisa tagihan kemarin (Excel) ke dalam sistem ERP.</div>
            <button type="button" onClick={() => setShowInjectModal(true)} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-[9px] font-bold shadow-xs hover:bg-slate-900 transition-colors">Input saldo awal</button>
          </div>
        </div>

        {/* KANTONG KANAN: TABEL REKENING KORAN */}
        <div className="lg:col-span-8 card-holo flex flex-col overflow-hidden shadow-sm">
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="font-bold text-xs normal-case text-slate-800 flex items-center gap-2">
                <Receipt size={16} className="text-red-600"/> Buku mutasi (Running balance) supplier
              </h4>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5 normal-case">Histori ayam turun vs uang dibayar (Otomatis)</p>
            </div>
            <div className="text-left sm:text-right text-[10px] font-medium">
               <div className="text-slate-500">Total ayam turun: <span className="font-bold text-slate-700">{formatRupiah(bukuRekeningKoran.totalAyamTurun)}</span></div>
               <div className="text-emerald-600 mt-0.5">Total uang dibayar: <span className="font-extrabold">{formatRupiah(bukuRekeningKoran.totalUangDibayar)}</span></div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-1 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-200 text-[10px] text-slate-400 normal-case sticky top-0 shadow-xs bg-white">
                <tr>
                  <th className="px-5 py-3 font-bold">Tgl &amp; ID</th>
                  <th className="px-5 py-3 font-bold min-w-[200px]">Deskripsi transaksi</th>
                  <th className="px-5 py-3 text-right font-bold">Tagihan (Debit)</th>
                  <th className="px-5 py-3 text-right font-bold">Pembayaran (Kredit)</th>
                  <th className="px-5 py-3 text-right font-bold bg-red-50/60 text-red-900">Sisa hutang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs bg-white">
                {bukuRekeningKoran.ledger.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-16 text-slate-400 normal-case font-bold">Belum ada riwayat transaksi dengan supplier {CORE_SUPPLIER}.</td></tr>
                ) : (
                  bukuRekeningKoran.ledger.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-slate-50 transition-colors bg-white">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-bold">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold normal-case border shadow-xs mb-1 inline-block ${log.type === 'TAGIHAN_MASUK' ? 'bg-amber-50 text-amber-700 border-amber-200' : log.type === 'SALDO_AWAL' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {log.type.replace('_', ' ').toLowerCase()}
                        </span>
                        <div className="text-slate-700 text-xs font-medium normal-case leading-relaxed">{log.description}</div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {log.debit > 0 ? <span className="text-slate-800 font-extrabold">{formatRupiah(log.debit)}</span> : '-'}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {log.kredit > 0 ? <span className="text-emerald-600 font-extrabold flex items-center justify-end gap-0.5"><ArrowDownToLine size={10}/> {formatRupiah(log.kredit)}</span> : '-'}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap bg-red-50/20">
                        <span className="text-red-600 font-black text-sm tracking-tight">{formatRupiah(log.saldoBerjalan)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* POP-UP MODAL INJECT SALDO AWAL MASA LALU */}
      {showInjectModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex justify-center items-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
             <div className="bg-red-600 text-white px-5 py-4 flex items-center justify-between">
               <div className="flex items-center gap-2"><AlertTriangle size={16}/><h3 className="font-bold text-xs normal-case">Setup hutang legacy</h3></div>
               <button onClick={() => setShowInjectModal(false)} className="hover:text-red-200 transition"><X size={18}/></button>
             </div>
             <form onSubmit={handleInjectSaldoAwal} className="p-5 space-y-4">
               <div>
                 <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Tanggal tercatat</label>
                 <input type="date" required value={injectForm.date} onChange={e=>setInjectForm({...injectForm, date: e.target.value})} className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none" />
               </div>
               <div>
                 <label className="text-[9px] font-bold text-red-600 normal-case block mb-1">Total sisa tagihan kemarin (Dari Excel)</label>
                 <div className="relative">
                   <span className="absolute left-4 top-2.5 font-bold text-red-500 text-xs">Rp</span>
                   <input type="text" required value={injectForm.amount ? Number(injectForm.amount).toLocaleString('id-ID') : ''} onChange={e=>setInjectForm({...injectForm, amount: e.target.value.replace(/\D/g, '')})} className="w-full pl-10 pr-4 py-2 border-2 border-red-200 bg-red-50/40 rounded-xl font-bold text-sm text-red-700 outline-none" placeholder="0" />
                 </div>
               </div>
               <div>
                 <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Keterangan referensi</label>
                 <input type="text" required value={injectForm.notes} onChange={e=>setInjectForm({...injectForm, notes: e.target.value})} className="w-full p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 outline-none" />
               </div>
               <button type="submit" className="w-full btn-holo py-3 rounded-lg text-xs font-bold">Suntik saldo &amp; kunci sistem</button>
             </form>
          </div>
        </div>
      )}

    </div>
  );
}
