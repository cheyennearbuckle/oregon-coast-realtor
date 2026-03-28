/* ========================================
   Cheyenne Sells Oregon — App Router & Interactions
   ======================================== */

(function() {
  const root = document.documentElement;

  // ── Dark Mode Toggle ──
  const themeBtn = document.querySelector('[data-theme-toggle]');
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);
  updateThemeIcon();

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      updateThemeIcon();
    });
  }

  function updateThemeIcon() {
    if (!themeBtn) return;
    themeBtn.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
    themeBtn.innerHTML = theme === 'dark'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  // ── Mobile Nav Toggle ──
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      mainNav.classList.toggle('open');
      const isOpen = mainNav.classList.contains('open');
      navToggle.setAttribute('aria-expanded', isOpen);
      navToggle.innerHTML = isOpen
        ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
        : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>';
    });
  }

  // ── Header scroll effect ──
  const header = document.querySelector('.site-header');
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    if (header) {
      header.classList.toggle('site-header--scrolled', window.scrollY > 20);
    }
  }, { passive: true });

  // ── Hash Router ──
  const pages = document.querySelectorAll('.page');
  const navLinks = document.querySelectorAll('.main-nav a[href^="#"]');

  function navigate() {
    const hash = location.hash || '#home';
    pages.forEach(p => {
      p.style.display = p.id === hash.slice(1) ? '' : 'none';
    });
    navLinks.forEach(l => {
      l.classList.toggle('active', l.getAttribute('href') === hash);
    });
    // Close mobile nav
    if (mainNav) mainNav.classList.remove('open');
    if (navToggle) {
      navToggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>';
    }
    // Scroll to top
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', navigate);
  navigate();

  // ── Form Submissions ──
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form.dataset.endpoint) return;
    e.preventDefault();

    const data = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    try {
      const res = await fetch(form.dataset.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();

      // Show success
      const successEl = form.querySelector('.form-success');
      if (successEl) {
        form.querySelectorAll('.form-grid, .form-group, button[type="submit"], p').forEach(el => el.style.display = 'none');
        successEl.style.display = 'block';
        successEl.textContent = result.message || 'Thank you! We\'ll be in touch.';
      } else {
        btn.textContent = 'Sent!';
        setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 3000);
      }
      form.reset();
    } catch (err) {
      btn.textContent = 'Error — Try Again';
      btn.disabled = false;
      setTimeout(() => { btn.textContent = origText; }, 3000);
    }
  });

  // ── Smooth in-page scroll for anchor links ──
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute('href');
    // Skip navigation links (single hash = page nav)
    if (href.length <= 1 || !href.includes('-')) return;
  });

})();
