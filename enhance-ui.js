/* enhance-ui.js
   Reusable UI enhancements for Unfold Earth.
   Safely no-ops if expected elements are not present on the page.
*/

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReducedMotion = () =>
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  // 1) Smooth scrolling (JS-driven for consistency across pages)
  function enableSmoothScrolling() {
    if (prefersReducedMotion()) return;

    // If the document already sets scroll-behavior in CSS, this is harmless.
    document.addEventListener(
      'click',
      (e) => {
        const a = e.target && e.target.closest && e.target.closest('a[href^="#"]');
        if (!a) return;

        const href = a.getAttribute('href') || '';
        if (!href || href === '#') return;
        const id = href.slice(1);
        const target = document.getElementById(id);
        if (!target) return;

        e.preventDefault();

        // Account for sticky nav height if present.
        const nav = document.querySelector('nav');
        const navH = nav && nav.getBoundingClientRect ? nav.getBoundingClientRect().height : 0;

        const top = target.getBoundingClientRect().top + window.pageYOffset - navH - 12;
        window.scrollTo({ top, behavior: 'smooth' });
      },
      { passive: false }
    );
  }

  // 2) Loading overlay (only if a #loader exists)
  function enableLoader() {
    const loader = $('#loader');
    if (!loader) return;

    const done = () => {
      loader.style.transition = 'opacity 300ms ease';
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.style.display = 'none';
      }, 320);
    };

    if (document.readyState === 'complete') done();
    else window.addEventListener('load', done, { once: true });
  }

  // 3) IntersectionObserver reveal helper
  function enableReveal() {
    if (prefersReducedMotion()) {
      // Ensure elements are visible if user prefers reduced motion.
      $$('.reveal, [data-reveal], .reveal-on-scroll').forEach((el) => {
        el.classList.add('is-revealed');
      });
      return;
    }

    const candidates = $$('.reveal, [data-reveal], .reveal-on-scroll, .reveal-card');
    if (!candidates.length) return;

    // Add baseline styles if not already defined.
    // Uses classes only; does not depend on existing CSS layout.
    const styleId = 'enhance-ui-reveal-style';
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = `
        .reveal, [data-reveal], .reveal-on-scroll, .reveal-card {
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 650ms ease, transform 650ms ease;
          will-change: opacity, transform;
        }
        .reveal.is-revealed,
        .reveal-on-scroll.is-revealed,
        .reveal-card.is-revealed,
        [data-reveal].is-revealed {
          opacity: 1;
          transform: translateY(0);
        }
      `;
      document.head.appendChild(st);
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add('is-revealed');
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' }
    );

    candidates.forEach((el) => io.observe(el));
  }

  // 4) Counter animations (supports [data-counter] or .counter with data-target)
  function enableCounters() {
    if (prefersReducedMotion()) return;

    // Only animate elements that explicitly declare a numeric target.
    // This avoids touching non-counter numbers like "1.2M+" unless data-target exists.
    const counters = $$('.counter[data-target], [data-counter], [data-target].counter');
    if (!counters.length) return;

    // normalize targets
    const getTarget = (el) => {
      if (el.getAttribute('data-target')) return Number(el.getAttribute('data-target'));
      if (el.getAttribute('data-counter')) return Number(el.getAttribute('data-counter'));
      if (el.dataset && el.dataset.target) return Number(el.dataset.target);
      return NaN;
    };

    const styleId = 'enhance-ui-counter-style';
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = `.counter{ will-change: contents; }`;
      document.head.appendChild(st);
    }

    const format = (value, el) => {
      // Preserve trailing plus/other suffix from initial text when present.
      const raw = (el.textContent || '').trim();
      const m = raw.match(/^([\d,.]+)\s*(.*)$/);
      const suffix = m && m[2] ? m[2] : '';
      return `${Math.floor(value).toLocaleString()}${suffix}`;
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = getTarget(el);
          if (!Number.isFinite(target)) return;

          const duration = 1100;
          const start = performance.now();
          const from = 0;

          let raf;
          const tick = (now) => {
            const t = clamp((now - start) / duration, 0, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            const value = from + (target - from) * eased;
            el.textContent = format(value, el);
            if (t < 1) raf = requestAnimationFrame(tick);
          };

          raf = requestAnimationFrame(tick);
          io.unobserve(el);
        });
      },
      { threshold: 0.35, rootMargin: '0px 0px -10% 0px' }
    );

    counters.forEach((el) => {
      // mark only if target exists
      const target = getTarget(el);
      if (!Number.isFinite(target)) return;
      if (!el.dataset.enhanceCounter) {
        el.dataset.enhanceCounter = '1';
        el.textContent = '0';
      }
      io.observe(el);
    });
  }

  // 5) Typing effect (only if element exists with data-typing and optional data-words)
  function enableTyping() {
    const el = $('[data-typing]');
    if (!el) return;

    if (prefersReducedMotion()) {
      el.textContent = el.getAttribute('data-typing') || '';
      return;
    }

    const wordsAttr = el.getAttribute('data-typing') || '';
    const words = wordsAttr.split('|').map((s) => s.trim()).filter(Boolean);

    // If no pipe-separated words, just print once.
    if (!words.length) return;
    if (words.length === 1) {
      el.textContent = words[0];
      return;
    }

    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const typingSpeed = Number(el.getAttribute('data-typing-speed') || 70);
    const deletingSpeed = Number(el.getAttribute('data-typing-delete-speed') || 40);
    const holdMs = Number(el.getAttribute('data-typing-hold') || 1200);

    const loop = () => {
      const word = words[wordIndex] || '';

      if (!deleting) {
        charIndex++;
        el.textContent = word.slice(0, charIndex);
        if (charIndex >= word.length) {
          deleting = true;
          setTimeout(loop, holdMs);
          return;
        }
        setTimeout(loop, typingSpeed);
        return;
      }

      // deleting
      charIndex--;
      el.textContent = word.slice(0, charIndex);
      if (charIndex <= 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        setTimeout(loop, 240);
        return;
      }
      setTimeout(loop, deletingSpeed);
    };

    // Start with first word typed.
    el.textContent = '';
    setTimeout(loop, 250);
  }

  // 6) Dark/Light mode toggle (only when a toggle button exists)
  function enableThemeToggle() {
    const btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;

    const body = document.body;
    const key = 'ue_theme';
    const apply = (mode) => {
      const isLight = mode === 'light';
      body.classList.toggle('light', isLight);
      body.classList.toggle('light-mode', isLight);
      btn.setAttribute('aria-pressed', String(isLight));

      const icon = isLight ? '☀️' : '🌙';
      btn.textContent = icon;
    };

    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') apply(saved);
    else apply(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

    btn.addEventListener('click', () => {
      const next = body.classList.contains('light') ? 'dark' : 'light';
      localStorage.setItem(key, next);
      apply(next);
    });
  }

  // 7) Page-specific hover/interactive cards (safe selectors)
  function enableCardInteractions() {
    // Destination/type/testimonial cards on familyadventures.html
    const cards = $$('.destination-card, .type-card, .tip-card, .why-card, .testimonial');
    if (!cards.length) return;

    // Add subtle keyboard/focus feel without changing layout.
    cards.forEach((card) => {
      card.setAttribute('tabindex', card.getAttribute('tabindex') || '0');
      card.addEventListener('pointerenter', () => card.classList.add('ue-hover'));
      card.addEventListener('pointerleave', () => card.classList.remove('ue-hover'));
      card.addEventListener('focus', () => card.classList.add('ue-focus'));
      card.addEventListener('blur', () => card.classList.remove('ue-focus'));
    });

    const styleId = 'enhance-ui-card-interactions';
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = `
        .destination-card.ue-hover,
        .type-card.ue-hover,
        .tip-card.ue-hover,
        .why-card.ue-hover,
        .testimonial.ue-hover {
          transform: translateY(-8px) !important;
        }
        .destination-card.ue-focus,
        .type-card.ue-focus,
        .tip-card.ue-focus,
        .why-card.ue-focus,
        .testimonial.ue-focus {
          outline: 3px solid rgba(255,107,0,0.35);
          outline-offset: 4px;
        }
      `;
      document.head.appendChild(st);
    }
  }

  // 8) Modern button effects (only on existing CTA/form buttons)
  function enableButtonEffects() {
    const buttons = $$('.cta-button, .form-button');
    if (!buttons.length) return;

    // Add base CSS once.
    const styleId = 'enhance-ui-button-effects';
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = `
        .cta-button, .form-button {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          transition: transform 180ms ease, box-shadow 240ms ease, background 240ms ease;
        }
        .cta-button::after, .form-button::after {
          content: '';
          position: absolute;
          inset: -40px;
          background: radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(255,255,255,0.35), transparent 45%);
          opacity: 0;
          transform: scale(0.85);
          transition: opacity 200ms ease, transform 240ms ease;
          z-index: -1;
        }
        .cta-button:hover, .form-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.12);
        }
        .cta-button:hover::after, .form-button:hover::after {
          opacity: 1;
          transform: scale(1);
        }
        .cta-button:active, .form-button:active {
          transform: translateY(0px) scale(0.99);
        }
      `;
      document.head.appendChild(st);
    }

    buttons.forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        btn.style.setProperty('--x', `${x}%`);
        btn.style.setProperty('--y', `${y}%`);
      });
    });
  }

  // 9) Safe reveal for familyadventures specific sections without touching existing structure.
  function enableFamilyAdventureSpecificReveal() {
    const pageIsFamily = /familyadventures\.html$/i.test(window.location.pathname);
    if (!pageIsFamily) return;

    const sections = [
      'header .hero-content',
      'section > h2',
      'section > p',
      '.destination-card',
      '.type-card',
      '.tip-card',
      '.why-card',
      '.testimonial',
      '#planform',
      '#planform .form-button'
    ];

    sections.forEach((sel) => {
      $$(sel).forEach((el) => {
        // Only mark if not already revealed/hidden
        if (!el.classList.contains('reveal') && !el.hasAttribute('data-reveal')) {
          el.classList.add('reveal');
        }
        // counters shouldn't be forced to reveal with translateY; but it's fine.
      });
    });

    enableReveal();
  }

  // Initialize
  enableSmoothScrolling();
  enableLoader();
  enableTyping();
  enableThemeToggle();
  enableCardInteractions();
  enableButtonEffects();
  enableCounters();
  enableFamilyAdventureSpecificReveal();
})();

