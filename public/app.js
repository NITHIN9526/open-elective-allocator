/* Open Elective Portal — Client-side interactivity */
document.addEventListener('DOMContentLoaded', () => {

  /* --- Mobile sidebar toggle --- */
  const toggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay?.classList.toggle('visible');
    });
    overlay?.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    });
  }

  /* --- Animated stat counters --- */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        if (isNaN(target) || el.dataset.animated) return;
        el.dataset.animated = '1';
        let current = 0;
        const duration = 600;
        const steps = Math.max(20, Math.ceil(duration / 16));
        const increment = target / steps;
        let frame = 0;
        const tick = () => {
          frame++;
          current = frame >= steps ? target : Math.round(increment * frame);
          el.textContent = current;
          if (frame < steps) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        observer.unobserve(el);
      });
    }, { threshold: 0.3 });
    counters.forEach(el => observer.observe(el));
  }

  /* --- Table search / filter --- */
  document.querySelectorAll('[data-search-target]').forEach(input => {
    const tableId = input.dataset.searchTarget;
    const table = document.getElementById(tableId);
    if (!table) return;
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      table.querySelectorAll('tbody tr').forEach(row => {
        row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  });

  /* --- Course card selection highlight --- */
  document.querySelectorAll('.course-rank-select select').forEach(sel => {
    const card = sel.closest('.course-card');
    if (!card) return;
    const update = () => {
      card.classList.toggle('selected', sel.value !== '');
    };
    sel.addEventListener('change', update);
    update();
  });

  /* --- Auto-dismiss alerts after 5s --- */
  document.querySelectorAll('.alert.success').forEach(el => {
    setTimeout(() => {
      el.style.transition = 'opacity .4s ease, max-height .4s ease';
      el.style.opacity = '0';
      el.style.maxHeight = '0';
      el.style.overflow = 'hidden';
      el.style.padding = '0';
      el.style.margin = '0';
    }, 5000);
  });

});
