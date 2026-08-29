/**
 * 2026 청소년상담사 1급 CBT - 실전 시험 진행 엔진 (1화면 1문제 & OMR & 타이머 & 다회차 지원)
 */
const ExamEngine = {
  state: {
    round: 2,               // 1, 2, ...
    mode: 'session1',       // 'session1', 'session2', 'all', 'subject', 'retry', 'bookmarks'
    title: '',
    questions: [],
    currentIndex: 0,
    answers: {},            // { [uniqueKey]: selectedOption (1~5) }
    bookmarks: {},          // { [uniqueKey]: boolean }
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

    const round = config.round || App.currentRound || 2;
    const allRoundQuestions = (window.MOCK_EXAMS_DATA && window.MOCK_EXAMS_DATA[round]) 
      ? window.MOCK_EXAMS_DATA[round] 
      : (window.EXAM_QUESTIONS || []);

    let selectedQuestions = [];
    let title = '';
    let totalMinutes = 0;

    switch (config.mode) {
      case 'session1':
        selectedQuestions = allRoundQuestions.filter(q => q.session === 1);
        title = `[제${round}회] 제1교시 실전 모의고사 (필수 3과목 75문항)`;
        totalMinutes = 75;
        break;

      case 'session2':
        selectedQuestions = allRoundQuestions.filter(q => q.session === 2);
        title = `[제${round}회] 제2교시 실전 모의고사 (전공 4과목 100문항)`;
        totalMinutes = 100;
        break;

      case 'all':
        selectedQuestions = [...allRoundQuestions];
        title = `[제${round}회] 실전 모의고사 풀세트 (전체 7과목 175문항)`;
        totalMinutes = 175;
        break;

      case 'subject':
        selectedQuestions = allRoundQuestions.filter(q => q.subject_id === config.subjectId);
        const subjName = selectedQuestions[0] ? selectedQuestions[0].subject_name : '과목';
        title = `[제${round}회] 과목별 집중 연습 - ${subjName} (25문항)`;
        totalMinutes = config.isInstantFeedback ? 0 : 30; // 0 for untimed practice
        break;

      case 'retry':
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
        selectedQuestions = allRoundQuestions.filter(q => q.session === 1);
        title = `[제${round}회] 제1교시 실전 모의고사`;
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
      const key = q.uniqueId || `r${q.round || round}_q${q.id}`;
      if (StorageManager.isBookmarked(key)) {
        bookmarkMap[key] = true;
      }
    });

    this.state = {
      round: round,
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

    // Save initial state for recovery
    StorageManager.saveActiveSession(this.state);

    // Switch view
    App.showView('exam');

    // UI Updates
    const titleEl = document.getElementById('examModeTitle');
    if (titleEl) titleEl.textContent = title;

    this.renderCurrentQuestion();
    this.renderOMR();
    this.updateProgress();

    // Start Timer (if timed)
    if (this.state.timerSeconds > 0) {
      this.startTimer();
    } else {
      const timerEl = document.getElementById('examTimer');
      if (timerEl) timerEl.textContent = '연습 모드 (무제한)';
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
  },

  /**
   * 타이머 가동
   */
  startTimer() {
    this.clearInterval();
    const timerEl = document.getElementById('examTimer');

    const tick = () => {
      if (this.state.timerSeconds <= 0) {
        this.clearInterval();
        alert('⏱️ 시험 시간이 종료되었습니다! 답안을 자동으로 제출합니다.');
        this.submitExam(true);
        return;
      }

      this.state.timerSeconds -= 1;
      const m = Math.floor(this.state.timerSeconds / 60);
      const s = this.state.timerSeconds % 60;
      const mStr = String(m).padStart(2, '0');
      const sStr = String(s).padStart(2, '0');

      if (timerEl) {
        timerEl.textContent = `⏱️ ${mStr}:${sStr}`;
        if (this.state.timerSeconds < 300) {
          timerEl.classList.add('urgent');
        } else {
          timerEl.classList.remove('urgent');
        }
      }

      // Periodically sync session
      if (this.state.timerSeconds % 10 === 0) {
        StorageManager.saveActiveSession(this.state);
      }
    };

    tick();
    this.state.timerInterval = setInterval(tick, 1000);
  },

  clearInterval() {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
  },

  /**
   * 현재 문항 렌더링 (1화면 1문제)
   */
  renderCurrentQuestion() {
    const q = this.state.questions[this.state.currentIndex];
    if (!q) return;

    const qKey = q.uniqueId || `r${q.round || this.state.round}_q${q.id}`;
    const roundNum = q.round || this.state.round || 2;

    // 1. Header Badges
    const badgeEl = document.getElementById('examSubjectBadge');
    if (badgeEl) {
      badgeEl.textContent = `[제${roundNum}회] ${q.subject_name}`;
    }

    const tagsEl = document.getElementById('questionTags');
    if (tagsEl) {
      let numLabel = `문항 ${q.session_q_num || q.id}`;
      if (this.state.mode === 'subject') {
        numLabel = `${q.subject_name} ${q.subject_q_num}번`;
      } else if (this.state.mode === 'retry' || this.state.mode === 'bookmarks') {
        numLabel = `문항 ${this.state.currentIndex + 1} / ${this.state.questions.length} (원문항 ${q.id}번)`;
      }

      tagsEl.innerHTML = `
        <span class="badge badge-accent">제${roundNum}회</span>
        <span class="badge badge-primary">${numLabel}</span>
        <span class="badge badge-secondary">${q.domain || q.subject_name}</span>
        <span class="badge badge-secondary">${q.difficulty || '중상'}</span>
      `;
    }

    // 2. Bookmark State
    const btnBookmark = document.getElementById('btnBookmark');
    const isBookmarked = !!this.state.bookmarks[qKey];
    if (btnBookmark) {
      btnBookmark.innerHTML = isBookmarked ? '★' : '☆';
      if (isBookmarked) {
        btnBookmark.classList.add('active');
      } else {
        btnBookmark.classList.remove('active');
      }
    }

    // 3. Question Stem (Markdown formatting)
    const stemEl = document.getElementById('questionStem');
    if (stemEl) {
      stemEl.innerHTML = this.formatMarkdown(q.stem);
    }

    // 4. Choice Options (① ~ ⑤)
    const optionsList = document.getElementById('optionsList');
    if (optionsList) {
      optionsList.innerHTML = '';
      const selectedOption = this.state.answers[qKey] || 0;
      const circs = ['①', '②', '③', '④', '⑤'];

      (q.options || []).forEach((optText, optIdx) => {
        const optNum = optIdx + 1;
        const isSelected = (selectedOption === optNum);

        const card = document.createElement('div');
        card.className = `option-card ${isSelected ? 'selected' : ''}`;
        card.onclick = () => this.selectOption(optNum);

        // Instant feedback mode visual cue
        if (this.state.isInstantFeedback && selectedOption > 0) {
          if (optNum === q.answer) {
            card.classList.add('correct');
          } else if (isSelected && optNum !== q.answer) {
            card.classList.add('wrong');
          }
        }

        card.innerHTML = `
          <div class="option-circ ${isSelected ? 'selected' : ''}">${circs[optIdx]}</div>
          <div class="option-text">${this.formatMarkdown(optText)}</div>
        `;
        optionsList.appendChild(card);
      });
    }

    // 5. Instant Explanation Box (Practice Mode)
    const instantBox = document.getElementById('instantFeedbackBox');
    if (instantBox) {
      const selectedOption = this.state.answers[qKey] || 0;
      if (this.state.isInstantFeedback && selectedOption > 0) {
        const isCorrect = (selectedOption === q.answer);
        instantBox.style.display = 'block';
        instantBox.className = `instant-explanation-box ${isCorrect ? 'correct' : 'wrong'}`;
        instantBox.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <div style="font-weight:800; font-size:1.1rem; color:${isCorrect ? 'var(--success)' : 'var(--danger)'};">
              ${isCorrect ? '🎉 정답입니다!' : `❌ 틀렸습니다. (정답: ${this.getCircNum(q.answer)})`}
            </div>
            <span class="badge ${isCorrect ? 'badge-success' : 'badge-danger'}">제${roundNum}회 ${q.id}번</span>
          </div>
          <div style="font-weight:700; margin-bottom:6px; color:var(--text-main);">📖 정답 해설</div>
          <div style="font-size:0.92rem; line-height:1.6; margin-bottom:12px;">${this.formatMarkdown(q.explanation || '해설이 제공되지 않았습니다.')}</div>
          ${q.distractor_exp ? `
            <div style="font-weight:700; margin-bottom:6px; color:var(--text-main);">🔍 오답 반증 및 선지 분석</div>
            <div style="font-size:0.88rem; line-height:1.6; margin-bottom:12px; color:var(--text-muted);">${this.formatMarkdown(q.distractor_exp)}</div>
          ` : ''}
          ${q.citation ? `
            <div style="font-size:0.8rem; color:var(--primary); background:var(--primary-light); padding:8px 12px; border-radius:var(--radius-sm);">
              <strong>출처 및 법령 근거:</strong> ${this.formatMarkdown(q.citation)}
            </div>
          ` : ''}
        `;
      } else {
        instantBox.style.display = 'none';
      }
    }

    // 6. Update Navigation Buttons
    const btnPrev = document.getElementById('btnPrevQuestion');
    const btnNext = document.getElementById('btnNextQuestion');
    if (btnPrev) btnPrev.disabled = (this.state.currentIndex === 0);
    if (btnNext) {
      if (this.state.currentIndex === this.state.questions.length - 1) {
        btnNext.textContent = '🏁 OMR 제출';
        btnNext.className = 'btn btn-primary';
      } else {
        btnNext.textContent = '다음 ▶';
        btnNext.className = 'btn btn-secondary';
      }
    }

    // 7. Update OMR Counter in Bottom Bar
    this.updateProgress();
    this.updateOMRMarker();
  },

  /**
   * 보기 선택 (1 ~ 5)
   */
  selectOption(optionNum) {
    const q = this.state.questions[this.state.currentIndex];
    if (!q) return;

    const qKey = q.uniqueId || `r${q.round || this.state.round}_q${q.id}`;
    this.state.answers[qKey] = optionNum;

    // Persist
    StorageManager.saveActiveSession(this.state);

    // Re-render UI
    this.renderCurrentQuestion();
    this.updateOMRMarker();

    // Auto advance in rapid practice mode (optional)
  },

  /**
   * 이전 문항으로
   */
  prevQuestion() {
    if (this.state.currentIndex > 0) {
      this.state.currentIndex -= 1;
      this.renderCurrentQuestion();
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  },

  /**
   * 다음 문항으로
   */
  nextQuestion() {
    if (this.state.currentIndex < this.state.questions.length - 1) {
      this.state.currentIndex += 1;
      this.renderCurrentQuestion();
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      // Last question reached -> open OMR drawer
      this.openOMR();
    }
  },

  /**
   * 특정 문항으로 점프 (OMR 클릭 시)
   */
  jumpToQuestion(index) {
    if (index >= 0 && index < this.state.questions.length) {
      this.state.currentIndex = index;
      this.renderCurrentQuestion();
      this.closeOMR();
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  },

  /**
   * 북마크 토글
   */
  toggleBookmark() {
    const q = this.state.questions[this.state.currentIndex];
    if (!q) return;

    const qKey = q.uniqueId || `r${q.round || this.state.round}_q${q.id}`;
    const newState = StorageManager.toggleBookmark(qKey);
    this.state.bookmarks[qKey] = newState;

    const btn = document.getElementById('btnBookmark');
    if (btn) {
      btn.innerHTML = newState ? '★' : '☆';
      if (newState) btn.classList.add('active');
      else btn.classList.remove('active');
    }

    App.showToast(newState ? '★ 문항이 북마크되었습니다.' : '☆ 북마크가 해제되었습니다.');
    this.updateOMRMarker();
  },

  /**
   * 프로그레스 바 & 카운터 갱신
   */
  updateProgress() {
    const total = this.state.questions.length;
    const curr = this.state.currentIndex + 1;
    const answeredCount = Object.keys(this.state.answers).length;

    const fillEl = document.getElementById('examProgressFill');
    if (fillEl) {
      fillEl.style.width = `${(curr / total) * 100}%`;
    }

    const textEl = document.getElementById('examProgressText');
    if (textEl) {
      textEl.textContent = `문항 ${curr} / ${total}`;
    }

    const omrCounter = document.getElementById('navOmrCounter');
    if (omrCounter) {
      omrCounter.textContent = `${answeredCount}/${total}`;
      if (answeredCount === total) {
        omrCounter.className = 'badge badge-success';
      } else {
        omrCounter.className = 'badge badge-primary';
      }
    }
  },

  /**
   * OMR 드로어 열기
   */
  openOMR() {
    this.renderOMR();
    const overlay = document.getElementById('omrDrawerOverlay');
    const drawer = document.getElementById('omrDrawer');
    if (overlay) overlay.classList.add('active');
    if (drawer) drawer.classList.add('active');
  },

  /**
   * OMR 드로어 닫기
   */
  closeOMR() {
    const overlay = document.getElementById('omrDrawerOverlay');
    const drawer = document.getElementById('omrDrawer');
    if (overlay) overlay.classList.remove('active');
    if (drawer) drawer.classList.remove('active');
  },

  /**
   * OMR 카드 렌더링
   */
  renderOMR() {
    const body = document.getElementById('omrGridBody');
    if (!body) return;

    body.innerHTML = '';
    const total = this.state.questions.length;
    const answered = Object.keys(this.state.answers).length;
    const circs = ['①', '②', '③', '④', '⑤'];

    const statusEl = document.getElementById('omrStatusText');
    if (statusEl) {
      statusEl.textContent = `총 ${total}문항 중 ${answered}문항 마킹 완료 (${total - answered}문항 미마킹)`;
    }

    this.state.questions.forEach((q, idx) => {
      const qKey = q.uniqueId || `r${q.round || this.state.round}_q${q.id}`;
      const selected = this.state.answers[qKey] || 0;
      const isCurrent = (this.state.currentIndex === idx);
      const isBookmarked = !!this.state.bookmarks[qKey];

      const row = document.createElement('div');
      row.className = `omr-row ${isCurrent ? 'current' : ''}`;
      row.id = `omr_row_${idx}`;

      let circButtons = '';
      circs.forEach((c, cIdx) => {
        const optVal = cIdx + 1;
        const isMarked = (selected === optVal);
        circButtons += `
          <button type="button" class="omr-bubble ${isMarked ? 'filled' : ''}" onclick="event.stopPropagation(); ExamEngine.setOMRAnswer(${idx}, ${optVal})">
            ${c}
          </button>
        `;
      });

      row.onclick = () => this.jumpToQuestion(idx);

      let qNumberDisplay = `${idx + 1}`;
      if (this.state.mode !== 'subject' && q.session_q_num) {
        qNumberDisplay = `${q.session_q_num}`;
      }

      row.innerHTML = `
        <div class="omr-q-num">
          <span>${qNumberDisplay}</span>
          ${isBookmarked ? '<span style="color:var(--accent); font-size:0.75rem;">★</span>' : ''}
        </div>
        <div class="omr-bubbles-row">
          ${circButtons}
        </div>
      `;

      body.appendChild(row);
    });
  },

  /**
   * OMR 카드에서 직접 마킹
   */
  setOMRAnswer(qIndex, optionVal) {
    const q = this.state.questions[qIndex];
    if (!q) return;

    const qKey = q.uniqueId || `r${q.round || this.state.round}_q${q.id}`;
    this.state.answers[qKey] = optionVal;

    StorageManager.saveActiveSession(this.state);
    this.renderOMR();
    this.updateProgress();

    if (this.state.currentIndex === qIndex) {
      this.renderCurrentQuestion();
    }
  },

  updateOMRMarker() {
    // Quick sync for active row in OMR if open
    const currentIdx = this.state.currentIndex;
    document.querySelectorAll('.omr-row').forEach((row, idx) => {
      if (idx === currentIdx) row.classList.add('current');
      else row.classList.remove('current');
    });
  },

  /**
   * 제출 전 확인
   */
  confirmSubmit() {
    const total = this.state.questions.length;
    const answered = Object.keys(this.state.answers).length;
    const unAnswered = total - answered;

    let msg = `총 ${total}문항 중 ${answered}문항을 마킹하셨습니다.\n`;
    if (unAnswered > 0) {
      msg += `⚠️ 아직 풀지 않은 문항이 ${unAnswered}개 있습니다!\n\n`;
    }
    msg += '답안을 최종 제출하고 채점 결과를 확인하시겠습니까?';

    if (confirm(msg)) {
      this.submitExam(false);
    }
  },

  /**
   * 최종 답안 제출 및 자동 채점
   */
  submitExam(isTimeOut = false) {
    this.clearInterval();
    this.closeOMR();

    const elapsedSeconds = Math.round((Date.now() - (this.state.startTime || Date.now())) / 1000);

    const payload = {
      round: this.state.round,
      mode: this.state.mode,
      title: this.state.title,
      questions: this.state.questions,
      answers: this.state.answers,
      elapsedSeconds: elapsedSeconds,
      isTimeOut: isTimeOut
    };

    // Clear active session
    StorageManager.clearActiveSession();

    // Pass to Score Engine
    ScoreEngine.evaluateAndRender(payload);
  },

  /**
   * 원문자 번호 변환
   */
  getCircNum(n) {
    const circs = { 1: '①', 2: '②', 3: '③', 4: '④', 5: '⑤' };
    return circs[n] || n;
  },

  /**
   * 초간단 마크다운 포매터
   */
  formatMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks / blockquotes
    html = html.replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>');
    
    // Bold / Italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Links [Text](URL)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--primary); text-decoration:underline;">$1 🔗</a>');

    // Tables
    if (html.includes('|')) {
      const lines = html.split('\n');
      let inTable = false;
      let tableHtml = '<table class="cbt-table"><tbody>';
      const outputLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && line.endsWith('|')) {
          if (line.includes('---')) continue; // skip divider
          inTable = true;
          const cells = line.split('|').slice(1, -1);
          tableHtml += '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
        } else {
          if (inTable) {
            tableHtml += '</tbody></table>';
            outputLines.push(tableHtml);
            tableHtml = '<table class="cbt-table"><tbody>';
            inTable = false;
          }
          outputLines.push(line);
        }
      }
      if (inTable) {
        tableHtml += '</tbody></table>';
        outputLines.push(tableHtml);
      }
      html = outputLines.join('\n');
    }

    // Line breaks
    html = html.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

    return html;
  }
};
