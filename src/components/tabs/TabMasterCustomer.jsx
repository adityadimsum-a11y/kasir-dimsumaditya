import React, { useState, useMemo } from 'react';
import { 
  Users, Search, ShieldAlert, Award, FileText, 
  Printer, ArrowUpRight, ArrowDownRight, User, Heart, ShoppingBag, Clock, Coins, Gift
} from 'lucide-react';
import { formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabMasterCustomer({ 
  orders = [], 
  masterCustomers = [], master_customers,
  setPrintData,
  showToast,
  user
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  
  // State Anggaran Pengelolaan Bonus / THR
  const [bonusBudget, setBonusBonusBudget] = useState(2000000); 

  const realCustomers = useMemo(() => master_customers || masterCustomers || [], [master_customers, masterCustomers]);
  const activeCustomers = useMemo(() => realCustomers.filter(c => !c.isDeleted), [realCustomers]);

  // --- ENGINE SAKTI INTELLESENSE CUSTOMER DATA CDP ---
  const customerIntelligenceData = useMemo(() => {
    const dataMap = {};
    const today = new Date();

    // Inisialisasi kerangka data master customer
    activeCustomers.forEach(c => {
      dataMap[c.customer_name.toUpperCase()] = {
        meta: c,
        totalTransaksi: 0,
        totalQty: 0,
        totalNominal: 0,
        lastOrderDate: null,
        productMap: {},
        weeklyHistory: { lastWeekQty: 0, currentWeekQty: 0 },
        ordersList: []
      };
    });

    const oneWeekAgo = new Date(); oneWeekAgo.setDate(today.getDate() - 7);
    const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(today.getDate() - 14);

    // Proses data transaksi penjualan
    (orders || []).forEach(o => {
      if (o.isDeleted) return;
      const cName = String(o.customer_name || '').toUpperCase();
      if (!dataMap[cName]) return;

      const items = safeJsonParse(o.items, []);
      const orderDate = new Date(o.date);

      dataMap[cName].totalTransaksi += 1;
      dataMap[cName].totalNominal += Number(o.total_amount || 0);
      dataMap[cName].ordersList.push(o);

      if (!dataMap[cName].lastOrderDate || orderDate > new Date(dataMap[cName].lastOrderDate)) {
        dataMap[cName].lastOrderDate = o.date;
      }

      items.forEach(it => {
        const q = Number(it.qty || 0);
        dataMap[cName].totalQty += q;
        dataMap[cName].productMap[it.name] = (dataMap[cName].productMap[it.name] || 0) + q;

        // Analitik Fluktuasi Perilaku Belanja Mingguan
        if (orderDate >= oneWeekAgo && orderDate <= today) {
          dataMap[cName].weeklyHistory.currentWeekQty += q;
        } else if (orderDate >= twoWeeksAgo && orderDate < oneWeekAgo) {
          dataMap[cName].weeklyHistory.lastWeekQty += q;
        }
      });
    });

    // Menghitung status retensi, performa fluktuasi, dan kelayakan bonus
    return Object.values(dataMap).map(c => {
      let status = 'AKTIF';
      let statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      
      if (c.lastOrderDate) {
        const diffTime = Math.abs(today - new Date(c.lastOrderDate));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 14) {
          status = 'TIDAK AKTIF';
          statusColor = 'bg-rose-50 text-rose-700 border-rose-200';
        } else if (diffDays > 7) {
          status = 'PERLU FOLLOW UP';
          statusColor = 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
        }
      } else {
        status = 'TIDAK AKTIF';
        statusColor = 'bg-rose-50 text-rose-700 border-rose-200';
      }

      // Hitung persentase fluktuasi
      let fluctuationLabel = 'Stabil';
      let fluctuationColor = 'text-slate-500';
      const lW = c.weeklyHistory.lastWeekQty;
      const cW = c.weeklyHistory.currentWeekQty;

      if (lW > 0) {
        const percent = ((cW - lW) / lW) * 100;
        if (percent > 0) {
          fluctuationLabel = `▲ Naik ${percent.toFixed(0)}%`;
          fluctuationColor = 'text-emerald-600 font-black';
        } else if (percent < 0) {
          fluctuationLabel = `▼ Turun ${Math.abs(percent).toFixed(0)}%`;
          fluctuationColor = 'text-rose-600 font-black';
        }
      } else if (cW > 0) {
        fluctuationLabel = '▲ Baru / Naik 100%';
        fluctuationColor = 'text-emerald-600 font-black';
      }

      // Rekomendasi Program Loyalitas Bonus / THR otomatis
      let rekomendasiBonus = 'Hadiah Produk 25 Pcs';
      let nilaiBonusEstimasi = 50000;
      if (c.totalNominal > 10000000) {
        rekomendasiBonus = 'Uang THR Tunai Rp 250.000';
        nilaiBonusEstimasi = 250000;
      } else if (c.totalNominal > 5000000) {
        rekomendasiBonus = 'Hadiah Produk 100 Pcs';
        nilaiBonusEstimasi = 150000;
      } else if (c.totalNominal > 2000000) {
        rekomendasiBonus = 'Hadiah Produk 50 Pcs';
        nilaiBonusEstimasi = 100000;
      }

      return {
        ...c,
        status,
        statusColor,
        fluctuationLabel,
        fluctuationColor,
        rekomendasiBonus,
        nilaiBonusEstimasi,
        rataRataBelanja: c.totalTransaksi > 0 ? Math.floor(c.totalNominal / c.totalTransaksi) : 0
      };
    });
  }, [activeCustomers, orders, todayStr]);

  const filteredIntelligenceList = useMemo(() => {
    if (!searchTerm) return customerIntelligenceData;
    const s = searchTerm.toLowerCase();
    return customerIntelligenceData.filter(c => c.meta.customer_name.toLowerCase().includes(s));
  }, [customerIntelligenceData, searchTerm]);

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customerIntelligenceData.find(c => c.meta.id === selectedCustomerId);
  }, [customerIntelligenceData, selectedCustomerId]);

  // --- PRINT REKAP BONUSES & THR (MANAJERIAL FORMAT A4) ---
  const handlePrintBonusTHR = () => {
    if (typeof setPrintData !== 'function') return;
    
    // Siapkan struktur data manajerial kustom A4
    setPrintData({
      title: 'LAPORAN REKAPITULASI DISTRIBUSI THR & LOYALITAS PELANGGAN',
      id: generateId('THR', todayStr),
      date: formatDate(todayStr),
      branch_name: 'MANAGEMENT HEADQUARTER',
      admin_name: user?.name || 'DIREKTUR UTAMA',
      customer_name: 'SELURUH NODE JALUR AGEN & MITRA',
      paymentMethod: 'DOKUMEN APRESIASI AKHIR TAHUN',
      // Selundupkan data ke dalam manifes cetak
      items: filteredIntelligenceList.map((c, idx) => ({
        name: `[RANK #${idx + 1}] ${c.meta.customer_name}\nKATEGORI: ${c.meta.category} | TOTAL BELANJA: ${formatRupiah(c.totalNominal)}\nPROGRAM HADIAH: ${c.rekomendasiBonus}`,
        qty: c.totalTransaksi,
        suffix: ' x Order',
        subtotal: c.nilaiBonusEstimasi
      })),
      amount: filteredIntelligenceList.reduce((sum, c) => sum + c.nilaiBonusEstimasi, 0)
    });
    showToast("Dokumen Laporan THR berhasil dikirim ke antrean cetak!", "success");
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* ATAS: MONITOR DANA BONUS AMPLOP MANAGEMENT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-holo bg-white p-5 border border-slate-200 rounded-2xl shadow-2xs border-t-4 border-t-orange-500">
          <div className="text-[10px] font-black text-slate-400 uppercase">Amplop Anggaran Alokasi Bonus CRM</div>
          <div className="text-2xl font-black text-slate-800 tracking-tight mt-1">{formatRupiah(bonusBudget)}</div>
          <input 
            type="range" min="500000" max="10000000" step="500000" 
            value={bonusBudget} onChange={e=>setBonusBonusBudget(Number(e.target.value))}
            className="w-full mt-3 accent-orange-500 cursor-pointer h-1 bg-slate-100 rounded-lg appearance-none"
          />
        </div>
        <div className="card-holo bg-white p-5 border border-slate-200 rounded-2xl shadow-2xs border-t-4 border-t-blue-500">
          <div className="text-[10px] font-black text-slate-400 uppercase">Pelanggan Butuh Tindakan (Follow Up)</div>
          <div className="text-2xl font-black text-amber-600 tracking-tight mt-1">
            {formatNumber(customerIntelligenceData.filter(c => c.status === 'PERLU FOLLOW UP').length)} <span className="text-xs font-bold text-slate-400">Jiwa</span>
          </div>
          <div className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 mt-2 inline-block">Tidak melakukan repeat order &gt; 7 Hari</div>
        </div>
        <div className="card-holo bg-slate-900 p-5 border border-slate-800 rounded-2xl shadow-md text-white flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold text-orange-400 uppercase">Aksi Cetak Manajerial</div>
            <div className="text-xs font-medium text-slate-400 mt-0.5">Keluarkan dokumen fisik insentif loyalitas.</div>
          </div>
          <button type="button" onClick={handlePrintBonusTHR} className="bg-orange-500 hover:bg-orange-600 text-white font-black py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-2 mt-3 shadow-sm transition-colors cursor-pointer w-full">
            <Printer size={14}/> Cetak Rekap THR A4
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: REKAPAN RETENSI DATABASE CUSTOMER INTELLIGENCE */}
        <div className="lg:col-span-5 card-holo bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col h-[70vh] overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
            <h4 className="font-black text-xs text-slate-800 flex items-center gap-1.5"><Users size={16} className="text-orange-500"/> Intelijen Pelanggan</h4>
            <div className="relative w-full sm:w-48">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-orange-400 shadow-3xs normal-case" placeholder="Cari nama..." />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {filteredIntelligenceList.map(c => (
              <div 
                key={c.meta.id} 
                onClick={() => setSelectedCustomerId(c.meta.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${selectedCustomerId === c.meta.id ? 'bg-orange-50/50 border-orange-400 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300 shadow-3xs'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-black text-slate-800 text-xs uppercase leading-tight">{c.meta.customer_name}</h5>
                    <div className="text-[9px] font-bold text-slate-400 normal-case mt-0.5">Kategori: {c.meta.category} • Wilayah: {c.meta.address}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded border text-[8px] font-black tracking-wide ${c.statusColor}`}>{c.status}</span>
                </div>
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 text-[10px] font-bold">
                  <div className="text-slate-500">Pola Belanja: <span className={c.fluctuationColor}>{c.fluctuationLabel}</span></div>
                  <div className="text-slate-800 font-black">{formatRupiah(c.totalNominal)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KANTONG KANAN: PROFIL DETIL INSIGHT CUSTOMER INTELLIGENCE */}
        <div className="lg:col-span-7 flex flex-col gap-4 h-[70vh]">
          {!selectedCustomer ? (
            <div className="card-holo bg-white border border-slate-200 rounded-2xl p-8 flex-1 flex flex-col items-center justify-center text-center text-slate-400 shadow-2xs">
              <ShieldAlert size={40} className="opacity-20 mb-3 text-orange-500" />
              <div className="text-xs font-bold normal-case">Silakan klik salah satu kartu pelanggan di sebelah kiri untuk membedah data profil intelijen &amp; kelayakan reward secara terukur.</div>
            </div>
          ) : (
            <div className="card-holo bg-white border border-slate-200 rounded-2xl shadow-2xs flex-1 flex flex-col overflow-hidden">
              
              {/* HEADER PROFIL */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 shrink-0 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-8 rounded-xl bg-orange-500 text-white font-black text-sm flex items-center justify-center shadow-inner">{selectedCustomer.meta.customer_name.charAt(0)}</div>
                  <div>
                    <h4 className="font-black text-slate-800 text-sm uppercase leading-none">{selectedCustomer.meta.customer_name}</h4>
                    <span className="text-[9px] text-slate-400 font-bold mt-1 block normal-case">ID: {selectedCustomer.meta.id} • Terdaftar sejak: {formatDate(selectedCustomer.meta.date)}</span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-[9px] font-black border tracking-wider ${selectedCustomer.statusColor}`}>{selectedCustomer.status}</span>
              </div>

              {/* RANGKUMAN CONTENT SCROLLABLE INSIGHT */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-xs">
                
                {/* 1. INFORMASI DASAR */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-inner">
                  <div><div className="text-[9px] text-slate-400 font-bold normal-case">No. Handphone</div><div className="font-black text-slate-800 text-xs mt-0.5">{selectedCustomer.meta.phone}</div></div>
                  <div><div className="text-[9px] text-slate-400 font-bold normal-case">Alamat Kirim</div><div className="font-bold text-slate-700 text-xs mt-0.5 truncate">{selectedCustomer.meta.address}</div></div>
                </div>

                {/* 2. RINGKASAN PEMBELIAN */}
                <div>
                  <h5 className="font-black text-slate-800 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"><ShoppingBag size={12} className="text-orange-500"/> Ringkasan Akumulasi Pembelian</h5>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="border border-slate-100 bg-white p-2 rounded-xl shadow-3xs"><div className="text-[8px] text-slate-400 font-bold">Total Transaksi</div><div className="font-black text-slate-800 text-sm mt-0.5">{selectedCustomer.totalTransaksi}x</div></div>
                    <div className="border border-slate-100 bg-white p-2 rounded-xl shadow-3xs"><div className="text-[8px] text-slate-400 font-bold">Total Volume Pcs</div><div className="font-black text-blue-600 text-sm mt-0.5">{formatNumber(selectedCustomer.totalQty)}</div></div>
                    <div className="border border-slate-100 bg-white p-2 rounded-xl shadow-3xs"><div className="text-[8px] text-slate-400 font-bold">Nilai Belanja</div><div className="font-black text-emerald-600 text-sm mt-0.5">{formatRupiah(selectedCustomer.totalNominal)}</div></div>
                    <div className="border border-slate-100 bg-white p-2 rounded-xl shadow-3xs"><div className="text-[8px] text-slate-400 font-bold">Rerata Per Invoice</div><div className="font-black text-purple-600 text-[11px] mt-0.5">{formatRupiah(selectedCustomer.rataRateBelanja)}</div></div>
                  </div>
                </div>

                {/* 3. REKOMENDASI PROGRAM APRESIASI BONUS / THR */}
                <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-4 flex items-center justify-between shadow-3xs">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl text-orange-500 border border-orange-100 shadow-3xs"><Gift size={16}/></div>
                    <div>
                      <div className="text-[10px] font-black text-orange-800 uppercase tracking-wider">Klaim Amplop THR &amp; Reward Mitra</div>
                      <div className="text-[11px] font-black text-slate-800 mt-0.5 normal-case">Rekomendasi: <span className="text-orange-600 font-black">{selectedCustomer.rekomendasiBonus}</span></div>
                    </div>
                  </div>
                  <div className="text-right text-[9px] text-slate-400 font-bold normal-case">
                    Terakhir Order:<br/>
                    <span className="font-black text-slate-700 text-xs">{selectedCustomer.lastOrderDate ? formatDate(selectedCustomer.lastOrderDate) : 'Belum Ada'}</span>
                  </div>
                </div>

                {/* 4. PRODUK FAVORIT */}
                <div>
                  <h5 className="font-black text-slate-800 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"><Heart size={12} className="text-rose-500"/> Analitik Menu Produk Terfavorit</h5>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                    {Object.entries(selectedCustomer.product_name || selectedCustomer.productMap).length === 0 ? (
                      <div className="text-[10px] text-slate-400 font-medium py-2">Belum ada rekam jejak produk terdaftar.</div>
                    ) : (
                      Object.entries(selectedCustomer.product_name || selectedCustomer.productMap)
                        .sort((a,b) => b[1] - a[1])
                        .map(([pName, pQty]) => (
                          <div key={pName} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="font-bold text-slate-700 text-[11px] uppercase truncate max-w-[200px]">{pName}</span>
                            <span className="font-black text-slate-900 text-xs">{formatNumber(pQty)} <span className="text-[9px] text-slate-400 font-normal">PCS</span></span>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* 5. HISTORI DETIL NOTA BELANJA */}
                <div>
                  <h5 className="font-black text-slate-800 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"><Clock size={12} className="text-blue-500"/> Log Histori Aliran Transaksi</h5>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                    {selectedCustomer.ordersList.map(o => (
                      <div key={o.id} className="flex justify-between items-center p-2 bg-white rounded-lg border border-slate-100 shadow-3xs">
                        <div>
                          <div className="font-black text-slate-800 text-[10px]">{o.id}</div>
                          <div className="text-[8px] text-slate-400 font-mono mt-0.5">{formatDate(o.date)} • VIA: {o.payment_method}</div>
                        </div>
                        <span className="font-black text-emerald-600 text-xs">{formatRupiah(o.total_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
