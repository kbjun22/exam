/**
 * 2026 청소년상담사 1급 CBT - 메인 컨트롤러 & 라우터 (App Controller)
 */
const App = {
  currentView: 'home',

  init() {
    this.initTheme();
    this.initFontSize();
    this.initKeyboardShortcuts();
    this.renderHomeStats();
    this.checkResumeSession();
    this.showView('home');
  },

  /**
   * 화면 뷰 전환
   */
  showView(viewName) {
    this.currentView = viewName;

    // Toggle active section
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const target = document.getElementById(`view_${viewName}`);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    // Header visibility adjustments
    const header = document.getElementById('appHeader');
    const examHeader = document.getElementById('examHeaderBar');
    const bottomNav = document.getElementById('bottomNavBar');

    if (viewName === 'exam') {
      header.style.display = 'none';
      examHeader.style.display = 'flex';
      bottomNav.style.display = 'flex';
    } else {
      header.style.display = 'flex';
      examHeader.style.display = 'none';
      bottomNav.style.display = 'none';
    }

    // View specific hooks
    if (viewName === 'home') {
      this.renderHomeStats();
    } else if (viewName === 'wrong-notes') {
      WrongNotesManager.renderView();
    } else if (viewName === 'history') {
      this.renderHistoryView();
    }
  },

  /**
   * 홈 통계 업데이트
   */
  renderHomeStats() {
    const wrongDb = StorageManager.getWrongNotes();
    const wrongCount = Object.keys(wrongDb).filter(id => !wrongDb[id].mastered).length;
    const bookmarks = StorageManager.getBookmarks().length;
    const history = StorageManager.getHistory();

    const wrongBadge = document.getElementById('homeWrongCountBadge');
    if (wrongBadge) wrongBadge.textContent = `${wrongCount}문항`;

    const bookmarkBadge = document.getElementById('homeBookmarkBadge');
    if (bookmarkBadge) bookmarkBadge.textContent = `${bookmarks}문항`;

    const historyCountEl = document.getElementById('homeHistoryCount');
    if (historyCountEl) historyCountEl.textContent = `${history.length}회`;
  },

  /**
   * 이전 응시 이력 렌더링
   */
  renderHistoryView() {
    const listEl = document.getElementById('historyListContainer');
    if (!listEl) return;

    const history = StorageManager.getHistory();
    if (history.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">응시 기록이 없습니다.</div>';
      return;
    }

    listEl.innerHTML = '';
    history.forEach(item => {
      const dateStr = new Date(item.date).toLocaleString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const card = document.createElement('div');
      card.className = 'card';
      card.style.marginBottom = '12px';
      card.style.padding = '14px 18px';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:700; font-size:0.95rem;">${item.title}</span>
          <span class="badge ${item.isPassed ? 'badge-success' : 'badge-danger'}">
            ${item.isPassed ? '합격' : (item.hasDisqualification ? '과락' : '불합격')}
          </span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; color:var(--text-muted);">
          <span>${dateStr}</span>
          <span style="font-weight:800; font-size:1.1rem; color:var(--primary);">${item.averageScore}점</span>
        </div>
      `;
      listEl.appendChild(card);
    });
  },

  /**
   * 테마 초기화 및 전환
   */
  initTheme() {
    const saved = StorageManager.getTheme();
    document.documentElement.setAttribute('data-theme', saved);
    this.updateThemeButton(saved);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    StorageManager.setTheme(next);
    this.updateThemeButton(next);
    this.showToast(next === 'dark' ? '🌙 다크 모드로 변경되었습니다.' : '☀️ 라이트 모드로 변경되었습니다.');
  },

  updateThemeButton(theme) {
    const btn = document.getElementById('btnToggleTheme');
    if (btn) btn.innerHTML = (theme === 'dark') ? '☀️' : '🌙';
  },

  /**
   * 폰트 크기 조절 (A- / A / A+)
   */
  initFontSize() {
    const saved = StorageManager.getFontSize();
    document.body.className = `font-${saved}`;
  },

  cycleFontSize() {
    const current = StorageManager.getFontSize();
    let next = 'md';
    if (current === 'md') next = 'lg';
    else if (current === 'lg') next = 'sm';
    else if (current === 'sm') next = 'md';

    document.body.className = `font-${next}`;
    StorageManager.setFontSize(next);

    const labels = { sm: '작게 (A-)', md: '보통 (A)', lg: '크게 (A+)' };
    this.showToast(`글자 크기: ${labels[next]}`);
  },

  /**
   * 직전 시험 이어 풀기 체크
   */
  checkResumeSession() {
    const active = StorageManager.getActiveSession();
    if (active && active.questions && active.questions.length > 0) {
      setTimeout(() => {
        if (confirm(`진행 중이던 '${active.title}' 시험이 있습니다.\n이어서 계속 푸시겠습니까?`)) {
          ExamEngine.state = active;
          if (active.timerSeconds > 0) {
            ExamEngine.startTimer();
          }
          ExamEngine.renderCurrentQuestion();
          ExamEngine.renderOMR();
          this.showView('exam');
        } else {
          StorageManager.clearActiveSession();
        }
      }, 300);
    }
  },

  /**
   * 키보드 단축키
   */
  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (this.currentView !== 'exam') return;

      // Number keys 1~5
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        ExamEngine.selectOption(parseInt(e.key));
      } else if (e.key === 'ArrowLeft') {
        ExamEngine.prevQuestion();
      } else if (e.key === 'ArrowRight') {
        ExamEngine.nextQuestion();
      } else if (e.key.toLowerCase() === 'b') {
        ExamEngine.toggleBookmark();
      } else if (e.key.toLowerCase() === 'o') {
        const overlay = document.getElementById('omrDrawerOverlay');
        if (overlay.classList.contains('active')) {
          ExamEngine.closeOMR();
        } else {
          ExamEngine.openOMR();
        }
      } else if (e.key === 'Escape') {
        ExamEngine.closeOMR();
      }
    });
  },

  /**
   * 토스트 알림
   */
  showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2400);
  }
};

// Start App when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
