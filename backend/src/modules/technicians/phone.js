/** Ugandan MSISDN helpers for technician phones and SMS. */

export function normalizeUgPhone(phone) {
  let digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length === 10) {
    digits = `256${digits.slice(1)}`;
  }
  if (digits.startsWith('256') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return '';
}

export function isValidUgPhone(phone) {
  const normalized = normalizeUgPhone(phone);
  return /^\+2567\d{8}$/.test(normalized);
}
