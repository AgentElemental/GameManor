/**
 * GameManor Website Main JavaScript
 * Handles global interactions: Navigation, Theme Toggle, Accordions, Tabs, FAQ Search
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initDynamicYear();
  initAccordions();
  initPreviewTabs();
  initFaqSearch();
});

/* ====================================================================
   THEME TOGGLE SYSTEM (DARK / LIGHT WITH LOCAL STORAGE PERSISTENCE)
   ==================================================================== */
function initTheme() {
  const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
  const storedTheme = localStorage.getItem('gamemanor_theme') || 'dark';

  document.documentElement.setAttribute('data-theme', storedTheme);

  themeToggleBtns.forEach(btn => {
    btn.setAttribute('aria-label', `Switch to ${storedTheme === 'dark' ? 'Light' : 'Dark'} theme`);
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('gamemanor_theme', next);
      btn.setAttribute('aria-label', `Switch to ${next === 'dark' ? 'Light' : 'Dark'} theme`);
    });
  });
}

/* ====================================================================
   GLOBAL NAVIGATION (STICKY SCROLL & MOBILE DRAWER)
   ==================================================================== */
function initNavigation() {
  const header = document.querySelector('.site-header');
  const mobileToggle = document.querySelector('.mobile-toggle-btn');
  const mobileDrawer = document.querySelector('.mobile-drawer');

  // Sticky header class toggle
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  }, { passive: true });

  // Mobile menu drawer
  if (mobileToggle && mobileDrawer) {
    const updateMenuState = (open) => {
      if (open) {
        mobileDrawer.classList.add('open');
        document.body.classList.add('menu-open');
        mobileToggle.setAttribute('aria-expanded', 'true');
        mobileToggle.setAttribute('aria-label', 'Close navigation menu');
        mobileToggle.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
      } else {
        mobileDrawer.classList.remove('open');
        document.body.classList.remove('menu-open');
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.setAttribute('aria-label', 'Open navigation menu');
        mobileToggle.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`;
      }
    };

    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileDrawer.classList.contains('open');
      updateMenuState(!isOpen);
    });

    // Close when clicking any link inside the mobile drawer
    mobileDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        updateMenuState(false);
      });
    });

    // Close mobile drawer on ESC or clicking outside
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileDrawer.classList.contains('open')) {
        updateMenuState(false);
        mobileToggle.focus();
      }
    });

    document.addEventListener('click', (e) => {
      if (mobileDrawer.classList.contains('open')) {
        if (!mobileDrawer.contains(e.target) && !mobileToggle.contains(e.target)) {
          updateMenuState(false);
        }
      }
    });

    // Close drawer when resized to desktop breakpoint
    window.addEventListener('resize', () => {
      if (window.innerWidth > 860 && mobileDrawer.classList.contains('open')) {
        updateMenuState(false);
      }
    });
  }

  // Active link detection based on path
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

/* ====================================================================
   DYNAMIC COPYRIGHT YEAR
   ==================================================================== */
function initDynamicYear() {
  const yearEls = document.querySelectorAll('.dynamic-year');
  const year = new Date().getFullYear();
  yearEls.forEach(el => { el.textContent = year; });
}

/* ====================================================================
   ACCORDION LOGIC (FOR FAQ PAGE)
   ==================================================================== */
function initAccordions() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question-btn');
    const answer = item.querySelector('.faq-answer');

    if (!btn || !answer) return;

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close all other items in same accordion if desired
      faqItems.forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          const otherBtn = other.querySelector('.faq-question-btn');
          const otherAns = other.querySelector('.faq-answer');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          if (otherAns) otherAns.style.maxHeight = null;
        }
      });

      // Toggle current
      if (isOpen) {
        item.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        answer.style.maxHeight = null;
      } else {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });
}

/* ====================================================================
   PRODUCT PREVIEWS TAB SWITCHER (FOR HOMEPAGE)
   ==================================================================== */
function initPreviewTabs() {
  const tabBtns = document.querySelectorAll('.preview-tab-btn');
  const panes = document.querySelectorAll('.preview-pane');

  if (!tabBtns.length || !panes.length) return;

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');

      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      panes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });
}

/* ====================================================================
   FAQ SEARCH & CATEGORY FILTERING
   ==================================================================== */
function initFaqSearch() {
  const searchInput = document.getElementById('faqSearchInput');
  const categoryBtns = document.querySelectorAll('.faq-category-btn');
  const items = document.querySelectorAll('.faq-item');
  const emptyState = document.getElementById('faqEmptyState');

  if (!items.length) return;

  let currentCategory = 'all';
  let searchQuery = '';

  function applyFilters() {
    let visibleCount = 0;

    items.forEach(item => {
      const question = item.querySelector('.faq-question-btn')?.textContent.toLowerCase() || '';
      const answer = item.querySelector('.faq-answer')?.textContent.toLowerCase() || '';
      const category = item.getAttribute('data-category') || '';

      const matchesCategory = (currentCategory === 'all' || category === currentCategory);
      const matchesSearch = (!searchQuery || question.includes(searchQuery) || answer.includes(searchQuery));

      if (matchesCategory && matchesSearch) {
        item.style.display = 'block';
        visibleCount++;
      } else {
        item.style.display = 'none';
      }
    });

    if (emptyState) {
      emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      applyFilters();
    });
  }

  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.getAttribute('data-category') || 'all';
      applyFilters();
    });
  });
}
