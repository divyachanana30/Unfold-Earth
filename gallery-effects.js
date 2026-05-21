// Lightweight, dependency-free effects for imagegallery.html
// Adds: scroll-reveal, parallax tilt, modal preview, and keyboard navigation.

(() => {
  const init = () => {
    const cells = Array.from(document.querySelectorAll('.cell'));
    if (!cells.length) return;

    // ------- Scroll reveal
    if ('IntersectionObserver' in window) {
      const revealObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('cg-show');
              revealObs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.12 }
      );
      cells.forEach((c) => {
        c.classList.add('cg-reveal');
        revealObs.observe(c);
      });
    } else {
      cells.forEach((c) => c.classList.add('cg-show'));
    }

    // ------- Parallax tilt on hover
    cells.forEach((cell) => {
      const img = cell.querySelector('img');
      if (!img) return;

      cell.addEventListener('mousemove', (ev) => {
        const r = cell.getBoundingClientRect();
        const x = (ev.clientX - r.left) / r.width; // 0..1
        const y = (ev.clientY - r.top) / r.height; // 0..1
        const rotY = (x - 0.5) * 10; // -5..5
        const rotX = -(y - 0.5) * 10;

        cell.style.transform = `translateY(-8px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
        img.style.transform = 'scale(1.22)';
      });

      cell.addEventListener('mouseleave', () => {
        cell.style.transform = '';
        img.style.transform = '';
      });
    });

    // ------- Modal preview
    const modal = document.createElement('div');
    modal.id = 'cg-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="cg-modal-backdrop" data-close></div>
      <div class="cg-modal-panel" role="document">
        <button class="cg-modal-close" aria-label="Close">&times;</button>
        <img class="cg-modal-img" alt="" />
        <div class="cg-modal-caption"></div>
        <div class="cg-modal-hint">Use  /  or Esc to close</div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.cg-modal-close');
    const caption = modal.querySelector('.cg-modal-caption');
    const modalImg = modal.querySelector('.cg-modal-img');

    const openModal = (cell) => {
      const img = cell.querySelector('img');
      const title = cell.querySelector('h3');
      if (!img) return;

      modalImg.src = img.getAttribute('src') || '';
      modalImg.alt = title ? title.textContent.trim() : 'Preview';
      caption.textContent = title ? title.textContent.trim() : '';

      modal.style.display = 'block';
      // small delay for transition
      requestAnimationFrame(() => modal.classList.add('cg-open'));

      closeBtn.focus();
    };

    const closeModal = () => {
      modal.classList.remove('cg-open');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 180);
    };

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('cg-open')) {
        closeModal();
      }
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target && e.target.getAttribute('data-close') !== null) closeModal();
    });

    cells.forEach((cell, idx) => {
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', (cell.querySelector('h3')?.textContent || 'Open preview').trim());

      cell.addEventListener('click', () => openModal(cell));

      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal(cell);
        }
      });

      // Optional: small parallax on focus
      cell.addEventListener('focus', () => cell.classList.add('cg-focus'));
      cell.addEventListener('blur', () => cell.classList.remove('cg-focus'));
    });

    // ------- Inject CSS for effects
    const style = document.createElement('style');
    style.textContent = `
      /* Scroll reveal */
      .cell.cg-reveal{ opacity:0; transform: translateY(16px); transition: opacity .6s ease, transform .6s ease, box-shadow .3s ease; }
      .cell.cg-show{ opacity:1; transform: translateY(0); }

      /* Modal */
      #cg-modal{
        position: fixed;
        inset: 0;
        z-index: 99999;
        font-family: Arial, sans-serif;
      }
      #cg-modal .cg-modal-backdrop{
        position:absolute;
        inset:0;
        background: rgba(0,0,0,0.65);
        backdrop-filter: blur(6px);
        animation: cgFade .18s ease;
      }
      #cg-modal .cg-modal-panel{
        position: relative;
        margin: 7vh auto 0;
        width: min(920px, 92vw);
        background: rgba(10,15,20,0.92);
        border: 1px solid rgba(0,255,213,0.18);
        border-radius: 18px;
        box-shadow: 0 20px 70px rgba(0,0,0,0.6);
        padding: 18px;
        transform: translateY(10px) scale(0.98);
        opacity: 0;
        transition: transform .18s ease, opacity .18s ease;
      }
      #cg-modal.cg-open .cg-modal-panel{
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      .cg-modal-close{
        position:absolute;
        top: 10px;
        right: 14px;
        width: 44px;
        height: 44px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.06);
        color: #fff;
        font-size: 30px;
        line-height: 40px;
        cursor:pointer;
      }
      .cg-modal-img{
        width: 100%;
        max-height: 62vh;
        object-fit: contain;
        border-radius: 14px;
        display:block;
        background: rgba(255,255,255,0.03);
      }
      .cg-modal-caption{
        margin-top: 12px;
        text-align: center;
        color: #00ffd5;
        font-weight: 800;
        font-size: 1.2rem;
      }
      .cg-modal-hint{
        margin-top: 10px;
        text-align: center;
        color: rgba(255,255,255,0.65);
        font-size: .9rem;
      }
      @keyframes cgFade{ from{ opacity:0 } to{ opacity:1 } }

      /* Slight focus ring */
      .cell.cg-focus{ outline: 2px solid rgba(0,255,213,0.5); outline-offset: 3px; }

      /* Keep existing hover effect but ensure our JS overrides nicely */
      .cell:hover img{ transform: scale(1.15); }
    `;
    document.head.appendChild(style);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

