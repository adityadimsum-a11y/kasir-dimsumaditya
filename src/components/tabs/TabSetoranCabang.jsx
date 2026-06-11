import React, { useState, useMemo } from 'react';
import { Lock, Send, Calculator as CalcIcon, History, AlertTriangle, CheckCircle2, Wallet, FileText, ArrowRightLeft, Clock, Building2, Search } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabSetoranCabang({ 
  orders = [], orders_data, 
  expenses = [], expenses_data, 
  cashflow_transactions = [], cashflow_transactions_data,
  interbranch_treasury = [], interbranch_treasury_data,
  user, sendToSheet, showToast 
}) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'PUSAT';
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';
  
  // --- STATE FORM SETORAN ---
  const [form, setForm] = useState({
    uangFisik: '',
    nominalSetor: '',
    metode: 'Transfer BCA Pusat',
    catatan: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  // --- SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);
  const realTreasury = useMemo(() => interbranch_treasury_data || interbranch_treasury || [], [interbranch_treasury, interbranch_treasury_data]);

  // --- ALGORITMA KALKULASI KAS LACI (REAL-TIME) ---
  const calcMetrics = useMemo(() => {
    let penjualanTunai = 0;
    let piutangMarketplace = 0;
    let pengeluaranCabang = 0;

    // 1. Bedah Pemasukan Jualan (Khusus hari ini & cabang ini)
    realOrders.filter(o => !o.isDeleted && o.date?.startsWith(todayStr) && o.branch_id === currentBranch).forEach(o => {
      const channel = o.sales_channel?.toUpperCase() || '';
      const method = o.payment_method?.toUpperCase() || '';
      const amount = Number(o.amount_paid || o.total_amount || 0);

      // Jika dari Platform Online atau Non-Tunai, masuk Piutang/Marketplace
      if (['GOFOOD', 'GRABFOOD', 'SHOPEEFOOD', 'TOKOPEDIA', 'SHOPEE', 'TIKTOK_SHOP'].includes(channel) || method === 'HUTANG' || method === 'DP') {
        piutangMarketplace += amount;
      } else {
        // Uang masuk ke laci kasir (CASH / TF langsung ke kasir)
        penjualanTunai += amount;
      }
    });

    // Uang masuk manual ke laci (selain dari jualan)
    realCashflow.filter(c => !c.isDeleted && c.date?.startsWith(todayStr) && c.branch_id === currentBranch && c.type === 'IN' && c.reference_id && !c.reference_id.startsWith('ORD')).forEach(c => {
      penjualanTunai += Number(c.amount || 0);
    });

    // 2. Bedah Pengeluaran Laci Kasir Hari Ini
    realExpenses.filter(e => !e.isDeleted && e.date?.startsWith(todayStr) && e.branch_id === currentBranch).forEach(e => {
      pengeluaranCabang += Number(e.amount || 0);
    });
    realCashflow.filter(c => !c.isDeleted && c.date?.startsWith(todayStr) && c.branch_id === currentBranch && c.type === 'OUT').forEach(c => {
      pengeluaranCabang += Number(c.amount || 0);
    });

    // 3. Ekspektasi Uang Fisik Di Laci
    const ekspektasiKas = Math.max(0, penjualanTunai - pengeluaranCabang);

    return { penjualanTunai, piutangMarketplace, pengeluaranCabang, ekspektasiKas };
  }, [realOrders, realExpenses, realCashflow, todayStr, currentBranch]);

  // --- LOGIKA SELISIH (UANG FISIK VS EKSPEKTASI) ---
  const uangFisikNum = Number(form.uangFisik || 0);
  const selisih = uangFisikNum - calcMetrics.ekspektasiKas;

  // --- HISTORI SETORAN CABANG INI ---
  const historiSetoran = useMemo(() => {
    let baseData = realTreasury.filter(t => !t.isDeleted);
    
    // Kalau cabang, cuma lihat historinya dia. Kalau HQ, lihat semua.
    if (!isHQ) {
      baseData = baseData.filter(t => t.from_branch === currentBranch);
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      baseData = baseData.filter(t => t.id.toLowerCase().includes(s) || t.from_branch?.toLowerCase().includes(s) || (t.notes && t.notes.toLowerCase().includes(s)));
    }

    return baseData.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realTreasury, currentBranch, isHQ, searchTerm]);

  // --- ACTION SUBMIT SETORAN (DARI CABANG KE PUSAT) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uangFisikNum <= 0) return alert("Uang fisik belum dihitung!");
    const setorNum = Number(form.nominalSetor || 0);
    if (setorNum <= 0) return alert("Nominal setoran tidak boleh nol!");
    if (setorNum > uangFisikNum) return alert("Nominal disetor tidak boleh lebih besar dari uang fisik riil di laci!");

    if (selisih < 0) {
      const konfirmasiMinus = window.confirm(`PERINGATAN! Ada selisih MINUS (Nombok) sebesar ${formatRupiah(Math.abs(selisih))}.\n\nTetap lanjutkan proses closing?`);
      if (!konfirmasiMinus) return;
    }

    const treasuryId = generateId('SETOR', todayStr);
    
    // Payload untuk divalidasi Pusat
    const payload = {
      id: treasuryId,
      date: todayStr,
      from_branch: currentBranch,
      to_branch: 'PUSAT',
      amount: setorNum,
      method: form.metode,
      status: 'PENDING',
      notes: `Uang Fisik: ${formatRupiah(uangFisikNum)} | Selisih Laci: ${formatRupiah(selisih)} | Catatan: ${form.catatan}`
    };

    const success = await sendToSheet('insert', payload, 'interbranch_treasury');
    if (success) {
      showToast('Setoran berhasil dikirim ke Pusat! Menunggu validasi masuk ke Dompet Perusahaan.', 'success');
      setForm({ uangFisik: '', nominalSetor: '', metode: 'Transfer BCA Pusat', catatan: '' });
      if (window.confirm("Cetak struk bukti closing?")) {
        triggerPrint('NOTA_DOTMATRIX', {
          title: 'BUKTI CLOSING & SETORAN CABANG', id: treasuryId, date: formatDate(todayStr), 
          branch_name: currentBranch, admin_name: user?.name || 'KASIR', customer_name: 'HQ TANGERANG PUSAT',
          items: [
            { name: 'Total Ekspektasi Laci', qty: 1, subtotal: calcMetrics.ekspektasiKas },
            { name: 'Uang Fisik Dihitung', qty: 1, subtotal: uangFisikNum },
            { name: `Selisih Laci`, qty: 1, subtotal: selisih },
            { name: `Metode: ${form.metode}`, qty: 1, subtotal: 0 }
          ], 
          amount: setorNum, paymentMethod: 'PENDING APPROVAL'
        });
      }
    }
  };

  // --- ACTION HQ: SAHKAN SETORAN MASUK DOMPET PERUSAHAAN ---
  const handleVerifikasiPusat = async (item) => {
    if (!window.confirm(`Sahkan dana sebesar ${formatRupiah(item.amount)} dari Cabang ${item.from_branch.replace('_', ' ')} ke Dompet Pusat?`)) return;

    // 1. Update status setoran
    const updatePayload = { ...item, status: 'VERIFIED', verified_date: new Date().toISOString() };
    const successUpdate = await sendToSheet('update', updatePayload, 'interbranch_treasury');

    if (successUpdate) {
      // 2. Catat Uang Masuk ke Pusat
      await sendToSheet('insert', {
        id: generateId('CSH', todayStr), date: todayStr, branch_id: 'HQ_FACTORY', type: 'IN',
        category: 'SETORAN CABANG MASUK', description: `TERIMA SETORAN CLOSING DARI: ${item.from_branch}`, amount: Number(item.amount), method: 'TF', reference_id: item.id
      }, 'cashflow_transactions');

      // 3. Potong saldo laci cabang agar balance
      await sendToSheet('insert', {
        id: generateId('CSH', todayStr) + 'X', date: todayStr, branch_id: item.from_branch, type: 'OUT',
        category: 'SETOR CLOSING KE PUSAT', description: `Disahkan Pusat (Setoran ID: ${item.id})`, amount: Number(item.amount), method: 'CASH', reference_id: item.id
      }, 'cashflow_transactions');

      showToast('Setoran disahkan! Dana sudah masuk mutasi Dompet Perusahaan.', 'success');
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* HEADER BANNER */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-md text-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <Lock className="text-emerald-400" /> Closing &amp; Settlement Node
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Rekapitulasi harian &amp; setoran kas ke Pusat — Cabang: <span className="text-emerald-400">{currentBranch}</span>
          </p>
        </div>
        {isHQ && (
          <div className="hidden md:flex bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest items-center gap-2 border border-emerald-500/30">
            <ShieldAlert size={14}/> Mode Otorisasi Pusat Aktif
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KOLOM KIRI: KALKULASI SISTEM MESIN */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 border-b pb-3 flex items-center gap-2 mb-4">
            <CalcIcon size={16} className="text-blue-600"/> Kalkulasi Sistem (Hari Ini)
          </h3>
          
          <div className="space-y-4 flex-1">
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Penjualan Tunai / QRIS</div>
              <div className="text-xl font-black text-emerald-600">{formatRupiah(calcMetrics.penjualanTunai)}</div>
            </div>
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Piutang Marketplace &amp; Agen</div>
              <div className="text-xl font-black text-orange-500">{formatRupiah(calcMetrics.piutangMarketplace)}</div>
            </div>
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pengeluaran Laci Cabang</div>
              <div className="text-xl font-black text-rose-500">- {formatRupiah(calcMetrics.pengeluaranCabang)}</div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-dashed border-slate-300 bg-slate-50 p-4 rounded-2xl shadow-inner">
            <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Ekspektasi Kas Laci</div>
            <div className="text-3xl font-black tracking-tight text-slate-800">{formatRupiah(calcMetrics.ekspektasiKas)}</div>
          </div>
        </div>

        {/* KOLOM KANAN: FORM KASIR (INPUT FISIK & SETOR) */}
        <div className="lg:col-span-8 bg-blue-50/30 p-6 rounded-3xl border border-blue-100 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-blue-800 border-b border-blue-200 pb-3 flex items-center gap-2 mb-5">
            <Send size={16} className="text-blue-600"/> Form Setoran (Menunggu Validasi Pusat)
          </h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* INPUT 1: UANG FISIK */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-2">1. Hitung Uang Fisik Riil di Laci</label>
                <input type="text" required value={formatRupiah(form.uangFisik)} onChange={e=>setForm({...form, uangFisik: e.target.value.replace(/\D/g, '')})} className="w-full text-2xl font-black text-slate-800 outline-none placeholder:text-slate-300 bg-transparent" placeholder="Rp 0" />
                
                {form.uangFisik && (
                  <div className={`mt-3 pt-2 border-t flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${selisih === 0 ? 'text-emerald-600' : (selisih < 0 ? 'text-rose-600' : 'text-blue-600')}`}>
                    {selisih === 0 ? <><CheckCircle2 size={14}/> Laci Balance (Aman)</> : (selisih < 0 ? <><AlertTriangle size={14}/> Selisih Nombok: {formatRupiah(Math.abs(selisih))}</> : <><Wallet size={14}/> Selisih Lebih: {formatRupiah(selisih)}</>)}
                  </div>
                )}
              </div>

              {/* INPUT 2: NOMINAL DISETORKAN */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2">2. Nominal Disetor/Transfer</label>
                <input type="text" required value={formatRupiah(form.nominalSetor)} onChange={e=>setForm({...form, nominalSetor: e.target.value.replace(/\D/g, '')})} className="w-full text-2xl font-black text-slate-800 outline-none placeholder:text-slate-300 bg-transparent" placeholder="Rp 0" />
                <div className="mt-3 pt-2 border-t flex items-center justify-between text-[9px] font-bold text-slate-400">
                  <span>Isi jumlah yang dikirim ke pusat.</span>
                  {uangFisikNum > 0 && <button type="button" onClick={() => setForm({...form, nominalSetor: String(uangFisikNum)})} className="text-blue-600 font-black hover:underline uppercase">Setor Semua</button>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Metode Serah Terima</label>
                <select value={form.metode} onChange={e=>setForm({...form, metode: e.target.value})} className="w-full p-3 border border-slate-200 bg-white rounded-xl text-xs font-black uppercase outline-none cursor-pointer">
                  <option value="Transfer BCA Pusat">Transfer BCA Pusat</option>
                  <option value="Transfer Mandiri Pusat">Transfer Mandiri Pusat</option>
                  <option value="Titip Driver Logistik">Titip Tunai (Driver Logistik)</option>
                  <option value="Setor Tunai Langsung">Setor Tunai Langsung ke HQ</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Catatan Tambahan</label>
                <input type="text" value={form.catatan} onChange={e=>setForm({...form, catatan: e.target.value})} className="w-full p-3 border border-slate-200 bg-white rounded-xl text-xs font-bold outline-none" placeholder="Titip lewat supir DO..." />
              </div>
            </div>

            <button type="submit" disabled={!form.uangFisik || !form.nominalSetor} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl text-xs uppercase disabled:opacity-40 shadow-xl hover:bg-slate-800 transition-colors mt-2 tracking-widest flex items-center justify-center gap-2">
              <Send size={16}/> Kirim Setoran &amp; Tunggu Approval Pusat
            </button>
          </form>
        </div>
      </div>

      {/* TABEL HISTORI SETORAN CABANG / PUSAT */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden mt-2">
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest flex items-center gap-2">
            <History size={16} className="text-slate-500"/> Histori &amp; Status Setoran
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Cari ID / Cabang..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none bg-white focus:border-blue-400 shadow-sm" />
          </div>
        </div>
        <div className="overflow-x-auto p-2 custom-scrollbar min-h-[30vh]">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4 font-black">Tgl Settlement</th>
                <th className="px-5 py-4 font-black">Asal Cabang &amp; Metode</th>
                <th className="px-5 py-4 font-black text-right">Nominal Disetor</th>
                <th className="px-5 py-4 font-black text-center">Status / Aksi Pusat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {historiSetoran.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest">Belum ada riwayat setoran closing.</td></tr>
              ) : (
                historiSetoran.map(setoran => (
                  <tr key={setoran.id} className={`hover:bg-slate-50/70 transition-colors ${setoran.status === 'PENDING' ? 'bg-amber-50/10' : ''}`}>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-slate-800 font-black">{formatDate(setoran.date)}</div>
                      <div className="text-[9px] font-mono text-slate-400 mt-1">{setoran.id}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-black text-blue-700 uppercase flex items-center gap-1.5"><Building2 size={12} className="text-slate-400"/> {setoran.from_branch.replace('_', ' ')}</div>
                      <div className="text-[9px] text-slate-500 mt-1.5 font-bold uppercase border bg-slate-50 px-2 py-0.5 rounded inline-block">VIA: {setoran.method}</div>
                      {setoran.notes && <div className="text-[10px] text-slate-400 italic mt-1 max-w-xs line-clamp-1">"{setoran.notes}"</div>}
                    </td>
                    <td className="px-5 py-4 text-right font-black text-slate-800 text-sm whitespace-nowrap">{formatRupiah(setoran.amount)}</td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {setoran.status === 'PENDING' ? (
                        isHQ ? (
                          <button onClick={() => handleVerifikasiPusat(setoran)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 w-max mx-auto active:scale-95">
                            <CheckCircle2 size={12}/> Sahkan &amp; Tarik ke Dompet
                          </button>
                        ) : (
                          <span className="bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1 w-max mx-auto animate-pulse"><Clock size={12}/> Menunggu Pusat</span>
                        )
                      ) : (
                        <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1 w-max mx-auto"><CheckCircle2 size={12}/> Disahkan Pusat</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
