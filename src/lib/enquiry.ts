// EM Fine Studio — enquiry validation + email composition (pure, unit-testable).
// The API route (src/pages/api/enquiries.ts) re-validates everything server-side
// here; the client mirrors these rules for inline errors. Never trust the client.

export type Kind = 'design' | 'contact';

export interface PhotoRef {
  filename: string;
  type: 'image/jpeg' | 'image/png' | 'image/webp';
  /** base64 payload (no data: prefix) */
  data: string;
}

export interface DesignEnquiry {
  kind: 'design';
  name: string;
  email: string;
  phone?: string;
  pieceType: string;
  pieceTypeOther?: string;
  metals: string[];
  gemstones?: string;
  budget?: string;
  brief: string;
  photos: PhotoRef[];
  contactPref: string;
  consent: boolean;
}

export interface ContactEnquiry {
  kind: 'contact';
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type Enquiry = DesignEnquiry | ContactEnquiry;

export const PIECE_TYPES = [
  'Ring',
  'Engagement ring',
  'Pendant',
  'Earrings',
  'Bracelet',
  'Heirloom redesign',
  'Other',
] as const;

export const METALS = ['Fine gold', '9K gold', '14K gold', '18K gold', '925 sterling silver', 'Selected metal alloys', 'Not sure — advise me'] as const;

export const BUDGETS = ['Under $500', '$500–$1,000', '$1,000–$3,000', '$3,000+', 'Not sure yet'] as const;

export const CONTACT_PREFS = ['Email', 'Phone', 'Either'] as const;

export const CONTACT_SUBJECTS = ['Custom design', 'Repairs', 'Pieces & components', 'Other'] as const;

export const PHOTO_TYPES: PhotoRef['type'][] = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB each
// Field maximums (harden-site-security): bound unbounded text fields so one
// request can neither flood the KV archive nor the studio inbox.
export const MAX_NAME = 100;
export const MAX_PHONE = 40;
export const MAX_PIECE_TYPE_OTHER = 100;
export const MAX_GEMSTONES = 500;
export const MAX_BRIEF = 4000;
export const MAX_MESSAGE = 4000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationResult {
  ok: boolean;
  errors?: string[];
  data?: Enquiry;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Approximate decoded size of a base64 string, without decoding. */
function base64DecodedBytes(b64: string): number {
  const clean = b64.replace(/\s+/g, '');
  if (clean.length === 0) return 0;
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - pad;
}

/**
 * Magic-byte signatures per allowed photo type. WebP is a RIFF container:
 * "RIFF" at 0 and "WEBP" at 8 (bytes 4..7 are the little-endian payload size).
 */
const MAGIC_BYTES: Record<PhotoRef['type'], number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46, 0x57, 0x45, 0x42, 0x50], // RIFF + WEBP
};

/** True when the decoded bytes carry the signature of the declared type. */
function matchesMimeMagic(bytes: Uint8Array, mime: PhotoRef['type']): boolean {
  const sig = MAGIC_BYTES[mime];
  if (mime === 'image/webp') {
    if (bytes.length < 12) return false;
    const head = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
    const tail = sig.slice(4); // "WEBP"
    return head.every((b, j) => bytes[j] === b) && tail.every((b, j) => bytes[8 + j] === b);
  }
  return sig.every((b, j) => bytes[j] === b);
}

// Both runtime targets expose a global `Buffer` (the Node unit harness
// natively; the worker via nodejs_compat), but the type-checker knows no
// @types/node by design, so reach it through a typed global handle.
const nodeBuffer: {
  from(data: string, encoding?: 'base64'): Uint8Array;
} = (globalThis as unknown as {
  Buffer: { from(data: string, encoding?: 'base64'): Uint8Array };
}).Buffer;

function parsePhoto(v: unknown, i: number, errors: string[]): PhotoRef | null {
  if (typeof v !== 'string' || !v.startsWith('data:')) {
    errors.push(`photos[${i}]: must be a data URL`);
    return null;
  }
  const m = v.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!m) {
    errors.push(`photos[${i}]: malformed data URL`);
    return null;
  }
  const mime = m[1] as PhotoRef['type'];
  if (!PHOTO_TYPES.includes(mime)) {
    errors.push(`photos[${i}]: type must be JPEG, PNG or WebP`);
    return null;
  }
  if (m[2] !== ';base64') {
    errors.push(`photos[${i}]: must be base64-encoded`);
    return null;
  }
  const raw = m[3].replace(/\s+/g, '');
  const bytes = base64DecodedBytes(raw);
  if (bytes <= 0 || bytes > MAX_PHOTO_BYTES) {
    errors.push(`photos[${i}]: each photo must be at least 1 byte and no more than 5 MB`);
    return null;
  }
  // Content checks (harden-site-security): the payload must be genuine
  // base64 and the decoded bytes must carry the declared type's magic.
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) {
    errors.push(`photos[${i}]: must be valid base64`);
    return null;
  }
  const decoded = nodeBuffer.from(raw, 'base64');
  if (!matchesMimeMagic(decoded, mime)) {
    errors.push(`photos[${i}]: bytes do not match the declared ${mime} type`);
    return null;
  }
  return { filename: `photo-${i + 1}`, type: mime, data: raw };
}

export function validatePayload(payload: unknown, kind: Kind): ValidationResult {
  const errors: string[] = [];
  if (kind === 'design') {
    const p = (payload ?? {}) as Record<string, unknown>;
    const name = asString(p.name);
    if (name.length < 2) errors.push('name must be at least 2 characters');
    if (name.length > MAX_NAME) errors.push(`name too long (max ${MAX_NAME} characters)`);

    const email = asString(p.email);
    if (!EMAIL_RE.test(email)) errors.push('a valid email is required');

    const phone = asString(p.phone); // optional, free text
    if (phone.length > MAX_PHONE) errors.push(`phone too long (max ${MAX_PHONE} characters)`);

    const pieceType = asString(p.pieceType);
    if (!PIECE_TYPES.includes(pieceType as (typeof PIECE_TYPES)[number])) {
      errors.push('pieceType must be one of the offered piece types');
    }
    const pieceTypeOther = asString(p.pieceTypeOther);
    if (pieceType === 'Other' && pieceTypeOther.length < 2) {
      errors.push('please describe the piece type when selecting Other');
    }
    if (pieceTypeOther.length > MAX_PIECE_TYPE_OTHER) {
      errors.push(`pieceTypeOther too long (max ${MAX_PIECE_TYPE_OTHER} characters)`);
    }

    const metals = Array.isArray(p.metals)
      ? [...new Set(p.metals.filter((m): m is string => typeof m === 'string'))]
      : [];
    if (metals.length === 0) errors.push('select at least one metal');
    for (const m of metals) {
      if (!METALS.includes(m as (typeof METALS)[number])) errors.push(`unknown metal: ${m}`);
    }

    const gemstones = asString(p.gemstones); // optional
    if (gemstones.length > MAX_GEMSTONES) errors.push(`gemstones too long (max ${MAX_GEMSTONES} characters)`);
    const budget = asString(p.budget);
    if (budget && !BUDGETS.includes(budget as (typeof BUDGETS)[number])) {
      errors.push('budget must be one of the offered ranges');
    }

    const brief = asString(p.brief);
    if (brief.length < 40) errors.push('brief must be at least 40 characters');
    if (brief.length > MAX_BRIEF) errors.push(`brief too long (max ${MAX_BRIEF} characters)`);

    let photos: PhotoRef[] = [];
    if (p.photos !== undefined) {
      if (!Array.isArray(p.photos) || p.photos.length > MAX_PHOTOS) {
        errors.push(`up to ${MAX_PHOTOS} photos are allowed`);
      } else {
        photos = p.photos.map((v, i) => parsePhoto(v, i, errors)).filter(Boolean) as PhotoRef[];
      }
    }

    const contactPref = asString(p.contactPref);
    if (!CONTACT_PREFS.includes(contactPref as (typeof CONTACT_PREFS)[number])) {
      errors.push('select how you prefer to be contacted');
    }

    if (p.consent !== true) errors.push('consent is required');

    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      data: {
        kind: 'design',
        name,
        email,
        ...(phone ? { phone } : {}),
        pieceType,
        ...(pieceType === 'Other' ? { pieceTypeOther } : {}),
        metals,
        ...(gemstones ? { gemstones } : {}),
        ...(budget ? { budget } : {}),
        brief,
        photos,
        contactPref,
        consent: true,
      },
    };
  }

  // contact
  const p = (payload ?? {}) as Record<string, unknown>;
  const name = asString(p.name);
  if (name.length < 2) errors.push('name must be at least 2 characters');
  if (name.length > MAX_NAME) errors.push(`name too long (max ${MAX_NAME} characters)`);
  const email = asString(p.email);
  if (!EMAIL_RE.test(email)) errors.push('a valid email is required');
  const subject = asString(p.subject);
  if (!CONTACT_SUBJECTS.includes(subject as (typeof CONTACT_SUBJECTS)[number])) {
    errors.push('select a subject');
  }
  const message = asString(p.message);
  if (message.length < 2) errors.push('a message is required');
  if (message.length > MAX_MESSAGE) errors.push(`message too long (max ${MAX_MESSAGE} characters)`);
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { kind: 'contact', name, email, subject, message } };
}

export function displayPieceType(q: DesignEnquiry): string {
  return q.pieceType === 'Other' ? `${q.pieceTypeOther ?? 'Other'}` : q.pieceType;
}

export function emailSubject(q: Enquiry): string {
  if (q.kind === 'design') {
    return `New custom design enquiry — ${q.name} — ${displayPieceType(q)}`;
  }
  return `New ${q.subject} message — ${q.name}`;
}

/** Plain-text body, one line per field, in form order (T1 spec §4). */
export function emailBody(q: Enquiry): string {
  if (q.kind === 'design') {
    const lines = [
      `Name: ${q.name}`,
      `Email: ${q.email}`,
      ...(q.phone ? [`Phone: ${q.phone}`] : []),
      `Piece type: ${displayPieceType(q)}`,
      `Metals: ${q.metals.join(', ')}`,
      ...(q.gemstones ? [`Gemstones / details: ${q.gemstones}`] : []),
      ...(q.budget ? [`Budget: ${q.budget}`] : []),
      `Preferred contact: ${q.contactPref}`,
      '',
      'Brief:',
      q.brief,
      ...(q.photos.length ? [``, `Photos attached: ${q.photos.map((p) => p.filename).join(', ')}`] : []),
      '',
      '— submitted via emfines-site custom design enquiry form',
    ];
    return lines.join('\n');
  }
  return [
    `Name: ${q.name}`,
    `Email: ${q.email}`,
    `Subject: ${q.subject}`,
    '',
    'Message:',
    q.message,
    '',
    '— submitted via emfines-site contact form',
  ].join('\n');
}
