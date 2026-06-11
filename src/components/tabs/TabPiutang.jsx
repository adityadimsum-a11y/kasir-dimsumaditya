import React, { useState, useMemo } from 'react';
import { Landmark, Search, Edit2, Trash2, Printer, CheckCircle2, Lock, Banknote, Calendar } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabPiutang({ 
  orders = [], orders_data, cashflow_transactions = [], cashflow_transactions_data,
  user, sendToSheet, showToast, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  const [searchTerm, setSearchTerm] = useState('');
  
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);

  // --- ENGINE KOMPILASI BUKU PIUTANG AGEN ---
  const piutangList = useMemo(() => {
    let list = [];
    // Tarik semua nota Kasir yang pembayarannya 'DP' atau 'HUTANG'
    realOrders.filter(o => !o.isDeleted && ['DP', 'HUTANG'].includes(o.payment_method)).forEach(o => {
      if (!isHQ && o.branch_id !== currentBranch) return; // Cabang cuma lihat hutang cabangnya

      const totalTagihan = Number(o.total_amount || 0);
      let totalTerbayar = Number(o.amount_paid || 0);

      // Cari history cicilan/pelunasan di buku kas yang nyambung ke ID Nota ini
      realCashflow.filter(c => !c.isDeleted && c.type === 'IN' && c.reference_id === o.id).forEach(c => {
        totalTerbayar += Number(c.amount || 0);
      });

      const sisaHutang = Math.max(0, totalTagihan - totalTerbayar);
      const isLunas = sisaHutang === 0 || o.status === 'SELESAI';

      // Saring pencarian nama agen
      if (searchTerm && !o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) && !o.id.toLowerCase().includes(searchTerm.toLowerCase())) return;

      list.push({ ...o, totalTagihan, totalTerbayar, sisaHutang, isLunas });
    });

    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realOrders, realCashflow, isHQ, currentBranch, searchTerm]);

  // --- ACTIONS: PELUNASAN PIUTANG ---
  const handleBayarCicilan = async (piutang) => {
    const nominalInput = window.prompt(`Sisa tagihan Nota ${piutang.id} (${piutang.customer_name}): ${formatRupiah(piutang.sisaHutang)}\n\nMasukkan nominal pembayaran (Tanpa Titik):`, piutang.sisaHutang);
    
    if (!nominalInput) return;
    const nominal = Number(nominalInput.replace(/\D/g, ''));
    if (nominal <= 0 || isNaN(nominal)) return alert("Nominal tidak valid!");
    if (nominal > piutang.sisaHutang) return alert("Pembayaran melebihi sisa hutang!");

    const trxId = generateId('BYR', todayStr);
    
    // 1. Catat Uang Masuk ke Buku Kas (Mempengaruhi Dompet Perusahaan)
    const cashInPayload = {
      id: trxId, date: todayStr, branch_id: piutang.branch_id, type: 'IN',
      category: 'PELUNASAN PIUTANG AGEN', description: `Cicilan Nota: ${piutang.id} (${piutang.customer_name})`,
      amount: nominal, method: 'CASH', reference_id: piutang.id
    };

    if (await sendToSheet('insert', cashInPayload, 'cashflow_transactions')) {
      // 2. Jika Lunas, update status nota induk jadi 'SELESAI'
      if (nominal === piutang.sisaHutang) {
        await sendToSheet('update', { ...piutang, status: 'SELESAI' }, 'orders');
      }
      
      showToast(`Pembayaran ${formatRupiah(nominal)} berhasil dicatat!`, 'success');
      
      if (window.confirm("Cetak Kwitansi Pembayaran?")) {
        triggerPrint('NOTA_DOTMATRIX', {
          title: 'KWITANSI PELUNASAN PIUTANG', id: trxId, date: formatDate(todayStr),
          branch_name: piutang.branch_id, admin_name: user?.name || 'KASIR', customer_name: piutang.customer_name,
          items: [{ name: `Pembayaran Hutang Nota: ${piutang.id}`, qty: 1, subtotal: nominal }],
          amount: nominal, paymentMethod: 'CASH / TRANSFER'
        });
      }
    }
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* HEADER PAGE */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Landmark className="text-orange-500"/> Buku Piutang &amp; Hutang Agen
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">Pemantauan tagihan agen yang belum lunas (Bon/Tempo).</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Cari nama agen atau ID nota..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-orange-400 shadow-sm" />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto p-2 custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
              <tr>
                <th className="px-5 py-4 font-black">Nota &amp; Tanggal</th>
                <th className="px-5 py-4 font-black">Nama Agen (Klien)</th>
                <th className="px-5 py-4 font-black text-right">Total Tagihan</th>
                <th className="px-5 py-4 font-black text-right">Sisa Hutang</th>
                <th className="px-5 py-4 font-black text-center">Aksi Validasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {piutangList.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">Tidak ada riwayat piutang/hutang agen.</td></tr>
              ) : (
                piutangList.map(log => {
                  // 🔥 LOGIKA GEMBOK WAKTU ANTI FRAUD (TIME-LOCK) PADA PIUTANG
                  // (Karena piutang itu nota lama, kita tidak block tombol "Terima Uang" karena klien bayar di hari beda. 
                  // Yang di-block adalah penghapusan nota induk).
                  const isLogToday = log.date.substring(0, 10) === todayStr;
                  const canVoid = isHQ || isLogToday;

                  return (
                    <tr key={log.id} className={`hover:bg-slate-50/70 transition-colors group ${log.isLunas ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-4 whitespace-nowrap"><div className="text-slate-800 font-black">{formatDate(log.date)}</div><div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div></td>
                      <td className="px-5 py-4"><div className="font-black text-sm text-slate-800 uppercase line-clamp-1">{log.customer_name}</div><div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">Tipe: {log.payment_method}</div></td>
                      <td className="px-5 py-4 text-right whitespace-nowrap text-slate-600">{formatRupiah(log.totalTagihan)}</td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {log.isLunas ? (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 uppercase flex items-center justify-end gap-1"><CheckCircle2 size={12}/> LUNAS</span>
                        ) : (
                          <span className="text-sm font-black text-rose-600">{formatRupiah(log.sisaHutang)}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {!log.isLunas && (
                            <button onClick={() => handleBayarCicilan(log)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-colors">
                              <Banknote size={12}/> Terima Uang
                            </button>
                          )}
                          
                          {/* TOMBOL VOID DENGAN GEMBOK WAKTU */}
                          {canVoid ? (
                            <button type="button" onClick={() => { if(window.confirm("Batalkan nota hutang ini?")) requestDelete(log.id); }} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" title="Void Nota">
                              <Trash2 size={14}/>
                            </button>
                          ) : (
                            <span className="text-[10px] flex items-center gap-1 text-slate-300 font-bold px-1" title="Nota Terkunci"><Lock size={12}/></span>
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
