// ======================================================
// LEGACY COMPATIBILITY SHIM
// ERP lama banyak tab import dari:
// ../../services/erpOrchestrator
//
// Engine aslinya ada di:
// ../utils/erpOrchestrator
//
// File ini dibuat supaya import lama tetap jalan tanpa edit
// semua tab satu per satu.
// ======================================================

export { default } from "../utils/erpOrchestrator";
export * from "../utils/erpOrchestrator";
