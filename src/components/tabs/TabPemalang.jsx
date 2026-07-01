import React, { useEffect, useMemo, useState } from 'react';
import {
  Factory,
  Trash2,
  Calendar,
  ClipboardList,
  CheckCircle2,
  Printer,
  Database,
  PackageCheck,
} from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeJsonParse } from '../../utils/helpers';

const formatNumber = (value) => Number(value || 0).toLocaleString('id-ID');
const formatMoney = (value) => `Rp ${Math.round(Number(value || 0)).toLocaleString('id-ID')}`;
const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(
    String(value)
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.'),
  );
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeCode = (value) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

// Fallback saja. Final Modal tetap dari lot/session actual.
const FALLBACK_CHICKEN_PRICE = 37500;
const DEFAULT_CHICKEN_KG_PER_ADUKAN = 30;
const DEFAULT_YIELD_PCS_PER_ADUKAN = 1000;
const DEFAULT_PORSI_PER_ADUKAN = 250;
const DEFAULT_MIKA_PER_ADUKAN = 20;

const isTruthyFlag = (value) => {
  if (value === true) return true;
  const normalized = normalizeCode(value);
  return ['TRUE', 'YES', 'YA', 'Y', '1', 'ACTIVE', 'AKTIF', 'ADUKAN', 'PRODUCTION', 'PRODUKSI'].includes(normalized);
};

const isActiveRow = (row = {}) => {
  const deleted = row.isDeleted === true || String(row.isDeleted || row.is_deleted || '').toUpperCase() === 'TRUE';
  const status = normalizeCode(row.status || row.status_active || row.is_active || 'ACTIVE');
  return !deleted && !['NON_ACTIVE', 'INACTIVE', 'DISABLED', 'FALSE', 'NO', 'N', 'VOID', 'CANCELLED'].includes(status);
};

const getProductName = (product = {}) => product.product_name || product.name || product.item_name || product.menu_name || '';
const getProductId = (product = {}) => product.product_id || product.id || product.product_code || getProductName(product);
const getProductCode = (product = {}) => product.product_code || product.code || product.sku || getProductId(product);

const isAdukanOutputProduct = (product = {}) => {
  if (!isActiveRow(product)) return false;

  const explicitFlags = [
    product.uses_adukan,
    product.use_adukan,
    product.is_adukan_output,
    product.is_production_output,
    product.production_output,
    product.is_production_item,
    product.adukan_conversion_active,
    product.needs_production,
    product.produced_by_adukan,
  ];

  if (explicitFlags.some(isTruthyFlag)) return true;

  const process = normalizeCode(product.production_process || product.process_type || product.production_type || '');
  if (['ADUKAN', 'PRODUKSI_ADUKAN', 'DAPUR_ADUKAN'].includes(process)) return true;

  // Fallback sementara untuk data lama yang belum punya checkbox Master Produk.
  const haystack = String([
    product.product_name,
    product.name,
    product.category,
    product.product_type,
    product.type,
  ].join(' ')).toUpperCase();

  return haystack.includes('DIMSUM') && !haystack.includes('MENTAI SAUCE');
};

const getProductDefault = (product = {}, keys = [], fallback = 0) => {
  for (const key of keys) {
    const value = toNumber(product[key]);
    if (value > 0) return value;
  }
  return fallback;
};

const buildLegacyChickenLots = ({ chickenLots = [], chicken_lots = [], inventoryCostLayers = [], inventory_cost_layers = [], stockMovements = [], stock_movements = [], purchases = [] }) => {
  const rows = [];

  [...(chicken_lots || []), ...(chickenLots || [])].forEach((lot) => {
    if (!isActiveRow(lot)) return;
    const lotId = lot.chicken_lot_id || lot.lot_id || lot.layer_id || lot.id || lot.drop_id || '';
    rows.push({
      id: lotId,
      lot_id: lotId,
      source_type: lot.source_type || 'CHICKEN_LOT',
      date: lot.lot_date || lot.drop_date || lot.date || lot.created_at || '',
      location_id: lot.location_id || lot.branch_id || '',
      supplier_name: lot.supplier_name || lot.supplier || '',
      label: lot.lot_no || lot.drop_no || lot.invoice_no || lotId,
      qty_kg_in: toNumber(lot.qty_kg || lot.kg || lot.qty_in || lot.qty_received || lot.qty),
      qty_kg_remaining: toNumber(lot.qty_kg_remaining || lot.remaining_kg || lot.qty_remaining || lot.qty_kg || lot.kg || lot.qty),
      unit_cost: toNumber(lot.unit_cost || lot.price_per_kg || lot.hpp_ayam || lot.hpp_per_kg || lot.harga_kg),
      raw: lot,
    });
  });

  [...(inventory_cost_layers || []), ...(inventoryCostLayers || [])].forEach((layer) => {
    if (!isActiveRow(layer)) return;
    const haystack = String([layer.item_name, layer.product_name, layer.category, layer.item_type, layer.source_module].join(' ')).toUpperCase();
    if (!haystack.includes('AYAM') && !haystack.includes('CHICKEN') && !haystack.includes('BAHAN_BAKU')) return;
    const direction = normalizeCode(layer.direction || 'IN');
    const qty = toNumber(layer.qty_remaining || layer.qty_kg_remaining || layer.qty_effect || layer.qty || layer.kg);
    if (direction === 'OUT' || qty <= 0) return;
    const lotId = layer.chicken_lot_id || layer.lot_id || layer.layer_id || layer.id || layer.reference_id || layer.source_id || '';
    rows.push({
      id: lotId,
      lot_id: lotId,
      source_type: 'INVENTORY_COST_LAYER',
      date: layer.date || layer.layer_date || layer.movement_date || layer.created_at || '',
      location_id: layer.location_id || layer.branch_id || '',
      supplier_name: layer.supplier_name || layer.supplier || '',
      label: layer.layer_no || layer.movement_no || layer.reference_id || lotId,
      qty_kg_in: Math.abs(toNumber(layer.qty_received || layer.qty_in || layer.qty || layer.kg || qty)),
      qty_kg_remaining: Math.abs(qty),
      unit_cost: toNumber(layer.unit_cost || layer.price_per_kg || layer.hpp_ayam || layer.hpp_per_kg || layer.harga_kg),
      raw: layer,
    });
  });

  [...(stock_movements || []), ...(stockMovements || [])].forEach((movement) => {
    if (!isActiveRow(movement)) return;
    const direction = normalizeCode(movement.direction || 'IN');
    if (direction !== 'IN') return;
    const haystack = String([movement.item_name, movement.product_name, movement.category, movement.item_type].join(' ')).toUpperCase();
    if (!haystack.includes('AYAM') && !haystack.includes('CHICKEN') && !haystack.includes('BAHAN_BAKU')) return;
    const lotId = movement.chicken_lot_id || movement.lot_id || movement.cost_layer_id || movement.movement_id || movement.id || '';
    rows.push({
      id: lotId,
      lot_id: lotId,
      source_type: 'STOCK_MOVEMENT_IN',
      date: movement.movement_date || movement.date || movement.created_at || '',
      location_id: movement.location_id || movement.branch_id || '',
      supplier_name: movement.supplier_name || movement.supplier || '',
      label: movement.movement_no || movement.source_id || lotId,
      qty_kg_in: Math.abs(toNumber(movement.qty || movement.qty_effect || movement.kg)),
      qty_kg_remaining: Math.abs(toNumber(movement.qty_remaining || movement.remaining_kg || movement.qty_effect || movement.qty || movement.kg)),
      unit_cost: toNumber(movement.unit_cost || movement.price_per_kg || movement.hpp_ayam || movement.hpp_per_kg || movement.harga_kg),
      raw: movement,
    });
  });

  (purchases || []).forEach((purchase) => {
    if (!isActiveRow(purchase)) return;
    const itemName = String(purchase.name || purchase.item_name || purchase.raw_name || '').toUpperCase();
    const supplierName = String(purchase.supplier || purchase.supplier_name || '').toUpperCase();
    if (!itemName.includes('AYAM') && !itemName.includes('DADA') && !supplierName.includes('NANA')) return;
    let qty = toNumber(purchase.qty || purchase.quantity || purchase.kg);
    const unit = String(purchase.unit || '').toUpperCase();
    if (unit.includes('KANT') || unit.includes('KNTG')) qty *= 10;
    const lotId = purchase.purchase_id || purchase.id || purchase.invoice_no || generateId('DROP-LEGACY', purchase.date || getTodayStr());
    rows.push({
      id: lotId,
      lot_id: lotId,
      source_type: 'LEGACY_PURCHASE',
      date: purchase.date || purchase.purchase_date || purchase.created_at || '',
      location_id: purchase.location_id || purchase.branch_id || '',
      supplier_name: purchase.supplier_name || purchase.supplier || 'NANA CHICKEN',
      label: purchase.invoice_no || purchase.no_nota || lotId,
      qty_kg_in: qty,
      qty_kg_remaining: qty,
      unit_cost: toNumber(purchase.unit_cost || purchase.price_per_kg || purchase.price || purchase.harga_kg || FALLBACK_CHICKEN_PRICE),
      raw: purchase,
    });
  });

  const dedup = new Map();
  rows.forEach((lot, index) => {
    const id = lot.lot_id || `LOT-${index + 1}`;
    if (!dedup.has(id)) {
      dedup.set(id, {
        ...lot,
        lot_id: id,
        id,
        unit_cost: lot.unit_cost > 0 ? lot.unit_cost : FALLBACK_CHICKEN_PRICE,
      });
    }
  });

  return Array.from(dedup.values()).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
};

export default function TabPemalang({
  pemalang = [],
  masterProducts = [],
  master_products,
  inventoryCostLayers = [],
  inventory_cost_layers,
  stockMovements = [],
  stock_movements,
  chickenLots = [],
  chicken_lots,
  purchases = [],
  sendToSheet,
  showToast,
  user,
  requestDelete,
  setPrintData,
}) {
  const todayStr = getTodayStr();
  const currentBranch = user?.location_id || user?.branch_id || user?.branchId || 'TANGERANG_PUSAT';

  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);

  const productionProducts = useMemo(() => {
    const eligible = realProducts.filter(isAdukanOutputProduct);
    const fallback = realProducts.filter(isActiveRow).filter((product) => String(getProductName(product)).toUpperCase().includes('DIMSUM'));
    return (eligible.length > 0 ? eligible : fallback).sort((a, b) => getProductName(a).localeCompare(getProductName(b)));
  }, [realProducts]);

  const chickenLotOptions = useMemo(() => buildLegacyChickenLots({
    chickenLots,
    chicken_lots,
    inventoryCostLayers,
    inventory_cost_layers,
    stockMovements,
    stock_movements,
    purchases,
  })
    .filter((lot) => toNumber(lot.qty_kg_remaining) > 0)
    .filter((lot) => !lot.location_id || String(lot.location_id) === String(currentBranch) || String(currentBranch).includes('TGR') || String(currentBranch).includes('TANGERANG')), [
    chickenLots,
    chicken_lots,
    inventoryCostLayers,
    inventory_cost_layers,
    stockMovements,
    stock_movements,
    purchases,
    currentBranch,
  ]);

  const [date, setDate] = useState(todayStr);
  const [pic, setPic] = useState('');
  const [productId, setProductId] = useState('');
  const [chickenLotId, setChickenLotId] = useState('');
  const [fallbackChickenPrice, setFallbackChickenPrice] = useState(String(FALLBACK_CHICKEN_PRICE));
  const [adukan, setAdukan] = useState('');
  const [actualInput, setActualInput] = useState('');
  const [actualUnit, setActualUnit] = useState('PORSI');
  const [supportCost, setSupportCost] = useState('0');
  const [notes, setNotes] = useState('');

  const [filterMode, setFilterMode] = useState('MINGGU_INI');
  const [filterMonth, setFilterMonth] = useState(todayStr.substring(0, 7));

  const selectedProduct = useMemo(() => {
    return productionProducts.find((product) => String(getProductId(product)) === String(productId)) || null;
  }, [productionProducts, productId]);

  const selectedChickenLot = useMemo(() => {
    return chickenLotOptions.find((lot) => String(lot.lot_id) === String(chickenLotId)) || null;
  }, [chickenLotOptions, chickenLotId]);

  useEffect(() => {
    if (chickenLotOptions.length === 1 && !chickenLotId) {
      setChickenLotId(chickenLotOptions[0].lot_id);
      return;
    }

    if (chickenLotId && !chickenLotOptions.some((lot) => String(lot.lot_id) === String(chickenLotId))) {
      setChickenLotId(chickenLotOptions[0]?.lot_id || '');
    }
  }, [chickenLotOptions, chickenLotId]);

  const stockAyam = useMemo(() => {
    let masukKg = 0;
    let keluarKg = 0;

    chickenLotOptions.forEach((lot) => {
      masukKg += toNumber(lot.qty_kg_in || lot.qty_kg_remaining);
    });

    (pemalang || []).forEach((p) => {
      if (!isActiveRow(p)) return;
      const parsed = safeJsonParse(p.items, []);
      const fItem = parsed[0] || {};
      if (fItem.is_v2) keluarKg += toNumber(fItem.ayam_kg || fItem.chicken_kg_used || 0);
      else if (String(fItem.name || '').startsWith('@@PRODUCTION@@')) {
        const parts = String(fItem.name).split('||');
        keluarKg += toNumber(parts[2] || 0);
      } else {
        keluarKg += toNumber(p.chicken_kg_used || p.ayam_kg || 0);
      }
    });

    const sisaKg = masukKg - keluarKg;
    return {
      masukKantong: masukKg / 10,
      keluarKantong: keluarKg / 10,
      sisaKantong: sisaKg / 10,
      sisaKg,
    };
  }, [chickenLotOptions, pemalang]);

  const productDefaults = useMemo(() => {
    const product = selectedProduct || {};
    return {
      chickenKgPerAdukan: getProductDefault(product, ['chicken_kg_per_adukan', 'ayam_kg_per_adukan', 'default_chicken_kg', 'default_ayam_kg'], DEFAULT_CHICKEN_KG_PER_ADUKAN),
      yieldPcsPerAdukan: getProductDefault(product, ['yield_pcs_per_adukan', 'default_yield_pcs', 'pcs_per_adukan', 'hasil_pcs_per_adukan'], DEFAULT_YIELD_PCS_PER_ADUKAN),
      supportCostPerAdukan: getProductDefault(product, ['support_cost_per_adukan', 'additional_cost_per_adukan', 'bahan_pendukung_per_adukan'], 0),
    };
  }, [selectedProduct]);

  const kalkulasi = useMemo(() => {
    const adukanNum = toNumber(adukan);
    const inputAngka = toNumber(actualInput);

    const stdPcs = adukanNum * productDefaults.yieldPcsPerAdukan;
    const stdMika = stdPcs / 50;
    const stdPorsi = stdPcs / 4;

    let actualTotalPcs = 0;
    if (actualUnit === 'MIKA') actualTotalPcs = inputAngka * 50;
    if (actualUnit === 'PORSI') actualTotalPcs = inputAngka * 4;
    if (actualUnit === 'PCS') actualTotalPcs = inputAngka;

    const butuhAyamKg = adukanNum * productDefaults.chickenKgPerAdukan;
    const butuhAyamKantong = butuhAyamKg / 10;
    const sisaAyamKantong = stockAyam.sisaKantong - butuhAyamKantong;

    const chickenUnitCost = selectedChickenLot?.unit_cost || toNumber(fallbackChickenPrice) || FALLBACK_CHICKEN_PRICE;
    const chickenCost = butuhAyamKg * chickenUnitCost;
    const supportCostTotal = toNumber(supportCost) || (adukanNum * productDefaults.supportCostPerAdukan);
    const totalBatchCost = chickenCost + supportCostTotal;
    const hppPerPcs = actualTotalPcs > 0 ? totalBatchCost / actualTotalPcs : 0;
    const targetHppPerPcs = stdPcs > 0 ? totalBatchCost / stdPcs : 0;
    const variancePcs = actualTotalPcs - stdPcs;

    return {
      adukanNum,
      stdPcs,
      stdMika,
      stdPorsi,
      actualTotalPcs,
      inputAngka,
      butuhAyamKg,
      butuhAyamKantong,
      sisaAyamKantong,
      chickenUnitCost,
      chickenCost,
      supportCostTotal,
      totalBatchCost,
      hppPerPcs,
      targetHppPerPcs,
      variancePcs,
    };
  }, [adukan, actualInput, actualUnit, stockAyam, productDefaults, selectedChickenLot, fallbackChickenPrice, supportCost]);

  const filteredProductionLogs = useMemo(() => {
    return (pemalang || []).filter((p) => {
      if (!isActiveRow(p)) return false;
      if (filterMode === 'HARI_INI') return p.date === todayStr;
      if (filterMode === 'BULAN_INI') return String(p.date).startsWith(todayStr.substring(0, 7));
      if (filterMode === 'PILIH_BULAN') return String(p.date).startsWith(filterMonth);
      if (filterMode === 'MINGGU_INI') {
        const dDate = new Date(p.date);
        const dToday = new Date(todayStr);
        const diff = (dToday - dDate) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
      }
      return true;
    }).sort((a, b) => String(b.id || '').localeCompare(String(a.id || '')));
  }, [pemalang, filterMode, filterMonth, todayStr]);

  const summaryFiltered = useMemo(() => {
    let totalAdukan = 0;
    let totalYieldPcs = 0;
    let totalCost = 0;
    filteredProductionLogs.forEach((log) => {
      totalYieldPcs += toNumber(log.qty || log.actual_pcs);
      totalCost += toNumber(log.total_batch_cost || log.batch_cost_total || 0);
      const parsed = safeJsonParse(log.items, []);
      const fItem = parsed[0] || {};
      if (fItem.is_v2) totalAdukan += toNumber(fItem.adukan || 0);
      else totalAdukan += toNumber(log.adukan_qty || 0);
    });
    return { totalAdukan, totalYieldPcs, totalCost };
  }, [filteredProductionLogs]);

  const handleAdukanChange = (val) => {
    const adk = toNumber(String(val).replace(/\D/g, ''));
    setAdukan(String(adk));
    setActualInput(String(adk * DEFAULT_PORSI_PER_ADUKAN));
    setActualUnit('PORSI');
    if (!supportCost || supportCost === '0') {
      setSupportCost(String(adk * productDefaults.supportCostPerAdukan));
    }
  };

  const handleSubmitProduction = async (e) => {
    e.preventDefault();
    if (kalkulasi.adukanNum <= 0) return alert('Jumlah adukan tidak boleh kosong!');
    if (kalkulasi.actualTotalPcs <= 0) return alert('Hasil fisik tidak boleh kosong!');
    if (!selectedProduct) return alert('Pilih produk hasil adukan dari Master Produk!');
    if (!pic) return alert('Kepala Dapur/PIC wajib diisi!');

    if (!selectedChickenLot) return alert('Belum ada stok ayam yang dipilih. Catat pembelian ayam di menu Beli Ayam / Purchase dulu supaya stok gudang valid.');

    if (kalkulasi.butuhAyamKg > toNumber(selectedChickenLot.qty_kg_remaining)) {
      return alert(`Stok ayam yang dipilih tidak cukup. Dapur butuh ${formatNumber(kalkulasi.butuhAyamKg)} kg, stok terpilih sisa ${formatNumber(selectedChickenLot.qty_kg_remaining)} kg. Pilih stok lain atau catat DROP Ayam dulu.`);
    }

    if (kalkulasi.butuhAyamKantong > stockAyam.sisaKantong) {
      return alert(`Total stok ayam tidak cukup. Dapur butuh ${formatNumber(kalkulasi.butuhAyamKantong)} kantong, sistem sisa ${formatNumber(stockAyam.sisaKantong)} kantong. Catat DROP Ayam dulu atau pilih stok lain.`);
    }

    const batchId = generateId('PRD', date);
    const productName = getProductName(selectedProduct);
    const productCode = getProductCode(selectedProduct);
    const finalProductId = getProductId(selectedProduct);

    const costTrace = {
      chicken_lot_id: selectedChickenLot?.lot_id || '',
      chicken_lot_label: selectedChickenLot?.label || '',
      chicken_unit_cost: kalkulasi.chickenUnitCost,
      chicken_kg_used: kalkulasi.butuhAyamKg,
      chicken_total_cost: kalkulasi.chickenCost,
      support_cost_total: kalkulasi.supportCostTotal,
      total_batch_cost: kalkulasi.totalBatchCost,
      actual_pcs: kalkulasi.actualTotalPcs,
      hpp_per_pcs: kalkulasi.hppPerPcs,
      cost_method: selectedChickenLot ? 'ACTUAL_CHICKEN_LOT' : 'FALLBACK_PRICE',
      trace_chain: 'DROP-AYAM lot → Adukan batch → Finished-good stock layer → Order item → Accounting journal',
    };

    const secureItemsData = [{
      product_id: finalProductId,
      product_code: productCode,
      name: productName,
      qty: kalkulasi.actualTotalPcs,
      adukan,
      ayam_kg: kalkulasi.butuhAyamKg,
      hpp_per_pcs: kalkulasi.hppPerPcs,
      total_batch_cost: kalkulasi.totalBatchCost,
      chicken_lot_id: selectedChickenLot?.lot_id || '',
      notes: notes || '-',
      is_v2: true,
    }];

    const confirmMsg = `=== POSTING PRODUKSI / ADUKAN ===\n\nTanggal  : ${formatDate(date)}\nPIC      : ${pic.toUpperCase()}\nProduk   : ${productName}\nAdukan   : ${adukan} Kali\nFisik    : ${formatNumber(kalkulasi.actualTotalPcs)} Pcs\nAyam     : ${formatNumber(kalkulasi.butuhAyamKg)} Kg x ${formatMoney(kalkulasi.chickenUnitCost)}\nPerkiraan Modal Batch: ${formatMoney(kalkulasi.totalBatchCost)}\nModal / Pcs        : ${formatMoney(kalkulasi.hppPerPcs)}\n\nSistem akan mencatat ayam dipakai, stok jadi masuk freezer, dan modal produk terkunci. Lanjutkan?`;

    if (!window.confirm(confirmMsg)) return;

    const payloadBatch = {
      id: batchId,
      date,
      branch_id: currentBranch,
      location_id: currentBranch,
      customer_name: 'PRODUKSI_ADUKAN',
      sales_channel: 'PRODUCTION_YIELD',
      items: JSON.stringify(secureItemsData),
      qty: kalkulasi.actualTotalPcs,
      total_amount: 0,
      amount_paid: 0,
      payment_method: 'SISTEM_PRODUKSI',
      status: 'LUNAS',
      notes: `${String(notes || '').toUpperCase()} (Asal: ${adukan} adukan, fisik: ${actualInput} ${actualUnit})`,
      isDeleted: false,
      bridge_source: 'LEGACY_FACTORY_TAB_PEMALANG_DYNAMIC_HPP',
      production_location_id: currentBranch,
      product_id: finalProductId,
      product_code: productCode,
      item_name: productName,
      product_name: productName,
      pic: pic.toUpperCase(),
      selected_chicken_lot_id: selectedChickenLot?.lot_id || '',
      chicken_lot_id: selectedChickenLot?.lot_id || '',
      chicken_lot_label: selectedChickenLot?.label || '',
      chicken_unit_cost: kalkulasi.chickenUnitCost,
      chicken_kg_used: kalkulasi.butuhAyamKg,
      chicken_total_cost: kalkulasi.chickenCost,
      support_cost_total: kalkulasi.supportCostTotal,
      total_batch_cost: kalkulasi.totalBatchCost,
      hpp_per_pcs: kalkulasi.hppPerPcs,
      cost_method: costTrace.cost_method,
      cost_trace_json: JSON.stringify(costTrace),
      actual_input_qty: kalkulasi.inputAngka,
      actual_unit: actualUnit,
      actual_pcs: kalkulasi.actualTotalPcs,
      adukan_qty: kalkulasi.adukanNum,
    };

    const isSuccess = await sendToSheet('insert', payloadBatch, 'pemalang');
    if (isSuccess) {
      if (typeof showToast === 'function') showToast('Produksi adukan berhasil diproses. Stok jadi masuk freezer dan modal produk terkunci per sesi.', 'success');
      setAdukan('');
      setActualInput('');
      setSupportCost('0');
      setNotes('');
      setProductId('');
      setPic('');
    }
  };

  const handleVoidProduction = async (id) => {
    if (!window.confirm(`Void laporan produksi ${id}? Catatan stok terkait akan dibatalkan oleh backend bridge jika data sudah masuk mesin baru.`)) return;
    const isSuccess = await sendToSheet('update', { id, production_id: id, isDeleted: true }, 'pemalang');
    if (isSuccess && typeof showToast === 'function') showToast(`Log Batch ${id} berhasil di-void!`, 'success');
  };

  const potensiAdukan = Math.floor(stockAyam.sisaKantong / 3);

  return (
    <div className="flex flex-col gap-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-red-900 via-rose-900 to-red-900 p-6 lg:p-8 flex flex-col xl:flex-row justify-between items-stretch gap-6 rounded-3xl shadow-xl relative overflow-hidden border border-red-800">
        <div className="absolute top-0 right-0 p-4 opacity-5"><Factory size={120} className="text-red-400" /></div>
        <div className="relative z-10 w-full xl:w-1/3 shrink-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <Database size={24} className="text-red-400" />
            <h2 className="text-xl font-black text-white uppercase tracking-wide">Produksi / Adukan</h2>
          </div>
          <p className="text-[11px] font-bold text-slate-300 leading-relaxed max-w-sm">
            Gerbang resmi membuat stok barang jadi. Setiap adukan mengambil stok ayam dari DROP yang dipilih, lalu modal produk dikunci otomatis.
          </p>
        </div>

        <div className="relative z-10 w-full xl:w-2/3 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col justify-between shadow-inner backdrop-blur-sm relative overflow-hidden">
            {kalkulasi.sisaAyamKantong < 0 && <div className="absolute top-0 w-full left-0 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest text-center py-0.5">Stok Minus!</div>}
            <div>
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">Sisa Ayam Siap Adukan</div>
              <div className="text-4xl font-black text-white tracking-tight my-1">
                {formatNumber(stockAyam.sisaKantong)} <span className="text-sm text-slate-500 font-bold">Kntg</span>
              </div>
            </div>
            <div className="text-[10px] font-bold text-slate-400 mt-2 border-t border-slate-700/50 pt-2 flex flex-col gap-1">
              <div className="flex justify-between">
                <span>Masuk: <b className="text-slate-300">{formatNumber(stockAyam.masukKantong)}</b></span>
                <span>Dipakai: <b className="text-amber-500">{formatNumber(stockAyam.keluarKantong)}</b></span>
              </div>
              <div className="text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded-md mt-1 inline-block border border-emerald-900/50 w-max">
                Potensi: <b>{potensiAdukan} Adukan</b> (~{formatNumber(potensiAdukan * 250)} Porsi)
              </div>
            </div>
          </div>

          <div className="flex-[1.5] bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col justify-center shadow-inner backdrop-blur-sm">
            <div className="text-[11px] font-black text-emerald-400 uppercase tracking-wider mb-3">Hasil Produksi ({filterMode.replace('_', ' ')})</div>
            <div className="flex flex-row items-end gap-6 mb-2">
              <div>
                <div className="text-5xl font-black text-emerald-500 tracking-tighter leading-none drop-shadow-md">{formatNumber(summaryFiltered.totalYieldPcs)}</div>
                <div className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1.5">TOTAL PCS</div>
              </div>
              <div className="h-12 w-px bg-slate-700/60 hidden sm:block"></div>
              <div>
                <div className="text-4xl font-black text-emerald-400 tracking-tighter leading-none drop-shadow-md">{formatNumber(summaryFiltered.totalYieldPcs / 4)}</div>
                <div className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1.5">TOTAL PORSI</div>
              </div>
            </div>
            <div className="text-[10px] font-bold text-emerald-600 mt-2 pt-3 border-t border-slate-700/50 flex justify-between">
              <span>Putaran Mesin: <b className="text-emerald-400 text-[11px]">{formatNumber(summaryFiltered.totalAdukan)} Adukan</b></span>
              <span>Perkiraan Modal: <b className="text-emerald-400 text-[11px]">{formatMoney(summaryFiltered.totalCost)}</b></span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-t-4 border-t-red-600 h-max">
          <div className="p-6 border-b border-slate-100 bg-slate-50 shrink-0 flex items-center gap-2">
            <Factory size={18} className="text-red-600" />
            <h4 className="font-black text-slate-800 uppercase tracking-wide text-sm">Form Produksi / Adukan</h4>
          </div>
          <form onSubmit={handleSubmitProduction} className="p-6 space-y-5 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Tanggal Adukan</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer bg-slate-50 focus:bg-white focus:border-red-400 shadow-sm transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Kepala Dapur / PIC</label>
                <input type="text" required value={pic} onChange={(e) => setPic(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-red-400 shadow-sm uppercase transition-colors" placeholder="NAMA PIC..." />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Produk Hasil Adukan</label>
              <select required value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-red-400 shadow-sm uppercase cursor-pointer">
                <option value="">-- Pilih dari Master Produk yang pakai proses Adukan --</option>
                {productionProducts.map((product) => (
                  <option key={getProductId(product)} value={getProductId(product)}>
                    {getProductName(product)}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-[10px] font-bold text-slate-400 leading-relaxed">
                Dropdown ini otomatis mengambil produk aktif dari Master Produk yang dicentang pakai proses Adukan.
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Pilih Stok Ayam yang Dipakai</label>
              <select value={chickenLotId} onChange={(e) => setChickenLotId(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-red-400 shadow-sm uppercase cursor-pointer">
                <option value="">-- Pilih stok ayam aktif --</option>
                {chickenLotOptions.map((lot) => (
                  <option key={lot.lot_id} value={lot.lot_id}>
                    {lot.label || lot.lot_id} · {formatNumber(lot.qty_kg_remaining)} kg · {formatMoney(lot.unit_cost)}/kg
                  </option>
                ))}
              </select>
              {!selectedChickenLot && (
                <div className="mt-3 grid grid-cols-2 gap-3 items-end rounded-2xl border border-amber-100 bg-amber-50 p-3">
                  <div>
                    <label className="text-[9px] font-black text-amber-700 uppercase tracking-wider block mb-1">Harga Ayam Darurat / Kg</label>
                    <input value={fallbackChickenPrice} onChange={(e) => setFallbackChickenPrice(e.target.value.replace(/\D/g, ''))} className="w-full p-2 border border-amber-200 rounded-xl text-xs font-black bg-white outline-none" />
                  </div>
                  <div className="text-[10px] font-bold text-amber-700 leading-relaxed">
                    Harga darurat hanya untuk simulasi. Untuk posting real, catat DROP Ayam dulu agar stok dan modal valid.
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner relative">
              <div className="absolute -top-3 left-5 bg-slate-800 text-white text-[9px] font-black px-3 py-0.5 rounded-md shadow-md uppercase tracking-widest">Langkah 1</div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2 text-center mt-2">Total Adukan Hari Ini</label>
              <input type="number" min="0" required value={adukan} onChange={(e) => handleAdukanChange(e.target.value)} className="w-full p-4 border-2 border-slate-300 rounded-xl text-4xl font-black text-slate-500 bg-white outline-none text-center focus:border-red-500 shadow-sm transition-colors" placeholder="0" />
              <div className="mt-4 pt-4 border-t border-slate-200 text-[10px] text-center font-black uppercase tracking-wider text-slate-500">
                <span>Target: <b className="text-slate-800">{formatNumber(kalkulasi.stdPcs)} pcs / {formatNumber(kalkulasi.stdPorsi)} porsi</b></span>
              </div>
            </div>

            <div className="bg-red-50/50 p-5 rounded-2xl border border-red-100 shadow-inner relative">
              <div className="absolute -top-3 left-5 bg-red-600 text-white text-[9px] font-black px-3 py-0.5 rounded-md flex items-center gap-1.5 shadow-md uppercase tracking-widest"><PackageCheck size={12} /> Langkah 2</div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-3 text-center mt-2">Hasil Kemasan Fisik Nyata</label>
              <div className="grid grid-cols-12 gap-3 items-stretch">
                <div className="col-span-8">
                  <input type="number" min="0" required value={actualInput} onChange={(e) => setActualInput(e.target.value)} className="w-full p-4 border-2 border-red-200 rounded-xl text-3xl font-black text-red-700 bg-white outline-none text-center focus:border-red-500 shadow-sm transition-colors h-full" placeholder="0" />
                </div>
                <div className="col-span-4">
                  <select value={actualUnit} onChange={(e) => setActualUnit(e.target.value)} className="w-full px-2 bg-slate-900 text-white rounded-xl text-xs font-black outline-none cursor-pointer border-2 border-slate-800 shadow-md text-center h-full uppercase tracking-wider hover:bg-black transition-colors">
                    <option value="PORSI">Porsi (4)</option>
                    <option value="MIKA">Mika (50)</option>
                    <option value="PCS">Pcs (1)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 space-y-2">
              <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Ringkasan Modal Produksi</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-bold text-slate-700">
                <span>Ayam dipakai</span><span className="text-right">{formatNumber(kalkulasi.butuhAyamKg)} kg</span>
                <span>Harga beli ayam / kg</span><span className="text-right">{formatMoney(kalkulasi.chickenUnitCost)}</span>
                <span>Modal ayam dipakai</span><span className="text-right">{formatMoney(kalkulasi.chickenCost)}</span>
                <span>Bahan pendukung</span><span className="text-right">{formatMoney(kalkulasi.supportCostTotal)}</span>
                <span className="font-black text-slate-900">Total perkiraan modal</span><span className="text-right font-black text-slate-900">{formatMoney(kalkulasi.totalBatchCost)}</span>
                <span className="font-black text-red-700">Modal / pcs aktual</span><span className="text-right font-black text-red-700">{formatMoney(kalkulasi.hppPerPcs)}</span>
              </div>
              <div className="pt-2 border-t border-emerald-100 text-[10px] font-bold text-emerald-700 leading-relaxed">
                Alur: Stok ayam dipakai → Adukan dibuat → Stok jadi masuk freezer → Order/Kasir.
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Biaya Bahan Pendukung Batch</label>
              <input type="text" value={supportCost} onChange={(e) => setSupportCost(e.target.value.replace(/\D/g, ''))} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-red-400 shadow-sm" placeholder="0" />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Catatan Tambahan</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 outline-none focus:bg-white focus:border-red-400 shadow-sm normal-case transition-colors" placeholder="Opsional..." />
            </div>

            <button type="submit" className="w-full py-4 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 mt-2 bg-red-600 hover:bg-red-700 text-white uppercase tracking-wider transition-transform active:scale-95 cursor-pointer">
              <CheckCircle2 size={16} /> Posting Adukan & Masukkan Stok Jadi
            </button>
          </form>
        </div>

        <div className="xl:col-span-7 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h4 className="font-black text-slate-800 uppercase tracking-wide text-sm flex items-center gap-2"><ClipboardList size={18} className="text-amber-600" /> Riwayat Produksi & Adukan Dapur</h4>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
              <Calendar size={14} className="text-amber-500 ml-0.5" />
              <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className="text-[11px] font-black outline-none cursor-pointer text-slate-700 uppercase tracking-wider bg-transparent">
                <option value="HARI_INI">Hari Ini</option>
                <option value="MINGGU_INI">7 Hari Terakhir</option>
                <option value="BULAN_INI">Bulan Ini</option>
                <option value="PILIH_BULAN">Pilih Bulan...</option>
              </select>
              {filterMode === 'PILIH_BULAN' && (
                <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="text-[11px] font-bold outline-none cursor-pointer text-slate-700 border-l border-slate-200 pl-2 ml-1" />
              )}
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[60vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0 shadow-sm bg-white z-10">
                <tr>
                  <th className="px-5 py-4 font-black">Waktu & Batch</th>
                  <th className="px-5 py-4 font-black">Matriks Adukan</th>
                  <th className="px-5 py-4 font-black">Ayam Dipakai</th>
                  <th className="px-5 py-4 font-black">Hasil & Modal</th>
                  <th className="px-5 py-4 font-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProductionLogs.map((log) => {
                  const parsed = safeJsonParse(log.items, []);
                  const meta = parsed[0] || {};
                  const logAdukan = toNumber(meta.adukan || log.adukan_qty);
                  const logAyamKg = toNumber(meta.ayam_kg || log.chicken_kg_used);
                  const logHpp = toNumber(meta.hpp_per_pcs || log.hpp_per_pcs);
                  const logCost = toNumber(meta.total_batch_cost || log.total_batch_cost);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-4 align-top">
                        <div className="font-black text-slate-800 text-xs">{log.id}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1">{formatDate(log.date)} · {log.pic || '-'}</div>
                        <div className="mt-1 text-[10px] font-black text-red-600">{log.item_name || meta.name}</div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="font-black text-slate-700">{formatNumber(logAdukan)} x Adukan</div>
                        <div className="text-[10px] text-slate-400 font-bold">Target {formatNumber(logAdukan * 1000)} pcs</div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="font-black text-amber-700">{formatNumber(logAyamKg)} Kg</div>
                        <div className="text-[10px] text-slate-400 font-bold">{formatNumber(logAyamKg / 10)} Kantong</div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="font-black text-emerald-700">{formatNumber(log.qty || log.actual_pcs)} Pcs</div>
                        <div className="text-[10px] text-slate-500 font-bold">Modal batch {formatMoney(logCost)}</div>
                        <div className="text-[10px] text-red-600 font-black">Modal {formatMoney(logHpp)} / pcs</div>
                      </td>
                      <td className="px-5 py-4 align-top text-center">
                        <button type="button" onClick={() => handleVoidProduction(log.production_id || log.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredProductionLogs.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-24 text-center text-slate-300">
                      <Factory size={48} className="mx-auto mb-3 opacity-20" />
                      <div className="font-black text-slate-400 uppercase">Belum Ada Laporan</div>
                      <p className="text-xs font-bold mt-1">Tidak ada rekam jejak produksi dapur di periode ini.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
