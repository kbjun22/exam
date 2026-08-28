/**
 * 2026 청소년상담사 1급 CBT - 실전 시험 진행 엔진 (1화면 1문제 & OMR & 타이머)
 */
const ExamEngine = {
  state: {
    mode: 'session1',       // 'session1', 'session2', 'all', 'subject', 'retry', 'bookmarks'
    title: '',
    questions: [],
    currentIndex: 0,
    answers: {},            // { [qId]: selectedOption (1~5) }
    bookmarks: {},          // { [qId]: boolean }
    timerSeconds: 0,        // Total remaining seconds
    timerInterval: null,
    isInstantFeedback: false,
    startTime: null
  },

  /**
   * 시험 세션 시작
   */
  startExam(config) {
    this.clearInterval();

    const allQuestions = window.EXAM_QUESTIONS || [];
    let selectedQuestions = [];
    let title = '';
    let totalMinutes = 0;

    switch (config.mode) {
      case 'session1':
        selectedQuestions = allQuestions.filter(q => q.session === 1);
        title = '제1교시 실전 모의고사 (필수 3과목 75문항)';
        totalMinutes = 75;
        break;

      case 'session2':
        selectedQuestions = allQuestions.filter(q => q.session === 2);
        title = '제2교시 실전 모의고사 (전공 4과목 100문항)';
        totalMinutes = 100;
        break;

      case 'all':
        selectedQuestions = [...allQuestions];
        title = '실전 모의고사 풀세트 (전체 7과목 175문항)';
        totalMinutes = 175;
        break;

      case 'subject':
        selectedQuestions = allQuestions.filter(q => q.subject_id === config.subjectId);
        const subjName = selectedQuestions[0] ? selectedQuestions[0].subject_name : '과목';
        title = `과목별 집중 연습 - ${subjName} (25문항)`;
        totalMinutes = config.isInstantFeedback ? 0 : 30; // 0 for untimed
        break;

      case 'retry':
        // Custom question list from wrong notes
        selectedQuestions = config.questions || [];
        title = config.title || '오답노트 다시 풀기';
        totalMinutes = Math.max(10, selectedQuestions.length * 1.2);
        break;

      case 'bookmarks':
        selectedQuestions = config.questions || [];
        title = '북마크 문항 모아 풀기';
        totalMinutes = Math.max(10, selectedQuestions.length * 1.2);
        break;

      default:
        selectedQuestions = allQuestions.filter(q => q.session === 1);
        title = '제1교시 실전 모의고사';
        totalMinutes = 75;
    }

    if (selectedQuestions.length === 0) {
      App.showToast('선택된 문항이 없습니다.');
      App.showView('home');
      return;
    }

    // Load initial bookmarks from storage
    const bookmarkMap = {};
    selectedQuestions.forEach(q => {
      if (StorageManager.isBookmarked(q.id)) {
        bookmarkMap[q.id] = true;
      }
    });

    this.state = {
      mode: config.mode,
      title: title,
      questions: selectedQuestions,
      currentIndex: 0,
      answers: {},
      bookmarks: bookmarkMap,
      timerSeconds: Math.round(totalMinutes * 60),
      timerInterval: null,
      isInstantFeedback: !!config.isInstantFeedback,
      startTime: Date.now()
    };

    // Initialize Timer
    if (this.state.timerSeconds > 0) {
      this.startTimer();
    } else {
      this.updateTimerDisplay('--:--');
    }

    // Save Active Session
    this.saveSession();

    // Render Question
    this.renderCurrentQuestion();
    this.renderOMR();
    App.showView('exam');
  },

  /**
   * 타이머 가동
   */
  startTimer() {
    this.clearInterval();
    this.updateTimerDisplay();

    this.state.timerInterval = setInterval(() => {
      if (this.state.timerSeconds > 0) {
        this.state.timerSeconds -= 1;
        this.updateTimerDisplay();

        if (this.state.timerSeconds === 300) { // 5 mins left
          App.showToast('⚠️ 시험 종료 5분 전입니다!');
        }

        if (this.state.timerSeconds === 60) { // 1 min left
          App.showToast('🚨 시험 종료 1분 전입니다! 답안을 확인하세요.');
        }

        if (this.state.timerSeconds <= 0) {
          this.clearInterval();
          App.showToast('⏱️ 시험 시간이 종료되어 자동 채점됩니다.');
          this.submitExam(true);
        }
      }
    }, 1000);
  },

  clearInterval() {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
  },

  updateTimerDisplay(customText) {
    const el = document.getElementById('examTimer');
    if (!el) return;

    if (customText) {
      el.textContent = customText;
      el.classList.remove('warning');
      return;
    }

    const sec = this.state.timerSeconds;
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;

    const pad = (n) => String(n).padStart(2, '0');
    let timeStr = `${pad(mins)}:${pad(secs)}`;
    if (hrs > 0) timeStr = `${pad(hrs)}:${timeStr}`;

    el.textContent = `⏱️ ${timeStr}`;

    if (sec <= 300 && sec > 0) {
      el.classList.add('warning');
    } else {
      el.classList.remove('warning');
    }
  },

  /**
   * 1화면 1문제 렌더링 (Single Question Card)
   */
  renderCurrentQuestion() {
    const q = this.state.questions[this.state.currentIndex];
    if (!q) return;

    const totalCount = this.state.questions.length;
    const currentNum = this.state.currentIndex + 1;
    const qId = q.id;

    // Header info & Progress bar
    document.getElementById('examModeTitle').textContent = this.state.title;
    document.getElementById('examProgressText').textContent = `문항 ${currentNum} / ${totalCount}`;
    
    const percent = Math.round((currentNum / totalCount) * 100);
    document.getElementById('examProgressFill').style.width = `${percent}%`;

    // Subject badge
    document.getElementById('examSubjectBadge').textContent = `${q.subject_name} (${q.subject_q_num}/25)`;

    // Difficulty & Cognitive Tags
    const tagsContainer = document.getElementById('questionTags');
    tagsContainer.innerHTML = `
      <span class="badge badge-primary">문항 ${currentNum}</span>
      <span class="badge badge-gray">${q.domain || q.subject_name}</span>
      <span class="badge badge-accent">${q.cognitive || '분석'}</span>
      <span class="badge ${q.difficulty === '최상' ? 'badge-danger' : 'badge-warning'}">난도 ${q.difficulty || '상'}</span>
    `;

    // Bookmark button
    const bookmarkBtn = document.getElementById('btnBookmark');
    if (this.state.bookmarks[qId]) {
      bookmarkBtn.classList.add('active');
      bookmarkBtn.innerHTML = '★';
    } else {
      bookmarkBtn.classList.remove('active');
      bookmarkBtn.innerHTML = '☆';
    }

    // Question Stem (Markdown parsed with question number)
    const stemEl = document.getElementById('questionStem');
    stemEl.innerHTML = `<span style="color:var(--primary); font-weight:800; margin-right:6px;">${currentNum}.</span>` + this.parseMarkdown(q.stem);

    // Options List (원형 체크박스 / 라디오 버튼)
    const optionsContainer = document.getElementById('optionsList');
    optionsContainer.innerHTML = '';

    const selectedAnswer = this.state.answers[qId];
    const circNums = ['①', '②', '③', '④', '⑤'];

    q.options.forEach((optText, idx) => {
      const optNum = idx + 1;
      const isSelected = selectedAnswer === optNum;

      const optCard = document.createElement('div');
      optCard.className = `option-card ${isSelected ? 'selected' : ''}`;
      optCard.id = `optionCard_${optNum}`;
      optCard.onclick = () => this.selectOption(optNum);

      optCard.innerHTML = `
        <div class="option-circle">${circNums[idx]}</div>
        <div class="option-text">${this.escapeHtml(optText)}</div>
      `;

      optionsContainer.appendChild(optCard);
    });

    // Instant Feedback Box (for Practice Mode)
    const feedbackBox = document.getElementById('instantFeedbackBox');
    if (this.state.isInstantFeedback && selectedAnswer) {
      feedbackBox.classList.add('active');
      const isCorrect = selectedAnswer === q.answer;
      feedbackBox.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <span class="badge ${isCorrect ? 'badge-success' : 'badge-danger'}">
            ${isCorrect ? '✅ 정답입니다!' : '❌ 오답입니다'}
          </span>
          <span style="font-weight:700;">정답: ${circNums[q.answer - 1]}</span>
        </div>
        <div class="explanation-content" style="margin-top:8px;">
          <div class="explanation-section-title">💡 정답 해설</div>
          <p>${this.escapeHtml(q.explanation)}</p>
          ${q.distractor_exp ? `
            <div class="explanation-section-title">🔍 오답 반증</div>
            <div class="markdown-content">${this.parseMarkdown(q.distractor_exp)}</div>
          ` : ''}
        </div>
      `;

      // Highlight correct / wrong card
      const correctCard = document.getElementById(`optionCard_${q.answer}`);
      if (correctCard) correctCard.classList.add('correct-answer');
      if (!isCorrect && selectedAnswer) {
        const wrongCard = document.getElementById(`optionCard_${selectedAnswer}`);
        if (wrongCard) wrongCard.classList.add('wrong-selected');
      }
    } else {
      feedbackBox.classList.remove('active');
    }

    // Navigation buttons state
    document.getElementById('btnPrevQuestion').disabled = (this.state.currentIndex === 0);
    const nextBtn = document.getElementById('btnNextQuestion');
    if (this.state.currentIndex === totalCount - 1) {
      nextBtn.innerHTML = '🏁 제출하기';
      nextBtn.classList.remove('btn-secondary');
      nextBtn.classList.add('btn-primary');
    } else {
      nextBtn.innerHTML = '다음 ▶';
      nextBtn.classList.remove('btn-primary');
      nextBtn.classList.add('btn-secondary');
    }

    // Update Bottom OMR Counter
    const answeredCount = Object.keys(this.state.answers).length;
    document.getElementById('navOmrCounter').textContent = `${answeredCount} / ${totalCount}`;

    // Auto scroll to top of card
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update OMR highlighting
    this.updateOMRHighlight();
  },

  /**
   * 보기 선택 (원형 버튼 터치)
   */
  selectOption(optionNum) {
    const q = this.state.questions[this.state.currentIndex];
    if (!q) return;

    // Toggle or select
    this.state.answers[q.id] = optionNum;

    // Save session
    this.saveSession();

    // Re-render
    this.renderCurrentQuestion();
    this.updateOMRItem(q.id, optionNum);
  },

  /**
   * 북마크 토글
   */
  toggleBookmark() {
    const q = this.state.questions[this.state.currentIndex];
    if (!q) return;

    const isBookmarked = StorageManager.toggleBookmark(q.id);
    this.state.bookmarks[q.id] = isBookmarked;

    const btn = document.getElementById('btnBookmark');
    if (isBookmarked) {
      btn.classList.add('active');
      btn.innerHTML = '★';
      App.showToast('⭐ 북마크에 추가되었습니다.');
    } else {
      btn.classList.remove('active');
      btn.innerHTML = '☆';
      App.showToast('북마크가 해제되었습니다.');
    }

    this.updateOMRItem(q.id, this.state.answers[q.id]);
  },

  nextQuestion() {
    if (this.state.currentIndex < this.state.questions.length - 1) {
      this.state.currentIndex += 1;
      this.renderCurrentQuestion();
    } else {
      this.confirmSubmit();
    }
  },

  prevQuestion() {
    if (this.state.currentIndex > 0) {
      this.state.currentIndex -= 1;
      this.renderCurrentQuestion();
    }
  },

  jumpToQuestion(index) {
    if (index >= 0 && index < this.state.questions.length) {
      this.state.currentIndex = index;
      this.renderCurrentQuestion();
      this.closeOMR();
    }
  },

  /**
   * OMR Sheet Drawer 렌더링
   */
  renderOMR() {
    const grid = document.getElementById('omrGridBody');
    if (!grid) return;

    grid.innerHTML = '';
    const circNums = ['', '①', '②', '③', '④', '⑤'];

    this.state.questions.forEach((q, idx) => {
      const qId = q.id;
      const ans = this.state.answers[qId];
      const isBookmarked = !!this.state.bookmarks[qId];
      const isCurrent = idx === this.state.currentIndex;

      const item = document.createElement('div');
      item.id = `omrItem_${qId}`;
      item.className = `omr-item ${ans ? 'answered' : ''} ${isBookmarked ? 'bookmarked' : ''} ${isCurrent ? 'current' : ''}`;
      item.onclick = () => this.jumpToQuestion(idx);

      item.innerHTML = `
        <span class="omr-item-num">${idx + 1}</span>
        <span class="omr-item-val">${ans ? circNums[ans] : '-'}</span>
      `;

      grid.appendChild(item);
    });

    const answeredCount = Object.keys(this.state.answers).length;
    const totalCount = this.state.questions.length;
    document.getElementById('omrStatusText').textContent = `총 ${totalCount}문항 중 ${answeredCount}문항 마킹 완료 (남은 문항: ${totalCount - answeredCount})`;
  },

  updateOMRItem(qId, selectedOpt) {
    const item = document.getElementById(`omrItem_${qId}`);
    if (!item) return;

    const circNums = ['', '①', '②', '③', '④', '⑤'];
    const isBookmarked = !!this.state.bookmarks[qId];

    if (selectedOpt) {
      item.classList.add('answered');
      item.querySelector('.omr-item-val').textContent = circNums[selectedOpt];
    } else {
      item.classList.remove('answered');
      item.querySelector('.omr-item-val').textContent = '-';
    }

    if (isBookmarked) {
      item.classList.add('bookmarked');
    } else {
      item.classList.remove('bookmarked');
    }

    const answeredCount = Object.keys(this.state.answers).length;
    const totalCount = this.state.questions.length;
    document.getElementById('omrStatusText').textContent = `총 ${totalCount}문항 중 ${answeredCount}문항 마킹 완료 (남은 문항: ${totalCount - answeredCount})`;
  },

  updateOMRHighlight() {
    const items = document.querySelectorAll('.omr-item');
    items.forEach((item, idx) => {
      if (idx === this.state.currentIndex) {
        item.classList.add('current');
      } else {
        item.classList.remove('current');
      }
    });
  },

  openOMR() {
    document.getElementById('omrDrawerOverlay').classList.add('active');
    document.getElementById('omrDrawer').classList.add('active');
  },

  closeOMR() {
    document.getElementById('omrDrawerOverlay').classList.remove('active');
    document.getElementById('omrDrawer').classList.remove('active');
  },

  /**
   * 시험 제출 확인 모달
   */
  confirmSubmit() {
    const total = this.state.questions.length;
    const answered = Object.keys(this.state.answers).length;
    const unanswered = total - answered;

    let msg = `총 ${total}문항 중 ${answered}문항을 풀었습니다.\n`;
    if (unanswered > 0) {
      msg += `⚠️ 아직 풀지 않은 문항이 ${unanswered}개 있습니다.\n`;
    }
    msg += `시험을 제출하고 채점하시겠습니까?`;

    if (confirm(msg)) {
      this.submitExam(false);
    }
  },

  /**
   * 채점 실행
   */
  submitExam(isTimeOut = false) {
    this.clearInterval();
    this.closeOMR();

    const elapsedSeconds = Math.round((Date.now() - this.state.startTime) / 1000);

    const payload = {
      mode: this.state.mode,
      title: this.state.title,
      questions: this.state.questions,
      answers: this.state.answers,
      elapsedSeconds: elapsedSeconds,
      isTimeOut: isTimeOut
    };

    StorageManager.clearActiveSession();
    ScoreEngine.evaluateAndRender(payload);
  },

  saveSession() {
    StorageManager.saveActiveSession({
      mode: this.state.mode,
      title: this.state.title,
      questions: this.state.questions,
      currentIndex: this.state.currentIndex,
      answers: this.state.answers,
      bookmarks: this.state.bookmarks,
      timerSeconds: this.state.timerSeconds,
      isInstantFeedback: this.state.isInstantFeedback,
      startTime: this.state.startTime
    });
  },

  /**
   * Simple Markdown parser for Question stems & tables
   */
  parseMarkdown(str) {
    if (!str) return '';
    let out = this.escapeHtml(str);

    // Tables
    out = out.replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').slice(1, -1).map(c => c.trim());
      const isHeaderSep = cells.every(c => /^:?-+:?$/.test(c));
      if (isHeaderSep) return '<!--sep-->';
      const cellTags = cells.map(c => `<td>${c}</td>`).join('');
      return `<tr>${cellTags}</tr>`;
    });

    if (out.includes('<tr>')) {
      out = out.replace(/(<tr>.*?<\/tr>(?:\s*<!--sep-->\s*|(?:\s*<tr>.*?<\/tr>)*))/gs, (match) => {
        const cleanMatch = match.replace(/<!--sep-->/g, '');
        return `<div style="overflow-x:auto;"><table class="markdown-table">${cleanMatch}</table></div>`;
      });
    }

    // Bold
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Blockquotes (> ...)
    out = out.replace(/^(?:&gt;|>)\s*(.+)$/gm, '<blockquote class="question-passage">$1</blockquote>');

    // Paragraph line breaks
    out = out.replace(/\n\n/g, '<br><br>');
    out = out.replace(/\n/g, '<br>');

    return out;
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
