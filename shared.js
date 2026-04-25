// 密碼保護：每頁載入時檢查，未登入跳到 gate.html
(function() {
  const page = location.pathname.split('/').pop() || 'index.html';
  if (page !== 'gate.html' && localStorage.getItem('ti_auth') !== 'ok') {
    location.replace('gate.html');
  }
})();

// Scroll fade-up
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.fade-up').forEach(el => io.observe(el));

// Active nav
const page = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach(a => {
  if (a.getAttribute('href') === page) a.classList.add('active');
});

// Subscribe
function subscribe(btn) {
  const input = btn.previousElementSibling;
  if (!input || !input.value.includes('@')) return;
  input.value = '';
  const orig = btn.textContent;
  btn.textContent = '已訂閱 ✓';
  btn.style.background = '#294f3e';
  setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 3000);
}


// ── 手機版漢堡選單 ──
(function() {
  function setupMobileNav() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    const navLinks = nav.querySelector('.nav-links');
    if (!navLinks) return;

    // 動態插入漢堡按鈕
    const toggle = document.createElement('button');
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-label', '選單');
    toggle.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(toggle);

    // 動態插入遮罩
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    document.body.appendChild(overlay);

    function openMenu() {
      navLinks.classList.add('open');
      toggle.classList.add('open');
      overlay.classList.add('show');
      requestAnimationFrame(() => overlay.classList.add('open'));
      document.body.style.overflow = 'hidden';
    }
    function closeMenu() {
      navLinks.classList.remove('open');
      toggle.classList.remove('open');
      overlay.classList.remove('open');
      setTimeout(() => overlay.classList.remove('show'), 300);
      document.body.style.overflow = '';
    }

    toggle.addEventListener('click', () => {
      if (navLinks.classList.contains('open')) closeMenu();
      else openMenu();
    });

    overlay.addEventListener('click', closeMenu);

    // 點擊任一連結後自動關閉
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', closeMenu);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMobileNav);
  } else {
    setupMobileNav();
  }
})();
