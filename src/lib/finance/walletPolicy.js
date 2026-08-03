function clean(value) {
  return String(value ?? "").trim().toUpperCase();
}

function includesAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

export function walletClass(wallet = {}) {
  const text = clean(`${wallet.wallet_code || ""} ${wallet.wallet_name || ""} ${wallet.payment_channel || ""}`);
  if (includesAny(text, ["BCA", "BRI", "BNI", "MANDIRI", "BANK", "REKENING"])) return "BANK";
  if (includesAny(text, ["QRIS", "GOPAY", "OVO", "DANA", "SHOPEE", "LINKAJA", "E-WALLET", "EWALLET"])) return "EWALLET";
  if (includesAny(text, ["CASH", "KAS", "TUNAI", "LACI", "BRANKAS"])) return "CASH";
  const type = clean(wallet.wallet_type);
  if (["BANK", "CASH", "EWALLET"].includes(type)) return type;
  return "GENERIC";
}

export function suggestedPaymentMethod(wallet = {}) {
  const type = walletClass(wallet);
  if (type === "CASH") return "Cash";
  if (type === "EWALLET") return "QRIS";
  return "Transfer";
}

export function allowedPaymentMethods(wallet = {}) {
  const type = walletClass(wallet);
  if (type === "CASH") return ["Cash"];
  if (type === "BANK") return ["Transfer", "Debit", "Merchant"];
  if (type === "EWALLET") return ["QRIS", "E-Wallet", "Transfer", "Merchant"];
  return ["Cash", "Transfer", "Debit", "QRIS", "E-Wallet", "Merchant"];
}

export function paymentMethodMatchesWallet(wallet = {}, method = "") {
  const aliases = { TUNAI: "CASH", KAS: "CASH", BCA: "TRANSFER", BRI: "TRANSFER", BNI: "TRANSFER", MANDIRI: "TRANSFER", TF: "TRANSFER", BANK: "TRANSFER" };
  const raw = clean(method);
  const normalized = aliases[raw] || raw;
  return allowedPaymentMethods(wallet).some((item) => clean(item).replace("E-WALLET", "EWALLET") === normalized.replace("E-WALLET", "EWALLET"));
}
