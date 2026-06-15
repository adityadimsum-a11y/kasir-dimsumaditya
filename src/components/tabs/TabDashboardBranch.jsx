import React, { useState, useMemo } from 'react';
import { Calendar, Printer, Wallet, Coins, CreditCard, Factory } from 'lucide-react';
import { getTodayStr, getLocalYMD, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

const StatCard = ({ title, amount, icon, color }) => (
  <div className={`p-5 rounded-2xl border flex flex-col justify-between shadow-xs ${color}`}>
    <div className="flex justify-between items-start mb-4">
      <h3 className="font-bold text-xs opacity-90 normal-case">{title}</h3>
      <div className="p-2 bg-white/60 rounded-xl shadow-3xs">{icon}</div>
    </div>
    <div className="text-2xl font-black tracking-tight">{amount}</div>
  </div>
);

export default function TabDashboardBranch({ orders = [], pemalangReports = [], piutangPayments = [], setPrintData, stokData = [] }) {
  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const MASTER_AYAM_KG = 30; 
  const MASTER_PCS = 1000; 
  const KG_PER_KANTONG = 10;
  const PCS_PER_MIKA = 50;

  const rekap = useMemo(() => {
    const isPeriod = (d) => {
      const ymd = getLocalYMD(d);
      return ymd >= dateFrom && ymd <= dateTo;
    };
    
    const branchOrdersAll = (orders || []).filter(o => o?.category === 'Pemalang');
    const branchOrdersPeriod = branchOrdersAll.filter(o => isPeriod(o?.date));
    const branchReportsPeriod = (pemalangReports || []).filter(r => isPeriod(r?.date));
    
    const totalPenjualanKotor = branchOrdersPeriod.reduce((sum, o) => sum + (Number(o.total || o.total_amount || 0)), 0);
    const totalPcs = branchOrdersPeriod.reduce((sum, o) => sum + (Number(o.qty || 0)), 0);
    const setoranKePusat = branchReportsPeriod.reduce((sum, r) => sum + (Number(r.nominal || r.amount || 0)), 0);
    
    const piutangBerjalan = branchOrdersAll.map(o => {
        const cicilan = (piutangPayments || []).filter(p => p.orderId === o.id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const baseTotal = Number(o.total || o.total_amount || 0);
        const basePaid = Number(o.amount_paid || o.paidAmount || 0);
        return { ...o, sisaTagihan: baseTotal - basePaid - cicilan, statusProduksi: o.statusProduksi || 'Menunggu Produksi' };
    }).filter(o => o.sisaTagihan > 0 && o.statusProduksi === 'Sudah Diambil');
    
    const totalPiutangBaru = piutangBerjalan.reduce((sum, o) => sum + o.sisaTagihan, 0);

    let totalTerbayarPeriode = 0;
    const customerMap = {};
    const groupedOrders = {};
    
    branchOrdersPeriod.forEach(o => {
        const cicilanData = (piutangPayments || []).filter(p => p.orderId === o.id);
        const cicilan = cicilanData.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const baseTotal = Number(o.total || o.total_amount || 0);
        const basePaid = Number(o.amount_paid || o.paidAmount || 0);
        const terbayar = basePaid + cicilan;
        const sisa = baseTotal - terbayar;
        
        totalTerbayarPeriode += terbayar;

        const cName = String(o.customer || o.customer_name || 'UMUM').toUpperCase();
        if(!customerMap[cName]) customerMap[cName] = { name: cName, qty: 0, porsi: 0, total: 0, frequency: 0 };
        customerMap[cName].qty += Number(o.qty || 0);
        customerMap[cName].porsi += (Number(o.qty || 0) / 4);
        customerMap[cName].total += baseTotal;
        customerMap[cName].frequency += 1;

        let status = 'BELUM BAYAR';
        if (sisa <= 0) status = 'LUNAS';
        else if (o.statusProduksi === 'Sudah Diambil') status = 'PIUTANG';
        else if (terbayar > 0) status = 'DP';

        let allPayments = [];
        try { 
          if(o.paymentMethod || o.payment_method) {
            allPayments = JSON.parse(o.paymentMethod || o.payment_method); 
          }
        } catch(e) { 
          if(basePaid > 0) allPayments = [{ method: o.paymentMethod || o.payment_method, amount: basePaid }]; 
        }
        allPayments.push(...cicilanData.map(c => ({ method: c.paymentMethod, amount: c.amount })));

        if(!groupedOrders[o.id]) {
          groupedOrders[o.id] = { ...o, items: [`${o.qty || 0} Pcs`], totalTagihan: baseTotal, totalTerbayar: terbayar, sisaTagihan: sisa, status, allPayments };
        } else { 
          groupedOrders[o.id].items.push(`${o.qty || 0} Pcs`); 
          groupedOrders[o.id].totalTagihan += baseTotal; 
        }
    });

    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total);

    const mutasiAyamAll = (stokData || []).filter(s => s.type === 'MUTASI_AYAM_PEMALANG').reduce((sum, s) => sum + Number(s.qty || 0), 0);
    const prodPemalangAll = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG').reduce((sum, s) => sum + Number(s.qty || 0), 0);
    const sisaAyam = mutasiAyamAll - (prodPemalangAll * MASTER_AYAM_KG);
    
    const terjualPcsAll = branchOrdersAll.reduce((sum, o) => sum + Number(o.qty || 0), 0);
    const sisaFreezer = (prodPemalangAll * MASTER_PCS) - terjualPcsAll;

    const adukanHariIni = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG' && isPeriod(s.date)).reduce((sum, s) => sum + Number(s.qty || 0), 0);
    
    const ops = {
        sisaAyam, sisaAyamKtg: sisaAyam / KG_PER_KANTONG,
        sisaFreezer, adukanHariIni, 
        ayamTerpakaiHariIni: adukanHariIni * MASTER_AYAM_KG, 
        dimsumMasukHariIni: adukanHariIni * MASTER_PCS
    };

    return {
        totalPenjualanKotor, totalPcs, setoranKePusat, totalPiutangBaru, totalTerbayarPeriode,
        listOrders: Object.values(groupedOrders),
        listPiutangBerjalan: piutangBerjalan,
        listReports: branchReportsPeriod,
        topCustomersList, ops
    };
  }, [orders, pemalangReports, piutangPayments, stokData, dateFrom, dateTo]);

  const ops = rekap.ops;

  return (
    <div className="space-y-6 animate-in fade-in pb-10 text-slate-800 normal-case">
      {/* FILTER & CETAK */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xs font-black text-slate-800 mb-2 flex items-center gap-2 normal-case"><Calendar size={16} className="text-blue-600"/> Filter Laporan &amp; Cetak</h3>
            <div className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200">
               <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-[10px] font-bold border-none bg-transparent outline-none cursor-pointer" />
               <span className="text-slate-400 font-bold px-2">-</span>
               <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-[10px] font-bold border-none bg-transparent outline-none cursor-pointer" />
            </div>
          </div>
          <button onClick={() => {
            if (typeof setPrintData === 'function') {
              setPrintData({ type: 'reportBranch', data: { rekap, dateFrom, dateTo } });
            }
          }} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black shadow-md transition-colors active:scale-95 w-full md:w-auto"><Printer size={16} /> Cetak Rekap Cabang</button>
      </div>

      {/* DASHBOARD OPERASIONAL */}
      <div className="bg-slate-900 rounded-2xl shadow-lg overflow-hidden border border-slate-800 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-500"></div>
          <div className="p-5 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/50">
              <div>
                  <h2 className="text-sm font-black text-white flex items-center gap-2 normal-case"><Factory className="text-blue-400" size={18}/> Kontrol Operasional &amp; Produksi Cabang</h2>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 normal-case">Monitoring real-time aktivitas dapur dan kapasitas gudang cabang.</p>
              </div>
              <div className="text-right hidden sm:block">
                  <div className="text-[9px] font-bold text-slate-500 normal-case">Status Data</div>
                  <div className="text-xs font-black text-emerald-400 flex items-center justify-end gap-1.5 mt-0.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> LIVE REALTIME</div>
              </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-800/60 bg-slate-800/30">
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition">
                  <div className="text-[9px] font-bold text-slate-400 normal-case mb-2">Adukan Hari Ini</div>
                  <div className="text-2xl font-black text-white drop-shadow-md">{ops.adukanHariIni || 0} <span className="text-[10px] font-bold text-blue-400">Adk</span></div>
              </div>
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition">
                  <div className="text-[9px] font-bold text-slate-400 normal-case mb-2">Ayam Terpakai</div>
                  <div className="text-2xl font-black text-white drop-shadow-md">-{ops.ayamTerpakaiHariIni || 0} <span className="text-[10px] font-bold text-orange-400">Kg</span></div>
              </div>
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition relative overflow-hidden bg-slate-800/20">
                  <div className="text-[9px] font-bold text-slate-400 normal-case mb-2">Sisa Ayam (Live)</div>
                  <div className="text-2xl font-black text-white drop-shadow-md">{ops.sisaAyam || 0} <span className="text-[10px] font-bold text-emerald-400">Kg</span></div>
                  <div className="text-[9px] font-black text-emerald-400 mt-2 px-2.5 py-1 bg-emerald-950/80 rounded-lg border border-emerald-800/50 normal-case">{(ops.sisaAyamKtg || 0).toFixed(1).replace('.0','')} Kantong</div>
              </div>
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition">
                  <div className="text-[9px] font-bold text-slate-400 normal-case mb-2">Masuk Freezer</div>
                  <div className="text-2xl font-black text-white drop-shadow-md">+{ops.dimsumMasukHariIni || 0} <span className="text-[10px] font-bold text-blue-400">Pcs</span></div>
                  <div className="text-[9px] font-black text-blue-400 mt-2 px-2.5 py-1 bg-blue-950/80 rounded-lg border border-blue-800/50 normal-case">{((ops.dimsumMasukHariIni || 0) / PCS_PER_MIKA).toFixed(1).replace('.0','')} Mika</div>
              </div>
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition relative overflow-hidden bg-slate-800/20">
                  <div className="text-[9px] font-bold text-slate-400 normal-case mb-2">Sisa Freezer (Live)</div>
                  <div className="text-2xl font-black text-white drop-shadow-md">{ops.sisaFreezer || 0} <span className="text-[10px] font-bold text-emerald-400">Pcs</span></div>
                  <div className="text-[9px] font-black text-emerald-400 mt-2 px-2.5 py-1 bg-emerald-950/80 rounded-lg border border-emerald-800/50 normal-case">{((ops.sisaFreezer || 0) / PCS_PER_MIKA).toFixed(1).replace('.0','')} Mika</div>
              </div>
          </div>
      </div>

      {/* DASHBOARD KEUANGAN KAS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
              <div>
                  <h2 className="text-sm font-black text-slate-800 mb-1 flex items-center gap-2 normal-case"><Wallet size={18} className="text-blue-600"/> Status Finansial &amp; Target Cabang</h2>
                  <p className="text-[10px] font-bold text-slate-500 normal-case">Dihitung untuk periode {formatDate(dateFrom)} s/d {formatDate(dateTo)}.</p>
              </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="Total Omset Penjualan" amount={formatRupiah(rekap.totalPenjualanKotor)} icon={<Wallet size={16}/>} color="bg-blue-50 text-blue-700 border-blue-200" />
              <StatCard title="Total Disetor (EOD)" amount={formatRupiah(rekap.setoranKePusat)} icon={<Coins size={16}/>} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
              <StatCard title="Total Piutang Berjalan" amount={formatRupiah(rekap.totalPiutangBaru)} icon={<CreditCard size={16}/>} color="bg-orange-50 text-orange-700 border-orange-200" />
          </div>
      </div>

    </div>
  );
}
