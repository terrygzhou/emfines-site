// Contact form behaviour (spec §5 /contact) — same /api/enquiries endpoint
// with kind:'contact'; the server re-validates every rule.

export function initContactForm(siteEmail: string): void {
  const form = document.getElementById('contact-form') as HTMLFormElement | null;
  const status = document.getElementById('c-status') as HTMLParagraphElement | null;
  let inFlight = false;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form || inFlight || !status) return;
    inFlight = true;
    const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    status.classList.add('hidden');
    const fd = new FormData(form);
    const payload = {
      kind: 'contact',
      name: String(fd.get('name') ?? '').trim(),
      email: String(fd.get('email') ?? '').trim(),
      subject: String(fd.get('subject') ?? ''),
      message: String(fd.get('message') ?? '').trim(),
    };
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      form.reset();
      status.textContent = `Thanks, ${payload.name.split(' ')[0]} — your message is in. We'll reply within 2 business days.`;
      status.className = 'text-sm text-muted';
    } catch {
      status.textContent = `Something went wrong — please email us directly at ${siteEmail}.`;
      status.className = 'text-sm text-red-700';
    } finally {
      inFlight = false;
      btn.disabled = false;
      btn.textContent = 'Send message';
    }
  });
}
