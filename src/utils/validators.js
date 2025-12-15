function requireValidIndianMobile(phone, label = 'Phone number') {
  const normalized = String(phone || '').trim();
  if (!/^\d{10}$/.test(normalized)) {
    throw new Error(`${label} must be a valid 10-digit Indian mobile number`);
  }
  return normalized;
}

module.exports = {
  requireValidIndianMobile,
};
