import React, { useState, useMemo } from 'react'; 
import { 
  TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, 
  ShieldAlert, Users, Gift, Activity, ArrowRight, 
  User, Calendar, FileText, CheckCircle2, Percent
} from 'lucide-react';
import { formatDate, getTodayStr, getLocalYMD } from '../../utils/helpers'; 

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabBusinessRadar({ 
  orders = [], 
  cashflowTransactions = [], 
  piutangPayments = [],
  master_customers = [],
  user
}) {
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);
  const [filterPeriode, setFilterPeriode] = useState('7_HARI');

  const todayStr = getTodayStr(); 

  const rekapMading = useMemo(() => {
    const getDaysDifference = (d1, d2) => {
      const diffTime = Math.abs(new Date(d1) - new Date(d2));
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const todayObj = new Date(todayStr);
    const sevenDaysAgo = new Date(todayObj); sevenDaysAgo.setDate(todayObj.getDate() - 7);
    const limitSevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];

    const fourteenDaysAgo = new Date(todayObj); fourteenDaysAgo.setDate(todayObj.getDate() - 14);
    const limitFourteenDaysStr = fourteenDaysAgo.toISOString().split('T')[0];

    let totalOmsetHariIni = 0; // Kertas
    let totalUangMasukRiil = 0; // Dompet Fisik
    let totalPengeluaranRiil = 0;

    (cashflowTransactions || []).forEach(c => {
      if (c.isDeleted) return;
      const cYMD = getLocalYMD(c.date);
      if ((c.type === 'IN' || c.transaction_type === 'INFLOW') && cYMD === todayStr) {
        totalUangMasukRiil += Number(c.amount || 0);
      }
      if ((c.transaction_type === 'OUTFLOW' || c.type === 'CASH_OUT' || c.type === 'OUT') && cYMD === todayStr) {
        totalPengeluaranRiil += Number(c.amount || 0);
      }
    });

    const customerPiutangMap = {};
    const groupOrders = {};

    (master_customers || []).forEach(cust => {
      customerPiutangMap[cust.customer_name.toUpperCase()] = {
        customer_id: cust.id,
        customer_name: cust.customer_name.toUpperCase(),
        phone: cust.phone || '-',
        address: cust.address || '-',
        notes_crm: cust.notes || '-',
        total_bon_gantung: 0,
        tanggal_bon_terlama: null,
        last_order_date: null,
        qty_order_minggu_ini: 0,
        qty_order_minggu_lalu: 0,
        total_belanja_akumulasi: 0,
        frequency_order: 0,
        nota_details: []
      };
    });

    (orders || []).forEach(o => {
      if (o.isDeleted) return;
      const oId = o.id;
      const cName = String(o.customer_name || o.customer || 'UMUM').toUpperCase();
      const oYMD = getLocalYMD(o.date);

      if (oYMD === todayStr) {
        totalOmsetHariIni += Number(o.total_amount || o.total || 0);
      }

      if (!groupOrders[oId]) {
        groupOrders[oId] = { 
          id: oId, date: o.date, customer: cName, tagihan: 0, 
          bayar: Number(o.amount_paid || o.paidAmount || 0), 
          method: o.payment_method || o.paymentMethod, status: o.status 
        };
      }
      groupOrders[oId].tagihan += Number(o.total_amount || o.total || 0);

      if (customerPiutangMap[cName]) {
        const qtyOrder = Number(o.qty || 0);
        customerPiutangMap[cName].total_belanja_akumulasi += Number(o.total_amount || o.total || 0);
        customerPiutangMap[cName].frequency_order += 1;
        
        if (!customerPiutangMap[cName].last_order_date || new Date(o.date) > new Date(customerPiutangMap[cName].last_order_date)) {
          customerPiutangMap[cName].last_order_date = o.date;
        }

        if (oYMD >= limitSevenDaysStr && oYMD <= todayStr) {
          customerPiutangMap[cName].qty_order_minggu_ini += qtyOrder;
        } else if (oYMD >= limitFourteenDaysStr && oYMD < limitSevenDaysStr) {
          customerPiutangMap[cName].qty_order_minggu_lalu += qtyOrder;
        }
      }
    });

    (piutangPayments || []).forEach(p => {
        if(!p.isDeleted && groupOrders[p.orderId]) {
          groupOrders[p.orderId].bayar += Number(p.amount || p.amount_paid || 0);
        }
    });

    let totalPiutangGlobal = 0;
    Object.values(groupOrders).forEach(go => {
      const sisaHutang = go.tagihan - go.bayar;
      if (sisaHutang > 0 && (go.method === 'PIUTANG' || go.method === 'TEMPO' || go.status === 'BELUM_LUNAS' || go.method === 'COD_PO' || String(go.method).includes('DP_'))) {
        totalPiutangGlobal += sisaHutang;
        const cName = go.customer;

        if (customerPiutangMap[cName]) {
          customerPiutangMap[cName].total_bon_gantung += sisaHutang;
          customerPiutangMap[cName].nota_details.push({
            invoice_id: go.id, date: go.date, total_tagihan: go.tagihan,
            sudah_dibayar: go.bayar, sisa_hutang: sisaHutang, metode_asal: go.method
          });

          if (!customerPiutangMap[cName].tanggal_bon_terlama || new Date(go.date) < new Date(customerPiutangMap[cName].tanggal_bon_terlama)) {
            customerPiutangMap[cName].tanggal_bon_terlama = go.date;
          }
        }
      }
    });

    const listMadingPiutang = Object.values(customerPiutangMap)
      .map(cust => {
        let harianAbsen = cust.last_order_date ? getDaysDifference(todayStr, cust.last_order_date) : 999;
        let statusNotifMerah = harianAbsen > 7; 
        
        let trenFluktuasi = 'STABIL';
        let selisihPcs = cust.qty_order_minggu_ini - cust.qty_order_minggu_lalu;
        if (selisihPcs > 0) trenFluktuasi = 'NAIK';
        if (selisihPcs < 0) trenFluktuasi = 'TURUN';

        return {
          ...cust,
          hari_absen: harianAbsen,
          is_notif_merah: statusNotifMerah,
          tren_fluktuasi: trenFluktuasi,
          selisih_pcs_mingguan: Math.abs(selisihPcs)
        };
      })
      .filter(c => c.total_bon_gantung > 0 || c.frequency_order > 0)
      .sort((a, b) => b.total_bon_gantung - a.total_bon_gantung);

    // 🔥 DOKTRIN 4 AMPLOP VIRTUAL (MODE SURVIVAL) BACA DARI TOTAL UANG MASUK RIIL
    const amplopBahanBaku = totalUangMasukRiil * 0.55;
    const amplopOperasional = totalUangMasukRiil * 0.25;
    const amplopJagaJaga = totalUangMasukRiil * 0.15;
    const amplopProfitMurni = totalUangMasukRiil * 0.05;

    return {
      totalOmsetHariIni, totalUangMasukRiil, totalPengeluaranRiil, totalPiutangGlobal,
      amplop: { bahanBaku: amplopBahanBaku, operasional: amplopOperasional, jagaJaga: amplopJagaJaga, profitMurni: amplopProfitMurni },
      listMadingPiutang
    };
  }, [orders, cashflowTransactions, piutangPayments, master_customers, todayStr]);

  const { amplop, listMadingPiutang } = rekapMading;

  const piutangMacetMading = useMemo(() => {
    return listMadingPiutang.filter(c => c.total_bon_gantung > 0);
  }, [listMadingPiutang]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600"></div>
        <div className="pl-2">
          <h2 className="text-sm font-black flex items-center gap-2 text-slate-800 uppercase tracking-wide">
            <TrendingUp className="text-red-600" size={18}/> Radar Bisnis &amp; Analitik Sultan Core
          </h2>
          <p className="text-[10px] font-bold text-slate-500 mt-1">Pemantauan otomatis rasio 4 amplop kas laci, kontrol HPP, serta alarm radar pengawasan piutang jatuh tempo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Aliran Masuk Riil (Dompet)</div>
             <div className="text-2xl font-black text-emerald-600 tracking-tight">{formatRupiah(rekapMading.totalUangMasukRiil)}</div>
             <div className="text-[9px] font-bold text-slate-400 mt-1.5 line-through">Omzet Kertas: {formatRupiah(rekapMading.totalOmsetHariIni)}</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm"><ArrowUpRight size={24}/></div>
        </div>
        <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm flex items-center justify-between">
          <div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Pengeluaran Kas (Hari ini)</div><div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(rekapMading.totalPengeluaranRiil)}</div></div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><ArrowDownRight size={24}/></div>
        </div>
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-md flex items-center justify-between">
          <div>
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 text-blue-400">Total Piutang Berjalan Agen</div>
             <div className="text-2xl font-black tracking-tight text-white">{formatRupiah(rekapMading.totalPiutangGlobal)}</div>
          </div>
          <div className="p-3 bg-blue-900/50 text-blue-400 rounded-xl border border-blue-800"><Wallet size={24}/></div>
        </div>
      </div>

      {/* 🔥 PAPAN 4 AMPLOP MASA KRITIS (SURVIVAL MODE) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start mb-5">
           <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5"><Percent size={16} className="text-blue-600" /> Papan Alokasi 4 Amplop Hak Uang (Real-Time)</h3>
           <span className="bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg text-[9px] font-black text-blue-700 uppercase tracking-wider shadow-sm hidden sm:block">Basis: Uang Fisik Riil</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-2xl text-center shadow-sm relative overflow-hidden border-t-4 border-t-blue-500 hover:shadow-md transition-shadow">
             <div className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-1">📦 Amplop 1 (Ayam 55%)</div>
             <div className="text-lg font-black text-slate-800 tracking-tight">{formatRupiah(amplop.bahanBaku)}</div>
          </div>
          <div className="p-5 bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-2xl text-center shadow-sm relative overflow-hidden border-t-4 border-t-emerald-500 hover:shadow-md transition-shadow">
             <div className="text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-1">⚙️ Amplop 2 (Ops 25%)</div>
             <div className="text-lg font-black text-slate-800 tracking-tight">{formatRupiah(amplop.operasional)}</div>
          </div>
          <div className="p-5 bg-gradient-to-br from-orange-50 to-white border border-orange-100 rounded-2xl text-center shadow-sm relative overflow-hidden border-t-4 border-t-orange-500 hover:shadow-md transition-shadow">
             <div className="text-[10px] font-black text-orange-700 uppercase tracking-wider mb-1">⚡ Amplop 3 (Cicilan 15%)</div>
             <div className="text-lg font-black text-slate-800 tracking-tight">{formatRupiah(amplop.jagaJaga)}</div>
          </div>
          <div className="p-5 bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-2xl text-center shadow-sm relative overflow-hidden border-t-4 border-t-amber-500 hover:shadow-md transition-shadow">
             <div className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">💰 Amplop 4 (Profit 5%)</div>
             <div className="text-lg font-black text-slate-800 tracking-tight">{formatRupiah(amplop.profitMurni)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-5 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div><h4 className="font-black text-xs text-white uppercase tracking-wider flex items-center gap-2"><ShieldAlert size={16} className="text-yellow-400 animate-pulse"/> Radar Pengawasan Tagihan Macet &amp; Bon Gantung Agen</h4></div>
        </div>
        <div className="overflow-x-auto p-2 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-[10px] text-slate-500 bg-slate-50 border-b border-slate-100 uppercase tracking-wider">
              <tr><th className="px-5 py-3 font-black">Nama Agen / Pelanggan</th><th className="px-5 py-3 font-black text-center">Status Absen Order</th><th className="px-5 py-3 font-black text-center">Tren Kuantitas</th><th className="px-5 py-3 font-black text-right">Bon Gantung Aktif</th><th className="px-5 py-3 font-black text-center">Aksi Tracing</th></tr>
            </thead>
            <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
              {piutangMacetMading.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-16 text-slate-400 font-bold bg-white"><div className="flex flex-col items-center justify-center"><CheckCircle2 size={40} className="mb-3 text-emerald-500 opacity-30"/><span>BERSIH TOTAL! Tidak ada tagihan gantung yang menunggak saat ini.</span></div></td></tr>
              ) : (
                piutangMacetMading.map((cust, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap"><div className="text-slate-800 font-black text-[13px] uppercase flex items-center gap-2">👤 {cust.customer_name} {cust.is_notif_merah && <span className="px-2 py-0.5 rounded text-[8px] font-black bg-rose-100 text-rose-700 border border-rose-200 animate-pulse uppercase tracking-wider shadow-sm">⚠️ Macet Belanja</span>}</div></td>
                    <td className="px-5 py-4 text-center whitespace-nowrap"><div className={`text-[11px] font-extrabold ${cust.is_notif_merah ? 'text-rose-600' : 'text-slate-700'}`}>{cust.hari_absen === 999 ? 'Belum Pernah Order' : `${cust.hari_absen} Hari Absen`}</div></td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {cust.tren_fluktuasi === 'NAIK' && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 shadow-sm">🔼 Naik +{formatNumber(cust.selisih_pcs_mingguan)}</span>}
                      {cust.tren_fluktuasi === 'TURUN' && <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100 shadow-sm">🔽 Turun -{formatNumber(cust.selisih_pcs_mingguan)}</span>}
                      {cust.tren_fluktuasi === 'STABIL' && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">Stabil (0)</span>}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap"><div className="font-black text-rose-600 text-sm tracking-tight">{formatRupiah(cust.total_bon_gantung)}</div></td>
                    <td className="px-5 py-4 text-center whitespace-nowrap"><button onClick={() => setSelectedCustomerDetail(cust)} className="px-4 py-2 bg-white text-slate-700 border border-slate-200 hover:border-blue-400 hover:text-blue-600 font-black text-[10px] uppercase tracking-wider rounded-lg shadow-sm cursor-pointer flex items-center justify-center mx-auto gap-1">Buka Mading <ArrowRight size={14}/></button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-5 uppercase tracking-wide border-b border-slate-100 pb-3"><Users size={16} className="text-purple-600" /> Klasemen Loyalitas &amp; Kelayakan Bonus THR Agen</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
          {listMadingPiutang.map((cust, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-purple-300 hover:bg-purple-50/20 transition-all shadow-sm group">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm shrink-0 border border-slate-200 ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-white text-slate-400'}`}>#{idx + 1}</div>
                <div className="min-w-0"><div className="font-black text-slate-800 text-xs uppercase truncate group-hover:text-purple-700 transition-colors">{cust.customer_name}</div><div className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-wider">{cust.frequency_order}x Transaksi • Omset: <span className="text-slate-800 font-black">{formatRupiah(cust.total_belanja_akumulasi)}</span></div></div>
              </div>
              <div className="text-right shrink-0"><span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider shadow-sm ${cust.total_belanja_akumulasi > 10000000 ? 'bg-purple-100 text-purple-700 border border-purple-200' : cust.total_belanja_akumulasi > 3000000 ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>{cust.total_belanja_akumulasi > 10000000 ? '⭐ VIP' : cust.total_belanja_akumulasi > 3000000 ? 'MITRA' : 'REGULER'}</span></div>
            </div>
          ))}
        </div>
      </div>

      {selectedCustomerDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col h-[75vh]">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div><h3 className="font-black text-sm uppercase flex items-center gap-2 tracking-wider"><User size={18} className="text-yellow-400"/> Mading Tracing: {selectedCustomerDetail.customer_name}</h3><p className="text-[10px] text-slate-400 font-medium mt-1">Alamat: {selectedCustomerDetail.address} | Telp: {selectedCustomerDetail.phone}</p></div>
              <button onClick={() => setSelectedCustomerDetail(null)} className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer">✕</button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-5 bg-slate-50">
              <div className="grid grid-cols-2 gap-4 shrink-0">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Bon Gantung</div><div className="text-xl font-black text-rose-600 tracking-tight">{formatRupiah(selectedCustomerDetail.total_bon_gantung)}</div></div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Akumulasi Belanja Historis</div><div className="text-xl font-black text-slate-800 tracking-tight">{formatRupiah(selectedCustomerDetail.total_belanja_akumulasi)}</div></div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-700 uppercase flex items-center gap-1.5 tracking-wider"><FileText size={14}/> Daftar Nota Yang Belum Lunas</div>
                <div className="divide-y divide-slate-100 text-xs font-bold">
                  {selectedCustomerDetail.nota_details.map((nota, nIdx) => (
                    <div key={nIdx} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div><div className="text-[10px] font-mono text-slate-400">{nota.invoice_id}</div><div className="text-[11px] font-bold text-slate-600 mt-1 flex items-center gap-1"><Calendar size={12}/> {formatDate(nota.date)}</div><div className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-max mt-1.5 uppercase border border-blue-100 shadow-3xs">METODE ASAL: {nota.metode_asal}</div></div>
                      <div className="text-right"><div className="text-slate-800 font-medium text-[11px]">Tagihan: {formatRupiah(nota.total_tagihan)}</div><div className="text-slate-400 font-medium text-[11px] mt-0.5">Di-DP: {formatRupiah(nota.sudah_dibayar)}</div><div className="font-black text-rose-600 text-sm mt-1">Sisa: {formatRupiah(nota.sisa_hutang)}</div></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-[11px] font-bold text-amber-800 leading-relaxed shadow-inner"><span className="text-amber-600 font-black uppercase tracking-wider mb-1 block flex items-center gap-1.5"><AlertTriangle size={14}/> Catatan Internal CRM:</span> "{selectedCustomerDetail.notes_crm}"</div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right shrink-0"><button onClick={() => setSelectedCustomerDetail(null)} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-transform active:scale-95">Tutup Mading</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
