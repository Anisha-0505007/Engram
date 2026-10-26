export function normalizePhoneNumber(input) {
  // WhatsApp expects country-code digits; accept normal human formatting at the prompt.
  const phone = input.trim().replace(/[ ()-]/g, '').replace(/^\+/, '');
  if (!/^[1-9]\d{7,14}$/.test(phone)) {
    throw new Error('Enter your own WhatsApp phone number with its country code (8–15 digits).');
  }
  return phone;
}
