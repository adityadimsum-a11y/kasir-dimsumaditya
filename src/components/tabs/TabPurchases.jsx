import React, { useState, useMemo } from 'react';
import { 
  Truck, Package, Wallet, CalendarDays, Edit2, Trash2, 
  Printer, ArrowDownRight, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabPurchases({ 
  purchases = [], purchases_data, masterBranches = [],
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  const [activeBranchFilter, setActiveBranchFilter] = useState(isHQ ? 'SEMUA_CABANG' : currentBranch);
  const [isEditing, setIsEditing] = useState(false);

  // --- STATE FORM ---
  const [form, setForm] = useState({
    id: '', date: todayStr, supplierName: '', 
    category: 'BAHAN_BAKU', itemName: '', 
    qty: '', unit: 'KG', unitPrice: '',
    paymentMethod: 'CASH', amountPaid: '', notes: ''
  });

  const realPurchases = purchases_data || purchases || [];

  // --- ALGORITMA KALKULASI DINAMIS ---
  const kalkulasi = useMemo(() => {
    const total = Number(form.qty || 0) * Number(form.unitPrice || 0);
    let dibayar = form.paymentMethod === 'DP' ? Number(form.amountPaid || 0) : total;
    if (dibayar > total) dibayar = total; // Mencegah bayar lebih dari tagihan
    const sisa = total - dibayar;
    const isLunas = sisa <= 0;

    return { total, dibayar, sisa, isLunas };
  }, [form]);

  // --- ALGORITMA METRIK DASHBOARD ---
  const metrik = useMemo(() => {
    let totalBelanjaBulanIni = 0;
    let totalHutangAktif = 0;
    let ayamMasukKg = 0;
    const curMonth = todayStr.substring(0, 7);

    realPurchases.filter(p => !p.isDeleted && (activeBranchFilter === 'SEMUA_CABANG' || p.branch_id === activeBranchFilter)).forEach(p => {
      const isThisMonth = p.date && p.date.startsWith(curMonth);
      const hutang = Number(p.total_price) - Number(p.amount_paid);
      
      if (isThisMonth) {
        totalBelanjaBulanIni += Number(p.total_price);
        if (p.category === 'BAHAN_BAKU') ayamMasukKg += Number(p.qty_kg || 0);
      }
      if (hutang > 0) totalHutangAktif += hutang;
    });

    return { totalBelanjaBulanIni, totalHutangAktif, ayamMasukKg };
  }, [realPurchases, todayStr, activeBranchFilter]);

  // --- HANDLE PRINT (FIXED BLANK BUG) ---
  const handlePrint = (log) => {
    triggerPrint('NOTA_DOTMATRIX', {
      title: 'BUKTI PENERIMAAN GUDANG (INBOUND)',
      id: 'RCV-' + log.id.substring(4),
      date: formatDate(log.date),
      branch_name: log.branch_id || currentBranch,
      admin_name: user?.name || 'ADMIN LOGISTIK',
      customer_name: log.supplier_name?.toUpperCase(),
      position: 'SUPPLIER',
      items: [
        { 
          name: `[${log.category}] ${log.item_name}`, 
          qty: log.qty, 
          subtotal: log.total_price, 
          suffix: ` ${log.unit}` 
        }
      ],
      amount: log.total_price,
      paymentMethod: log.status === 'LUNAS' ? `LUNAS (${log.payment_method})` : 'HUTANG / DP',
      footerCustom: `TOTAL TAGIHAN: ${formatRupiah(log.total_price)}\nTELAH DIBAYAR: ${formatRupiah(log.amount_paid)}\nSISA HUTANG: ${formatRupiah(Number(log.total_price) - Number(log.amount_paid))}\n\n*Dicetak sebagai bukti sah penerimaan barang gudang.`
    });
  };

  // --- HANDLE SUBMIT ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(form.qty) <= 0 || Number(form.unitPrice) <= 0) return alert("Kuantitas dan Harga Satuan harus lebih dari 0!");
    if (form.paymentMethod === 'DP' && Number(form.amountPaid) <= 0) return alert("Masukkan nominal DP yang dibayarkan!");

    const trxId = isEditing ? form.id : generateId('PRC', form.date);
    
    // ALGORITMA SYNC STOK AYAM: Jika BAHAN_BAKU dan KG, simpan sebagai qty_kg agar dibaca TabStok
    const qtyKgSync = (form.category === 'BAHAN_BAKU' && form.unit === 'KG') ? Number(form.qty) : 0;

    const payload = {
      id: trxId, date: form.date, branch_id: currentBranch,
      supplier_name: form.supplierName.toUpperCase(),
      category: form.category, item_name: form.itemName.toUpperCase(),
      qty: Number(form.qty), unit: form.unit, qty_kg: qtyKgSync,
      unit_price: Number(form.unitPrice), total_price: kalkulasi.total,
      payment_method: form.paymentMethod, amount_paid: kalkulasi.dibayar,
      status: kalkulasi.isLunas ? 'LUNAS' : 'HUTANG',
      notes: form.notes.toUpperCase()
    };

    const action = isEditing ? 'update' : 'insert';
    const success = await sendToSheet(action, payload, 'purchases');

    if (success) {
      showToast(isEditing ? 'Data belanja diupdate!' : 'Penerimaan barang berhasil dicatat!', 'success');
      setForm({
        id: '', date: todayStr, supplierName: '', category: 'BAHAN_BAKU', itemName: '', 
        qty: '', unit: 'KG', unitPrice: '', paymentMethod: 'CASH', amountPaid: '', notes: ''
      });
      setIsEditing(false);
    }
  };

  const handleEdit = (log) => {
    setForm({
      id: log.id, date: log.date.split('T')[0], supplierName: log.supplier_name,
      category: log.category || 'BAHAN_BAKU', itemName: log.item_name,
      qty: log.qty, unit: log.unit || 'KG', unitPrice: log.unit_price,
      paymentMethod: log.payment_method || 'CASH', amountPaid: log.amount_paid,
      notes: log.notes || ''
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const historyBelanja = realPurchases.filter(p => {
    if (p.isDeleted) return false;
    if (activeBranchFilter !== 'SEMUA_CABANG' && p.branch_id !== activeBranchFilter) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 pb-10">
      
      {/* 📊 TOP METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden text-white">
          <Truck className="absolute -right-4 -bottom-4 text-emerald-500 opacity-20" size={100} />
          <div className="relative z-10">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total Belanja (Bulan Ini)</div>
            <div className="text-3xl font-black mt-1">{formatRupiah(metrik.totalBelanjaBulanIni)}</div>
            <div className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest">Ayam Masuk: {formatNumber(metrik.ayamMasukKg)} KG</div>
          </div>
        </div>

        <div className="bg-rose-50 p-5 rounded-2xl border border-rose-200 shadow-sm relative overflow-hidden">
          <AlertCircle className="absolute -right-4 -bottom-4 text-rose-500 opacity-10" size={100} />
          <div className="relative z-10">
            <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Hutang Supplier (Aktif)</div>
            <div className="text-3xl font-black text-rose-700 mt-1">{formatRupiah(metrik.totalHutangAktif)}</div>
            <div className="text-[9px] text-rose-600/80 mt-2 font-bold uppercase tracking-widest">Segera lunasi sebelum jatuh tempo</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-blue-500">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monitor Logistik</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{formatNumber(historyBelanja.length)} <span className="text-xs text-slate-500">Transaksi</span></div>
          <div className="text-[9px] font-bold text-slate-500 mt-2 pt-2 border-t border-slate-100">Riwayat penerimaan barang masuk.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KIRI: FORM INPUT BELANJA */}
        <div className={`p-6 rounded-2xl border border-t-4 transition-all h-max shadow-sm ${isEditing ? 'bg-amber-50/50 border-t-amber-500 border-amber-200' : 'bg-white border-t-blue-600'}`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm uppercase text-slate-800 flex items-center gap-2"><ArrowDownRight size={16} className="text-blue-600"/> {isEditing ? 'Revisi Logistik' : 'Input Penerimaan Barang'}</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Tanggal</label>
                <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold outline-none bg-slate-50" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Kategori Barang</label>
                <select value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-[11px] font-black outline-none bg-white uppercase cursor-pointer">
                  <option value="BAHAN_BAKU">Ayam / Bahan Baku</option>
                  <option value="PACKAGING">Packaging (Mika/Plastik)</option>
                  <option value="OPERASIONAL">Operasional Pabrik</option>
                  <option value="LAINNYA">Lain-lain</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nama Supplier / Toko</label>
              <input type="text" required value={form.supplierName} onChange={e=>setForm({...form, supplierName: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold outline-none uppercase bg-white" placeholder="CONTOH: NANA AYAM / TOKO PLASTIK JAYA" />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nama Spesifik Barang</label>
              <input type="text" required value={form.itemName} onChange={e=>setForm({...form, itemName: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold outline-none uppercase bg-white" placeholder="CONTOH: AYAM GILING / MIKA DIMSUM BESAR" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Volume Beli</label>
                <input type="number" min="0.1" step="0.1" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-black text-blue-700 outline-none bg-white text-center" placeholder="0" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Satuan</label>
                <select value={form.unit} onChange={e=>setForm({...form, unit: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black outline-none bg-white uppercase cursor-pointer">
                  <option value="KG">Kilogram (KG)</option>
                  <option value="PCS">Pcs</option>
                  <option value="BAL">Bal / Dus</option>
                  <option value="LITER">Liter</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Harga Satuan (Modal)</label>
              <input type="number" required value={form.unitPrice} onChange={e=>setForm({...form, unitPrice: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-black outline-none" placeholder="Rp 0" />
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-inner mt-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Total Tagihan Supplier</span>
                <span className="text-2xl font-black">{formatRupiah(kalkulasi.total)}</span>
              </div>
            </div>

            <div className={`p-4 rounded-xl border-2 ${form.paymentMethod === 'DP' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
              <div className="flex justify-between items-center mb-3">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">💳 Kas Keluar</label>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  {['CASH', 'TF', 'DP'].map(m => (
                    <button key={m} type="button" onClick={() => setForm({...form, paymentMethod: m})} className={`px-2.5 py-1 rounded text-[10px] font-black transition-all ${form.paymentMethod === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}>{m}</button>
                  ))}
                </div>
              </div>
              
              {form.paymentMethod === 'DP' && (
                <div className="mt-3 pt-3 border-t border-amber-200/50">
                  <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-1">Kas Dibayar Hari Ini (DP)</label>
                  <input type="number" required min="0" value={form.amountPaid} onChange={e=>setForm({...form, amountPaid: e.target.value})} className="w-full p-2.5 border-2 border-amber-300 bg-white rounded-xl text-lg font-black text-amber-700 outline-none text-right" placeholder="Rp 0" />
                  <div className="text-right text-[10px] font-black text-rose-500 mt-1 uppercase tracking-widest">Sisa Hutang: {formatRupiah(kalkulasi.sisa)}</div>
                </div>
              )}
            </div>
            
            <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
              <Package size={16}/> {isEditing ? 'Simpan Revisi' : 'Masukkan ke Gudang'}
            </button>
          </form>
        </div>
        
        {/* KANAN: ARSIP BELANJA */}
        <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
            <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2"><CalendarDays size={14} className="text-blue-600"/> Riwayat Belanja Logistik</h4>
            {isHQ && (
              <select value={activeBranchFilter} onChange={e => setActiveBranchFilter(e.target.value)} className="text-[10px] font-black uppercase bg-white border rounded-lg px-2 py-1 outline-none text-slate-600 cursor-pointer shadow-sm">
                <option value="SEMUA_CABANG">🌍 NASIONAL</option>
                {masterBranches.filter(b=>!b.isDeleted).map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_id}</option>)}
              </select>
            )}
          </div>
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b border-slate-200">
                <tr><th className="px-4 py-3">ID &amp; Tanggal</th><th className="px-4 py-3">Supplier &amp; Item</th><th className="px-4 py-3 text-center">Volume</th><th className="px-4 py-3">Tagihan &amp; Status</th><th className="px-4 py-3 text-center">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {historyBelanja.length === 0 && (<tr><td colSpan="5" className="px-4 py-12 text-center text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">Belum Ada Riwayat Belanja</td></tr>)}
                {historyBelanja.slice(0, 50).map(log => {
                  const sisaHutang = Number(log.total_price) - Number(log.amount_paid);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-800">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="uppercase text-slate-700 font-black line-clamp-1">{log.supplier_name}</div>
                        <div className="text-[9px] font-black text-blue-500 mt-0.5 uppercase flex items-center gap-1">
                          <Package size={10}/> {log.item_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded text-[10px] font-black uppercase">{formatNumber(log.qty)} {log.unit}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-black text-slate-700">{formatRupiah(log.total_price)}</div>
                        <div className={`text-[9px] font-black mt-0.5 uppercase tracking-widest px-1.5 py-0.5 rounded inline-block ${sisaHutang > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {sisaHutang > 0 ? `HUTANG (Sisa: ${formatRupiah(sisaHutang)})` : <span className="flex items-center gap-1"><CheckCircle2 size={10}/> LUNAS</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => handlePrint(log)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg" title="Cetak Penerimaan Gudang"><Printer size={12}/></button>
                          {isHQ && (
                            <>
                              <button type="button" onClick={() => handleEdit(log)} className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg"><Edit2 size={12}/></button>
                              <button type="button" onClick={() => { if(window.confirm("Void penerimaan barang ini?")) requestDelete(log.id); }} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg"><Trash2 size={12}/></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
