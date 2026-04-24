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
