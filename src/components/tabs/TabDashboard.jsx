import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, 
  AlertOctagon, ShieldCheck, Database, Layers, Package,
  ArrowRight, Clock, UserCheck, X, CheckCircle2, DollarSign
} from 'lucide-react';
import { safeJsonParse, generateId, getTodayStr } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabDashboard({ 
  orders = [], orders_data,
  purchases = [], purchases_data,
  expenses = [], expenses_data,
  inventoryCostLayers = [], inventory_cost_layers,
  productionBatches = [], production_batches,
  cashflowTransactions = [], cashflow_transactions,
  supplierInvoices = [], supplier_invoices,
  setActiveTab, showToast, sendToSheet
}) {

  const todayStr = getTodayStr();

  // 🔥 STATE POPUP KEMBALIAN SULTAN
  const [settleModal, setSettleModal] = useState(null);
  const [settleForm, setSettleForm] = useState({ actualReturned: '', upahJalan: '', pembulatan: '0' });

  // --- SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realInventory = useMemo(() => inventory_cost_layers || inventoryCostLayers || [], [inventory_cost_layers, inventoryCostLayers]);
  const realProduction = useMemo(() => production_batches || productionBatches || [], [production_batches, production_batches]);
  const realCashflow = useMemo(() => cashflow_transactions || cashflowTransactions || [], [cashflow_transactions, cashflowTransactions]);
  const realInvoices = useMemo(() => supplier_invoices || supplierInvoices || [], [supplier_invoices, supplierInvoices]);

  // --- ENGINE KALKULATOR DASHBOARD ---
  const ringkasan = useMemo(() => {
    let totalKas = 0;
    realCashflow.forEach(c => {
      if (!c.isDeleted) {
        if (c.type === 'IN') totalKas += Number(c.amount || 0);
        if (c.type === 'OUT') totalKas -= Number(c.amount || 0);
      }
    });

    let totalPiutang = 0;
    realOrders.forEach(o => {
      if (!o.isDeleted) {
        const tagihan = Number(o.total_amount || 0);
        const masuk = Number(o.amount_paid || 0);
        if (tagihan > masuk) totalPiutang += (tagihan - masuk);
      }
    });

    let totalHutang = 0;
    realInvoices.forEach(inv => {
      if (!inv.isDeleted && inv.status_payment === 'BELUM_LUNAS') {
        totalHutang += Number(inv.remaining_bill || inv.total_bill || 0);
      }
    });

    let nilaiAsetGudang = 0;
    let sisaAyamKantong = 0;
    realInventory.forEach(inv => {
      if (!inv.isDeleted) {
        nilaiAsetGudang += (Number(inv.qty_remaining || 0) * Number(inv.unit_cost || 0));
        if (inv.category === 'BAHAN_BAKU') sisaAyamKantong += Number(inv.qty_remaining || 0);
      }
    });

    let sisaDimsumPcs = 0;
    realProduction.forEach(b => {
      if (!b.isDeleted) sisaDimsumPcs += Number(b.actual_yield || b.qty || 0);
    });
    realOrders.forEach(o => {
      if (!o.isDeleted) {
        const items = safeJsonParse(o.items, []);
        items.forEach(i => { sisaDimsumPcs -= Number(i.qty || 0); });
      }
    });

    let omzetSeminggu = 0;
    realOrders.forEach(o => {
      if (!o.isDeleted) omzetSeminggu += Number(o.total_amount || 0);
    });

    return {
      totalKas, totalPiutang, totalHutang, nilaiAsetGudang,
      sisaAyamKantong, sisaAyamKg: sisaAyamKantong * 10,
      sisaDimsumPcs, sisaDimsumMika: Math.floor(sisaDimsumPcs / 50),
      omzetSeminggu
    };
  }, [realOrders, realInventory, realProduction, realCashflow, realInvoices]);

  // ==========================================
  // 🔥 RADAR DETEKTOR KEMBALIAN KRITIS (IDE BOS SULTAN)
  // ==========================================
  const pendingKembalianList = useMemo(() => {
    const groups = {};
    
    // Scan dari Purchases
    realPurchases.forEach(p => {
      if (!p.isDeleted && p.change_status === 'PENDING' && p.kasbon_id) {
        if (!groups[p.kasbon_id]) {
          groups[p.kasbon_id] = { id: p.kasbon_id, employee: p.employee_name, cash_given: Number(p.cash_given || 0), expected_change: Number(p.expected_change || 0), total_nota: 0, origin: 'purchases' };
        }
        groups[p.kasbon_id].total_nota += Number(p.total_amount || p.amount || 0);
      }
    });

    // Scan dari Expenses
    realExpenses.forEach(e => {
      if (!e.isDeleted && e.change_status === 'PENDING' && e.kasbon_id) {
        if (!groups[e.kasbon_id]) {
          groups[e.kasbon_id] = { id: e.kasbon_id, employee: e.employee_name, cash_given: Number(e.cash_given || 0), expected_change: Number(e.expected_change || 0), total_nota: 0, origin: 'expenses' };
        }
        groups[e.kasbon_id].total_nota += Number(e.amount || 0);
      }
    });

    return Object.values(groups);
  }, [realPurchases, realExpenses]);

  const isAyamKritis = ringkasan.sisaAyamKantong <= 5;

  // ==========================================
  // 🔥 SETTLEMENT: SUBMIT KEMBALIAN MASUK (TUTUP BUKU)
  // ==========================================
  const handleExecuteSettlement = async () => {
    if (!settleModal) return;
    const actualReturned = Number(settleForm.actualReturned || 0);
    const upahJalan = Number(settleForm.upahJalan || 0);
    const pembulatan = Number(settleForm.pembulatan || 0);
    
    const totalAlokasi = actualReturned + upahJalan + pembulatan;
    
    if (totalAlokasi !== settleModal.expected_change) {
       return alert(`Total pembagian uang (${formatRupiah(totalAlokasi)}) tidak balance dengan sisa kembalian wajib (${formatRupiah(settleModal.expected_change)})!`);
    }

    // 1. Update status isinya di sheet 'purchases' & 'expenses' pararel
    const rowsToUpdatePurchases = realPurchases.filter(p => p.kasbon_id === settleModal.id);
    for (let r of rowsToUpdatePurchases) {
       await sendToSheet('update', { ...r, change_status: 'SETTLED' }, 'purchases');
    }
    const rowsToUpdateExpenses = realExpenses.filter(e => e.kasbon_id === settleModal.id);
    for (let r of rowsToUpdateExpenses) {
       await sendToSheet('update', { ...r, change_status: 'SETTLED' }, 'expenses');
    }

    // 2. Jika ada uang cash kembali masuk laci (IN)
    if (actualReturned > 0) {
      await sendToSheet('insert', {
        id: generateId('CFI', todayStr), date: todayStr, branch_id: 'TANGERANG_PUSAT', type: 'IN',
        category: 'PENGEMBALIAN KASBON', description: `Kembalian Sisa Belanja dari ${settleModal.employee}`,
        amount: actualReturned, method: 'CASH', reference_id: settleModal.id
      }, 'cashflow_transactions');
    }

    // 3. Jika ada Upah Jalan / Tip Owner yang merelakan kembalian (OUT EXPENSE)
    if (upahJalan > 0) {
      await sendToSheet('insert', {
        id: generateId('EXP', todayStr), date: todayStr, branch_id: 'TANGERANG_PUSAT',
        category: 'OPERASIONAL', description: `UPAH JALAN / TIP BELANJA: ${settleModal.employee}`,
        amount: upahJalan, payment_method: 'CASH', isDeleted: false
      }, 'expenses');
    }

    // 4. Jika ada Pembulatan Ikhlas Rugi Kas (OUT EXPENSE)
    if (pembulatan > 0) {
      await sendToSheet('insert', {
        id: generateId('EXP', todayStr), date: todayStr, branch_id: 'TANGERANG_PUSAT',
        category: 'BIAYA UMUM / OPS', description: `PEMBULATAN RUGI RECEH BELANJA: ${settleModal.employee}`,
        amount: pembulatan, payment_method: 'CASH', isDeleted: false
      }, 'expenses');
    }

    showToast(`Buku Kasbon kembalian ${settleModal.employee} resmi ditutup & ditandai Lunas Balance!`);
    setSettleModal(null);
    setSettleForm({ actualReturned: '', upahJalan: '', pembulatan: '0' });
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* BANNER HEAD */}
      <div className="bg-[#151a25] rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div>
           <h2 className="text-white font-black uppercase tracking-widest text-lg flex items-center gap-2">
             <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
             Dashboard Utama &amp; Keuangan Pabrik
           </h2>
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Sistem Pemantauan Terpadu Dimsum Aditya Exp — Real-time &amp; Terkunci</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-right min-w-[200px] shadow-inner">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nilai Uang Aset Gudang (HPP)</div>
          <div className="text-xl font-black text-white tracking-tight">{formatRupiah(ringkasan.nilaiAsetGudang)}</div>
        </div>
      </div>

      {/* 🔥 INDIKATOR ATAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-blue-400 transition-colors">
          <div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between"><span>Uang di Dompet Perusahaan (Kas Kasir)</span></div><div className="text-2xl font-black text-slate-900 tracking-tight">{formatRupiah(ringkasan.totalKas)}</div></div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-colors">
          <div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between"><span>Total Sisa Bon / Piutang Agen</span></div><div className="text-2xl font-black text-amber-600 tracking-tight">{formatRupiah(ringkasan.totalPiutang)}</div></div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-rose-400 transition-colors">
          <div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between"><span>Hutang Belum Bayar ke Supplier</span></div><div className="text-2xl font-black text-rose-600 tracking-tight">{formatRupiah(ringkasan.totalHutang)}</div></div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 🔥 BARU: RADAR PANTAU KEMBALIAN KARYAWAN (TEROR MATA!) */}
      {/* ========================================== */}
      {pendingKembalianList.length > 0 && (
         <div className="bg-white rounded-3xl border-2 border-indigo-500 p-5 shadow-lg space-y-3 animate-in shake duration-300">
            <div className="text-[10px] font-black uppercase text-indigo-700 tracking-widest flex items-center gap-1.5">
               <AlertOctagon size={14} className="text-indigo-600 animate-bounce"/> RADAR PANTAU PIUTANG KEMBALIAN BELANJA KARYAWAN
            </div>
            <div className="grid grid-cols-1 gap-3">
               {pendingKembalianList.map(item => (
                 <div key={item.id} className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <div className="font-black text-xs text-indigo-900 uppercase">⚠️ {item.employee} BELUM SETOR SISA KEMBALIAN!</div>
                      <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                        Kas Diberikan: <span className="text-slate-900 font-black">{formatRupiah(item.cash_given)}</span> | 
                        Total Nota Belanja: <span className="text-slate-900 font-black">{formatRupiah(item.total_nota)}</span>
                      </p>
                      <div className="text-[11px] text-rose-600 font-black uppercase">Wajib Di-tagih: {formatRupiah(item.expected_change)}</div>
                    </div>
                    {/* KLIK UNTUK SETTLEMENT TUTUP BUKU */}
                    <button 
                      type="button" 
                      onClick={() => setSettleModal(item)}
                      className="bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest px-4 py-3 rounded-xl shadow-md hover:bg-indigo-700 active:scale-95 transition cursor-pointer"
                    >
                      Terima Sisa Kembalian
                    </button>
                 </div>
               ))}
            </div>
         </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><AlertOctagon size={14} className="text-blue-500"/> Sistem Pengingat Belanja Otomatis</span>
            </div>
            {isAyamKritis ? (
              <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                 <div className="space-y-1">
                   <h4 className="font-black text-rose-800 text-xs">🚨 PERINGATAN: STOK AYAM FILLET MENIPIS!</h4>
                   <p className="text-[10px] font-bold text-rose-600/90 uppercase">Sisa daging mentah di freezer tinggal {ringkasan.sisaAyamKantong} Kantong ({ringkasan.sisaAyamKg} Kg).</p>
                 </div>
                 <button type="button" onClick={() => { if(setActiveTab) setActiveTab('purchases'); }} className="bg-rose-600 text-white font-black text-[10px] uppercase px-4 py-3 rounded-xl shadow-md">Buat Nota Belanja <ArrowRight size={14}/></button>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center gap-3">
                 <ShieldCheck size={24} className="text-emerald-600"/>
                 <div><h4 className="font-black text-emerald-800 text-xs">KONDISI GUDANG AMAN TERKENDALI</h4></div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Omzet Penjualan (7 Hari Terakhir)</div>
             <div className="bg-slate-50 border p-10 rounded-2xl text-center shadow-inner">
                <div className="text-4xl font-black text-emerald-600 tracking-tight mb-2">{formatRupiah(ringkasan.omzetSeminggu)}</div>
             </div>
          </div>
        </div>

        {/* KONDISI FISIK GUDANG */}
        <div className="lg:col-span-4 bg-[#151a25] rounded-3xl p-5 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div className="space-y-5">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-3"><Database size={14} className="text-blue-400"/> Kondisi Fisik Gudang Pusat</div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1.5">Sisa Daging Ayam Mentah Fillet</div>
              <div className="text-2xl font-black text-white tracking-tight">{formatNumber(ringkasan.sisaAyamKg)} <span className="text-xs text-slate-500 font-bold">KG</span></div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Sisa Dimsum Frozen Di Freezer</div>
              <div className="text-2xl font-black text-white tracking-tight">{formatNumber(ringkasan.sisaDimsumPcs)} <span className="text-xs text-slate-500 font-bold">PCS</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 🔥 MODAL POPUP SETTLEMENT KEMBALIAN (PINTAR!) */}
      {/* ========================================== */}
      {settleModal && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border overflow-hidden flex flex-col">
               
               <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                  <div className="flex items-center gap-2 text-indigo-700">
                     <UserCheck size={18}/>
                     <span className="font-black text-xs uppercase tracking-widest">Tutup Buku Kasbon: {settleModal.employee}</span>
                  </div>
                  <button onClick={()=>setSettleModal(null)} className="p-1 text-slate-400 hover:text-rose-600"><X size={16}/></button>
               </div>

               <div className="p-5 space-y-4 font-bold text-xs text-slate-700">
                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex justify-between items-center">
                     <span className="uppercase text-[10px] font-black tracking-wider text-indigo-800">Sisa Kembalian Wajib Tagih:</span>
                     <span className="text-lg font-black text-indigo-900">{formatRupiah(settleModal.expected_change)}</span>
                  </div>

                  <div>
                     <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">1. Uang Cash yang Diterima Masuk Laci</label>
                     <input type="number" value={settleForm.actualReturned} onChange={e=>setSettleForm({...settleForm, actualReturned: e.target.value})} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl font-black text-sm" placeholder="Masukkan jumlah cash..." />
                  </div>

                  <div>
                     <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">2. Dijadikan Upah Jalan / Tip Karyawan (Beban Ops)</label>
                     <input type="number" value={settleForm.upahJalan} onChange={e=>setSettleForm({...settleForm, upahJalan: e.target.value})} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl font-black text-sm text-blue-600" placeholder="Rp 0" />
                  </div>

                  <div>
                     <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">3. Pembulatan Ikhlas Kurang Receh (Beban Lainnya)</label>
                     <input type="number" value={settleForm.pembulatan} onChange={e=>setSettleForm({...settleForm, pembulatan: e.target.value})} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl font-black text-sm text-rose-600" placeholder="Rp 0" />
                  </div>

                  <div className="border-t pt-3 flex gap-2">
                     <button type="button" onClick={()=>setSettleModal(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-black uppercase text-[10px]">Batal</button>
                     <button type="button" onClick={handleExecuteSettlement} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-md flex items-center justify-center gap-1"><CheckCircle2 size={12}/> Sahkan Buku</button>
                  </div>
               </div>

            </div>
         </div>
      )}

    </div>
  );
}
