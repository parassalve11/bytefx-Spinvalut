import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

/** Infer numbering-plan country before privacy masking. Never assume a local default. */
export function phoneCountry(value) {
  if (typeof value !== 'string' || !/^[+\d\s().-]+$/.test(value.trim())) return null;
  let number = value.trim().replace(/[\s().-]/g, '');
  if (number.startsWith('00')) number = '+' + number.slice(2);
  // ByteFX can omit '+' from a full international number. Local numbers are ambiguous.
  if (!number.startsWith('+')) {
    if (!/^\d{11,15}$/.test(number)) return null;
    number = '+' + number;
  }
  const phone = parsePhoneNumberFromString(number, { extract: false });
  return phone?.isValid() && phone.country ? phone.country : null;
}
