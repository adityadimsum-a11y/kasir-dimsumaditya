export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  if (!data) return <div className="p-4 bg-white text-center font-bold">Data Rekap Laporan Tidak Tersedia.</div>;
  
  const { rekap, dateFrom, dateTo } = data;
  const totalPengeluaran = (rekap?.listExpenses || []).reduce((sum, e) => sum + (Number(e?.total)||0), 0);
  const sumTerbayar = (rekap?.listTransaksiDetail || []).reduce((s, c) => s + (Number(c?.totalTerbayar)||0), 0);
  const sumSisa = (rekap?.listTransaksiDetail || []).reduce((s, c) => s + (Number(c?.sisaTagihan)||0), 0);

  const ops = rekap?.ops || {};
  const PCS_PER_MIKA = 50;

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded">Kembali</button>
      
      <div className="a4-wrapper shadow-xl border border-gray-200">
        <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '60px', width: 'auto' }} />
            <div className="text-right">
                <h1 className="text-xl font-black uppercase mb-0.5">LAPORAN REKAPITULASI TRANSAKSI & OPERASIONAL</h1>
                <h2 className="font-bold text-[11px] text-slate-700 mb-0.5">DIMSUM ADITYA TANGERANG</h2>
                <p className="text-gray-600 font-medium text-[10px]">Periode Laporan: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>

        {/* SUMMARY OPERASIONAL STOK HARI INI */}
        <div className="border-2 border-slate-800 p-3 mb-4 rounded bg-slate-50">
            <h3 className="text-[10px] font-black uppercase text-slate-800 border-b border-slate-300 pb-1 mb-2">A. DASHBOARD PRODUKSI (PUSAT)</h3>
            <div className="grid grid-cols-5 gap-2 text-center">
                <div className="border-r border-slate-300">
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Adukan Hari Ini</div>
                    <div className="text-sm font-black text-blue-700">{ops.adukanHariIni || 0} <span className="text-[10px]">Adk</span></div>
                </div>
                <div className="border-r border-slate-300">
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Ayam Terpakai</div>
                    <div className="text-sm font-black text-orange-700">-{ops.ayamTerpakaiHariIni || 0} <span className="text-[10px]">Kg</span></div>
                </div>
                <div className="border-r border-slate-300">
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Sisa Ayam (Realtime)</div>
                    <div className="text-sm font-black text-emerald-700">{ops.sisaAyam || 0} <span className="text-[10px]">Kg</span></div>
                    <div className="text-[9px] text-slate-500">{(ops.sisaAyamKtg || 0).toFixed(1)} Kantong</div>
                </div>
                <div className="border-r border-slate-300">
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Dimsum Masuk Freezer</div>
                    <div className="text-sm font-black text-blue-700">+{ops.dimsumMasukHariIni || 0} <span className="text-[10px]">Pcs</span></div>
                    <div className="text-[9px] text-slate-500">{((ops.dimsumMasukHariIni || 0) / PCS_PER_MIKA).toFixed(1).replace('.0','')} Mika</div>
                </div>
                <div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Sisa Freezer (Realtime)</div>
                    <div className="text-sm font-black text-emerald-700">{ops.sisaFreezer || 0} <span className="text-[10px]">Pcs</span></div>
                    <div className="text-[9px] text-slate-500">{((ops.sisaFreezer || 0) / PCS_PER_MIKA).toFixed(1).replace('.0','')} Mika</div>
                </div>
            </div>
        </div>

        <h3 className="text-[10px] font-black uppercase text-slate-800 border-b border-slate-300 pb-1 mb-2">B. RINGKASAN FINANSIAL KAS</h3>
        <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="border border-slate-300 p-2 rounded bg-white">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Omset Penjualan</p>
                <p className="text-sm font-black text-blue-700">{formatRp(rekap?.totalPenjualanKotor)}</p>
                <p className="text-[9px] text-slate-600 mt-0.5">Terjual Pusat: <strong>{rekap?.totalPcs || 0} Pcs</strong></p>
            </div>
            <div className="border border-emerald-200 p-2 rounded bg-emerald-50">
                <p className="text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Kas Masuk</p>
                <div className="flex justify-between text-[10px] font-black text-emerald-800 mt-1"><span>TOTAL:</span><span>{formatRp((rekap?.inCashPeriode||0) + (rekap?.inTfPeriode||0))}</span></div>
            </div>
            <div className="border border-red-200 p-2 rounded bg-red-50">
                <p className="text-[9px] font-bold text-red-700 uppercase mb-0.5">Kas Keluar</p>
                <div className="flex justify-between text-[10px] font-black text-red-800 mt-1"><span>TOTAL:</span><span>{formatRp((rekap?.outCashPeriode||0) + (rekap?.outTfPeriode||0))}</span></div>
            </div>
            <div className="border border-orange-200 p-2 rounded bg-orange-50">
                <p className="text-[9px] font-bold text-orange-700 uppercase mb-0.5">Tagihan Gantung (Sisa)</p>
                <div className="flex justify-between text-[9px]"><span>Piutang:</span><span className="font-bold">{formatRp(rekap?.totalPiutangBaru)}</span></div>
            </div>
        </div>

        <h3 className="font-bold text-xs mb-1.5 text-slate-800">C. TRANSAKSI PENJUALAN DIMSUM</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th className="text-center">QTY</th><th className="text-center">VIA</th><th className="text-right">TAGIHAN</th><th className="text-right">TERBAYAR</th><th className="text-right">SISA</th><th className="text-center">STATUS</th></tr>
          </thead>
          <tbody>
            {(!rekap?.listTransaksiDetail || rekap.listTransaksiDetail.length === 0) ? (
                <tr><td colSpan="9" className="text-center py-4 italic text-slate-500">Tidak ada transaksi penjualan dimsum.</td></tr>
            ) : (
                rekap.listTransaksiDetail.map((c, i) => {
                    const itemPcs = (c?.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
                    return (
                    <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td>{formatDate(c?.date)}<br/><span className="font-mono text-[8px] text-slate-500">{c?.id || '-'}</span></td>
                        <td className="font-bold uppercase">{c?.customer || '-'}</td>
                        <td className="text-center text-[9px]">{itemPcs} Pcs / {itemPcs/4} Prs</td>
                        <td className="text-center text-[9px]">{c?.paymentMethod || '-'}</td>
                        <td className="text-right font-medium">{formatRp(c?.totalTagihan)}</td>
                        <td className="text-right text-emerald-600 font-bold">{formatRp(c?.totalTerbayar)}</td>
                        <td className="text-right font-bold text-red-600">{formatRp(c?.sisaTagihan)}</td>
                        <td className={`text-center font-bold text-[9px] ${c?.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c?.status || '-'}</td>
                    </tr>
                )})
            )}
            <tr>
                <td colSpan="3" className="text-right font-bold uppercase bg-slate-50">Total Penjualan Dimsum :</td>
                <td className="text-center font-bold text-slate-700 bg-slate-50 text-[9px]">{rekap?.totalPcs || 0} Pcs / {rekap?.totalPorsi || 0} Prs</td>
                <td className="bg-slate-50"></td>
                <td className="text-right font-black text-blue-700 bg-slate-50">{formatRp(rekap?.totalPenjualanKotor)}</td>
                <td className="text-right font-black text-emerald-600 bg-slate-50">{formatRp(sumTerbayar)}</td>
                <td className="text-right font-black text-red-600 bg-slate-50">{formatRp(sumSisa)}</td>
                <td className="bg-slate-50"></td>
            </tr>
          </tbody>
        </table>

        <h3 className="font-bold text-xs mb-1.5 mt-5 text-indigo-700">D. TRANSAKSI PEMBELIAN BAHAN BAKU</h3>
        <table className="table-print">
          <thead>
            <tr><th className="w-8">NO</th><th>TGL & INV</th><th>SUPPLIER</th><th className="text-center">BARANG & QTY</th><th className="text-center">VIA</th><th className="text-right">TOTAL</th><th className="text-right">TERBAYAR</th><th className="text-right">SISA</th><th className="text-center">STATUS</th></tr>
          </thead>
          <tbody>
              {(!rekap?.listPembelianDetail || rekap.listPembelianDetail.length === 0) ? (
                  <tr><td colSpan="9" className="text-center py-4 italic text-slate-500">Tidak ada transaksi.</td></tr>
              ) : (
                  rekap.listPembelianDetail.map((c, i) => {
                      const sisa = Number(c?.total || 0) - Number(c?.paidAmount || 0);
                      const status = sisa <= 0 ? 'LUNAS' : 'BELUM LUNAS';
                      return (
                      <tr key={i}>
                          <td className="text-center">{i + 1}</td>
                          <td>{formatDate(c?.date)}<br/><span className="font-mono text-[8px] text-slate-500">{c?.id || '-'}</span></td>
                          <td className="font-bold uppercase">{c?.supplier || '-'}</td>
                          <td className="text-center text-[9px] uppercase">{c?.itemName || '-'} ({c?.qty || 0} {c?.satuan || '-'})</td>
                          <td className="text-center text-[9px]">{c?.paymentMethod || '-'}</td>
                          <td className="text-right font-medium">{formatRp(c?.total)}</td>
                          <td className="text-right text-emerald-600 font-bold">{formatRp(c?.paidAmount)}</td>
                          <td className="text-right font-bold text-red-600">{formatRp(sisa)}</td>
                          <td className={`text-center font-bold text-[9px] ${status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{status}</td>
                      </tr>
                  )})
              )}
          </tbody>
        </table>

        <div className="flex justify-between mt-12 text-center text-xs">
            <div className="w-48"><p className="text-slate-600">Dibuat Oleh,</p><div className="h-16"></div><p className="border-t border-black pt-1.5 uppercase font-bold text-slate-800">( Admin / Kasir )</p></div>
            <div className="w-48"><p className="text-slate-600">Mengetahui / Menyetujui,</p><div className="h-16"></div><p className="border-t border-black pt-1.5 uppercase font-bold text-slate-800">( Pimpinan Pusat )</p></div>
        </div>
      </div>
    </div>
  );
}

export function PrintReportBranch({ data, onBack, user }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  if (!data) return <div className="p-4 bg-white text-center font-bold">Data Rekap Cabang Tidak Tersedia.</div>;

  const { rekap, dateFrom, dateTo } = data;
  const sumTerbayarBranch = (rekap?.listOrders || []).reduce((s, c) => s + (Number(c?.totalTerbayar)||0), 0);
  const sumSisaBranch = (rekap?.listOrders || []).reduce((s, c) => s + (Number(c?.sisaTagihan)||0), 0);

  const ops = rekap?.ops || {};
  const PCS_PER_MIKA = 50;

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali</button>
      
      <div className="a4-wrapper shadow-xl border border-gray-200">
        <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-4">
            <div className="flex items-center gap-4">
                <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '60px', width: 'auto' }} />
            </div>
            <div className="text-right">
                <h1 className="text-xl font-black uppercase mb-0.5">LAPORAN REKAPITULASI TRANSAKSI & OPERASIONAL</h1>
                <h2 className="font-bold text-[11px] text-slate-700 mb-0.5">DIMSUM ADITYA TERPADU</h2>
                <p className="text-gray-600 font-medium text-[10px]">CABANG: {user?.name || '-'} | Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>

        {/* SUMMARY OPERASIONAL STOK CABANG */}
        <div className="border-2 border-slate-800 p-3 mb-4 rounded bg-slate-50">
            <h3 className="text-[10px] font-black uppercase text-slate-800 border-b border-slate-300 pb-1 mb-2">A. DASHBOARD PRODUKSI (CABANG PEMALANG)</h3>
            <div className="grid grid-cols-5 gap-2 text-center">
                <div className="border-r border-slate-300">
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Adukan Hari Ini</div>
                    <div className="text-sm font-black text-blue-700">{ops.adukanHariIni || 0} <span className="text-[10px]">Adk</span></div>
                </div>
                <div className="border-r border-slate-300">
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Ayam Terpakai</div>
                    <div className="text-sm font-black text-orange-700">-{ops.ayamTerpakaiHariIni || 0} <span className="text-[10px]">Kg</span></div>
                </div>
                <div className="border-r border-slate-300">
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Sisa Ayam (Realtime)</div>
                    <div className="text-sm font-black text-emerald-700">{ops.sisaAyam || 0} <span className="text-[10px]">Kg</span></div>
                    <div className="text-[9px] text-slate-500">{(ops.sisaAyamKtg || 0).toFixed(1)} Kantong</div>
                </div>
                <div className="border-r border-slate-300">
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Dimsum Masuk Freezer</div>
                    <div className="text-sm font-black text-blue-700">+{ops.dimsumMasukHariIni || 0} <span className="text-[10px]">Pcs</span></div>
                    <div className="text-[9px] text-slate-500">{((ops.dimsumMasukHariIni || 0) / PCS_PER_MIKA).toFixed(1).replace('.0','')} Mika</div>
                </div>
                <div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Sisa Freezer (Realtime)</div>
                    <div className="text-sm font-black text-emerald-700">{ops.sisaFreezer || 0} <span className="text-[10px]">Pcs</span></div>
                    <div className="text-[9px] text-slate-500">{((ops.sisaFreezer || 0) / PCS_PER_MIKA).toFixed(1).replace('.0','')} Mika</div>
                </div>
            </div>
        </div>

        <h3 className="text-[10px] font-black uppercase text-slate-800 border-b border-slate-300 pb-1 mb-2">B. RINGKASAN FINANSIAL KAS</h3>
        <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="border border-slate-300 p-2 rounded bg-white">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Total Omset Cabang</p>
                <p className="text-sm font-black text-blue-700">{formatRp(rekap?.totalPenjualanKotor)}</p>
            </div>
            <div className="border border-emerald-200 p-2 rounded bg-emerald-50">
                <p className="text-[9px] font-bold text-emerald-700 uppercase mb-0.5">Total Kas Disetor</p>
                <p className="text-sm font-black text-emerald-700">{formatRp(rekap?.setoranKePusat)}</p>
            </div>
            <div className="border border-orange-200 p-2 rounded bg-orange-50">
                <p className="text-[9px] font-bold text-orange-700 uppercase mb-0.5">Piutang Gantung (Agen)</p>
                <p className="text-sm font-black text-orange-700">{formatRp(rekap?.totalPiutangBaru)}</p>
            </div>
        </div>
        
        <h3 className="font-bold text-xs mb-1.5 text-slate-800">C. TRANSAKSI INVOICE CABANG</h3>
        <table className="table-print">
          <thead><tr><th className="w-8">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th className="text-center">QTY</th><th className="text-center">VIA</th><th className="text-right">TAGIHAN</th><th className="text-right">TERBAYAR</th><th className="text-right">SISA</th><th className="text-center">STATUS</th></tr></thead>
          <tbody>
            {(!rekap?.listOrders || rekap.listOrders.length === 0) ? (
                <tr><td colSpan="9" className="text-center py-4 italic text-slate-500">Tidak ada transaksi penjualan.</td></tr>
            ) : (
                rekap.listOrders.map((c, i) => {
                    const itemPcs = (c?.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
                    return (
                    <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td>{formatDate(c?.date)}<br/><span className="font-mono text-[8px] text-slate-500">{c?.id || '-'}</span></td>
                        <td className="font-bold uppercase">{c?.customer || '-'}</td>
                        <td className="text-center text-[9px]">{itemPcs} Pcs / {itemPcs/4} Prs</td>
                        <td className="text-center text-[9px]">{c?.paymentMethod || '-'}</td>
                        <td className="text-right">{formatRp(c?.totalTagihan)}</td>
                        <td className="text-right text-emerald-600 font-bold">{formatRp(c?.totalTerbayar)}</td>
                        <td className="text-right font-bold text-red-600">{formatRp(c?.sisaTagihan)}</td>
                        <td className={`text-center font-bold text-[9px] ${c?.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c?.status || '-'}</td>
                    </tr>
                )})
            )}
          </tbody>
        </table>

        <div className="flex justify-between mt-12 text-center text-xs">
            <div className="w-48"><p className="text-slate-600">Dibuat Oleh,</p><div className="h-16"></div><p className="border-t border-black pt-1.5 uppercase font-bold text-slate-800">( {user?.name || '-'} )</p></div>
            <div className="w-48"><p className="text-slate-600">Mengetahui / Menyetujui,</p><div className="h-16"></div><p className="border-t border-black pt-1.5 uppercase font-bold text-slate-800">( Pimpinan Pusat )</p></div>
        </div>
      </div>
    </div>
  );
}
