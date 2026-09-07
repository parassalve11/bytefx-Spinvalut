import { normalizeAccounts } from './clientDetails.js';
/**
 * Masking helpers used when "Hide sensitive info" is enabled. Every helper is a
 * pure string transform so cards and the winner modal stay in sync.
 */

/** "usr_10293" -> "usr_1••••" (keeps enough to be recognisable, not lookup-able). */
export function maskId(id) {
  if (!id) return "";
  const head = id.slice(0, Math.min(5, Math.ceil(id.length / 2)));
  return head + "•".repeat(Math.max(id.length - head.length, 3));
}

/** "8420418" -> "8•••••8" — first and last digit survive. */
export function maskClientId(clientId) {
  if (!clientId) return "";
  const plain = String(clientId);
  if (plain.length <= 2) return "•".repeat(plain.length);
  return `${plain[0]}${"•".repeat(plain.length - 2)}${plain[plain.length - 1]}`;
}

/** "pratik.patil@mail.com" -> "p••••@mail.com". */
export function maskEmail(email) {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at < 1) return "•".repeat(email.length);
  const local = email.slice(0, at);
  const domain = email.slice(at);
  return `${local[0]}${"•".repeat(Math.max(local.length - 1, 3))}${domain}`;
}

/**
 * Applies every mask to a participant when `hide` is true, otherwise returns the
 * participant untouched. Components call this once and render the result.
 */
export function maskParticipant(participant, hide) {
  if (!participant || !hide) return participant;
  return {
    ...participant,
    id: maskId(participant.id),
    clientId: maskAccounts(participant.clientId),
    phone: maskPhone(participant.phone),
    email: maskEmail(participant.email),
  };
}

export function maskAccounts(value) {
  return normalizeAccounts(value).map(maskClientId).join(", ");
}

export function maskPhone(value) {
  if (!value) return "";
  const text = String(value);
  let remaining = (text.match(/\d/g) || []).length;
  return text.replace(/\d/g, digit => --remaining >= 2 ? "•" : digit);
}
