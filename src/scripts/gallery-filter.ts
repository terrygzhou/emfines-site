// EMF-6 / add-asset-gallery — client-side category filter for /gallery.
//
// Hides/shows the server-rendered sections only (constitution IV: the
// server-rendered HTML is the source of truth — no client-side data). With
// JavaScript disabled the full gallery remains visible (constitution V).

const ACTIVE_CLASSES = ['border-ink', 'text-ink'] as const;

export function initGalleryFilter(): void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-gallery-filter]'));
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-gallery-section]'));
  if (buttons.length === 0) return;

  const apply = (category: string): void => {
    for (const section of sections) {
      const show = category === 'all' || section.dataset.gallerySection === category;
      section.classList.toggle('hidden', !show);
    }
    for (const btn of buttons) {
      const active = (btn.dataset.galleryFilter ?? 'all') === category;
      btn.setAttribute('aria-pressed', String(active));
      for (const cls of ACTIVE_CLASSES) btn.classList.toggle(cls, active);
    }
  };

  for (const btn of buttons) {
    btn.addEventListener('click', () => apply(btn.dataset.galleryFilter ?? 'all'));
  }
  apply('all'); // initial state (matches the server-rendered default)
}
