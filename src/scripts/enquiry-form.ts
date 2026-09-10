// T1 spec §4 — custom design enquiry form behaviour.
// Client-side validation mirrors src/lib/enquiry.ts; the server re-runs
// every rule. Photos read as base64 data URLs (≤3, ≤5 MB each).
import { trackConversion } from '@/lib/analytics';

export function initDesignEnquiryForm(siteEmail: string): void {
  const form = document.getElementById('design-enquiry') as HTMLFormElement | null;
  const success = document.getElementById('enquiry-success');
  const successText = document.getElementById('enquiry-success-text');
  const failure = document.getElementById('enquiry-failure');
  if (!form || !success || !successText || !failure) return;
  const pieceSelect = document.getElementById('q-piece') as HTMLSelectElement;
  const pieceOtherWrap = document.getElementById('piece-other-wrap');
  const submitting = { value: false };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    failure.classList.add('hidden');
    if (submitting.value) return; // double-submit guard

    const fd = new FormData(form);
    const payload: Record<string, unknown> = {
      kind: 'design',
      name: String(fd.get('name') ?? '').trim(),
      email: String(fd.get('email') ?? '').trim(),
      phone: String(fd.get('phone') ?? '').trim(),
      pieceType: String(fd.get('pieceType') ?? ''),
      pieceTypeOther: String(fd.get('pieceTypeOther') ?? '').trim(),
      metals: fd.getAll('metals').map((v) => String(v)),
      gemstones: String(fd.get('gemstones') ?? '').trim(),
      budget: String(fd.get('budget') ?? ''),
      brief: String(fd.get('brief') ?? ''),
      contactPref: String(fd.get('contactPref') ?? ''),
      consent: Boolean(fd.get('consent')),
    };

    const errors = clientValidate(payload);
    clearErrors();
    if (errors.size) {
      let first: HTMLElement | null = null;
      for (const [field, msg] of errors) {
        const el = document.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
        if (!el) continue;
        el.textContent = msg;
        el.classList.remove('hidden');
        first ??= el;
      }
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // photos -> base64 data URLs
    const files = (fd.get('photos') as FileList | null)?.length
      ? Array.from(fd.getAll('photos')).filter((f): f is File => f instanceof File)
      : [];
    if (files.length > 3) {
      showFieldError('photos', 'Up to 3 photos are allowed');
      return;
    }
    payload.photos = await Promise.all(
      files.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(r.error);
            r.readAsDataURL(f);
          }),
      ),
    );

    submitting.value = true;
    const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { ok: boolean; emailDelivered: boolean };
      if (!data.ok) throw new Error('server rejected enquiry');
      // Enquiry durably stored → record the conversion for analytics (no-op-safe).
      trackConversion('design_enquiry_submitted', { kind: 'design', emailDelivered: data.emailDelivered });
      if (data.emailDelivered) {
        form.classList.add('hidden');
        successText.textContent = `Thanks, ${String(payload.name).split(' ')[0]}. Your enquiry is in — we'll reply to ${payload.email} within 2 business days.`;
        success.classList.remove('hidden');
      } else {
        // brief archived durably, email channel not configured yet — keep the form
        failure.textContent = `Something went wrong with automatic delivery — your brief is safely stored, but please also email us directly at ${siteEmail} so nothing waits.`;
        failure.classList.remove('hidden');
      }
    } catch {
      failure.textContent = `Something went wrong sending your enquiry — please email us directly at ${siteEmail}.`;
      failure.classList.remove('hidden');
    } finally {
      submitting.value = false;
      btn.disabled = false;
      btn.textContent = 'Send my enquiry';
    }
  });

  // "Other" piece type reveals the detail field
  pieceSelect?.addEventListener('change', () => {
    pieceOtherWrap?.classList.toggle('hidden', pieceSelect.value !== 'Other');
  });
}

function clientValidate(p: Record<string, unknown>): Map<string, string> {
  const errors = new Map<string, string>();
  if (String(p.name).length < 2) errors.set('name', 'Please enter your name (at least 2 characters).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email))) errors.set('email', 'Please enter a valid email address.');
  if (!p.pieceType) errors.set('pieceType', 'Please select a piece type.');
  if (p.pieceType === 'Other' && String(p.pieceTypeOther).length < 2) {
    errors.set('pieceTypeOther', 'Please describe the piece type.');
  }
  const metals = (p.metals as string[]).filter(Boolean);
  if (metals.length === 0) errors.set('metals', 'Please select at least one metal.');
  if (String(p.brief).length < 40) errors.set('brief', 'Please share at least 40 characters about the piece.');
  if (!p.contactPref) errors.set('contactPref', 'Please choose how you prefer to be contacted.');
  if (!p.consent) errors.set('consent', 'Please tick the consent box so we can reply.');
  return errors;
}

function clearErrors() {
  document.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => {
    el.classList.add('hidden');
    el.textContent = '';
  });
}

function showFieldError(field: string, msg: string) {
  const el = document.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
