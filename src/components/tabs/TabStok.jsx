// Ganti baris fungsi handleSimpanProduksi lama Anda di TabStok.jsx dengan blok real costing ini:
const handleSimpanProduksi = (e) => {
    e.preventDefault();
    const batchId = generateId('BATCH', date);
    const currentBranch = user.branch_id || 'TANGERANG'; 
    
    // Injeksi Real Costing Komponen Struktural
    const payload = { 
        id: batchId, 
        date: date, 
        adukan_qty: Number(adukanQty), 
        ayam_used: Number(ayamUsed), 
        status: 'SELESAI', 
        
        // PARAMETER BIAYA PRODUKSI RIIL
        bumbu_cost: Number(additionalCost), // Sesuai kalkulasi adukan auto
        packaging_cost: Number(adukanQty) * 20 * 1200,   // Proyeksi mika (contoh: 20 mika * Rp1.200)
        overhead_cost: Number(adukanQty) * 15000,        // Estimasi beban gas/listrik per adukan
        labor_cost: Number(adukanQty) * 20000,           // Estimasi beban upah pekerja harian
        result_pcs: Number(resultPcs), 
        result_mika: Number(resultPcs) / 50, 
        
        branch_id: currentBranch,
        production_branch: currentBranch, 
        production_location_raw: currentBranch + '_RAW',
        production_location_freezer: currentBranch + '_FREEZER'
    };

    sendToSheet('event_production', payload, 'system_events');
    setAdukanQty(''); setAyamUsed(''); setResultPcs(''); setAdditionalCost('0');
};
