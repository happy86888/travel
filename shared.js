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


// ── 資料備份 / 還原系統 ──
window.BKBackup = (function() {
  // 所有需要備份的 localStorage keys
  const KEYS = [
    'bk_savings2',    // 目標：存款金額
    'bk_ms2',         // 目標：里程碑
    'bk_ctry2',       // 目標：走訪國家
    'bk_holdings',    // 持股清單
    'ti_auth',        // 登入狀態（不備份這個，避免衝突）
  ];
  const EXPORT_KEYS = KEYS.filter(k => k !== 'ti_auth');

  function exportData() {
    const data = { _meta: { version: 1, exportedAt: new Date().toISOString(), site: 'vip.briankill.com' }, data: {} };
    EXPORT_KEYS.forEach(k => {
      const v = localStorage.getItem(k);
      if (v !== null) data.data[k] = v;
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `bk-travel-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return Object.keys(data.data).length;
  }

  function importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (!parsed.data) throw new Error('檔案格式不正確');
          let count = 0;
          Object.keys(parsed.data).forEach(k => {
            if (EXPORT_KEYS.includes(k)) {
              localStorage.setItem(k, parsed.data[k]);
              count++;
            }
          });
          resolve(count);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('讀取檔案失敗'));
      reader.readAsText(file);
    });
  }

  function clearData() {
    EXPORT_KEYS.forEach(k => localStorage.removeItem(k));
  }

  // 在右下角插入懸浮備份按鈕
  function injectBackupButton() {
    if (document.getElementById('bk-backup-fab')) return;
    if (window.location.pathname.endsWith('/gate.html') || window.location.pathname === '/gate.html') return;

    const style = document.createElement('style');
    style.textContent = `
      #bk-backup-fab{position:fixed;bottom:24px;right:24px;width:48px;height:48px;border-radius:50%;background:var(--ink);color:var(--white);border:none;cursor:pointer;z-index:50;box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;font-size:20px;transition:all .25s}
      #bk-backup-fab:hover{background:var(--accent);transform:scale(1.08)}
      #bk-backup-modal{position:fixed;inset:0;background:rgba(20,18,16,.5);backdrop-filter:blur(4px);z-index:200;display:none;align-items:center;justify-content:center;padding:20px}
      #bk-backup-modal.show{display:flex}
      #bk-backup-modal .modal-card{background:var(--white);border-radius:8px;padding:32px;max-width:440px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.2)}
      #bk-backup-modal .modal-title{font-family:var(--font-display);font-size:24px;margin-bottom:8px;color:var(--ink);font-style:italic}
      #bk-backup-modal .modal-title em{color:var(--accent)}
      #bk-backup-modal .modal-desc{font-size:13px;color:var(--ink-60);margin-bottom:24px;line-height:1.7}
      #bk-backup-modal .modal-btn{display:flex;align-items:center;gap:12px;width:100%;padding:14px 18px;border:1px solid var(--border-md);border-radius:6px;background:var(--white);cursor:pointer;text-align:left;margin-bottom:10px;transition:all .2s;font-family:inherit}
      #bk-backup-modal .modal-btn:hover{border-color:var(--accent);background:var(--warm)}
      #bk-backup-modal .modal-btn .btn-icon{font-size:24px;flex-shrink:0}
      #bk-backup-modal .modal-btn .btn-info{flex:1}
      #bk-backup-modal .modal-btn .btn-name{font-size:14px;font-weight:500;color:var(--ink);margin-bottom:2px}
      #bk-backup-modal .modal-btn .btn-sub{font-size:11px;color:var(--ink-30)}
      #bk-backup-modal .modal-close{display:block;margin:16px auto 0;background:none;border:none;color:var(--ink-30);font-size:13px;cursor:pointer;padding:4px 12px}
      #bk-backup-modal .modal-close:hover{color:var(--ink)}
      #bk-backup-status{margin-top:12px;padding:10px 14px;font-size:12px;border-radius:4px;display:none}
      #bk-backup-status.show{display:block}
      #bk-backup-status.ok{background:rgba(41,79,62,.1);color:var(--forest)}
      #bk-backup-status.err{background:rgba(196,84,71,.1);color:#a03b2e}
      @media(max-width:680px){#bk-backup-fab{bottom:16px;right:16px;width:44px;height:44px}}
    `;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.id = 'bk-backup-fab';
    fab.title = '資料備份 / 還原';
    fab.setAttribute('aria-label', '資料備份');
    fab.innerHTML = '⛁';
    document.body.appendChild(fab);

    const modal = document.createElement('div');
    modal.id = 'bk-backup-modal';
    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <h3 class="modal-title">資料 <em>備份 & 還原</em></h3>
        <p class="modal-desc">把你的持股、目標、走訪國家等紀錄打包成一個檔案，方便在另一台電腦匯入或長期保存。</p>
        <button class="modal-btn" id="bk-export-btn">
          <span class="btn-icon">📥</span>
          <span class="btn-info">
            <div class="btn-name">匯出資料</div>
            <div class="btn-sub">下載 JSON 備份檔到這台電腦</div>
          </span>
        </button>
        <button class="modal-btn" id="bk-import-btn">
          <span class="btn-icon">📤</span>
          <span class="btn-info">
            <div class="btn-name">匯入資料</div>
            <div class="btn-sub">從備份檔還原（會覆蓋現有資料）</div>
          </span>
        </button>
        <input type="file" id="bk-import-file" accept=".json,application/json" style="display:none"/>
        <div id="bk-backup-status"></div>
        <button class="modal-close" id="bk-modal-close">關閉</button>
      </div>
    `;
    document.body.appendChild(modal);

    function showStatus(msg, ok) {
      const s = document.getElementById('bk-backup-status');
      s.textContent = msg;
      s.className = 'show ' + (ok ? 'ok' : 'err');
      setTimeout(() => { s.className = ''; }, 4000);
    }

    fab.addEventListener('click', () => modal.classList.add('show'));
    modal.addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('bk-modal-close').addEventListener('click', () => modal.classList.remove('show'));

    document.getElementById('bk-export-btn').addEventListener('click', () => {
      try {
        const n = exportData();
        showStatus('✓ 已下載 ' + n + ' 項資料的備份檔', true);
      } catch (e) { showStatus('✗ 匯出失敗：' + e.message, false); }
    });

    document.getElementById('bk-import-btn').addEventListener('click', () => {
      document.getElementById('bk-import-file').click();
    });

    document.getElementById('bk-import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('匯入會覆蓋目前的紀錄，確定繼續嗎？')) {
        e.target.value = '';
        return;
      }
      try {
        const n = await importData(file);
        showStatus('✓ 已成功還原 ' + n + ' 項資料，重新整理頁面後生效', true);
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        showStatus('✗ 匯入失敗：' + err.message, false);
      }
      e.target.value = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBackupButton);
  } else {
    injectBackupButton();
  }

  return { exportData, importData, clearData };
})();
