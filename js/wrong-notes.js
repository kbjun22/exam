/**
 * 2026 청소년상담사 1급 CBT - 오답노트 & 다시 풀기 매니저 (Wrong Notes Manager & Multi-Round)
 */
const WrongNotesManager = {
  currentFilter: 'all',          // 'all', 'unmastered', '1'~'7' (subject)
  roundFilter: 'all',            // 'all', '1', '2', ...

  /**
   * 오답노트 뷰 렌더링
   */
  renderView() {
    const rawDb = StorageManager.getWrongNotes();
    const items = Object.values(rawDb);

    this.renderStatsBar(items);
    this.renderRoundFilterTabs();
    this.renderList(items);
  },

  setFilter(filter) {
    this.currentFilter = filter;
    document.querySelectorAll('.wrong-filter-btn').forEach(btn => {
      if (btn.getAttribute('data-filter') === String(filter)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    this.renderView();
  },

  setRoundFilter(rFilter) {
    this.roundFilter = rFilter;
    document.querySelectorAll('.wrong-round-btn').forEach(btn => {
      if (btn.getAttribute('data-round-filter') === String(rFilter)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    this.renderView();
  },

  /**
   * 상단 통계 바 & 다시 풀기 액션
   */
  renderStatsBar(items) {
    const container = document.getElementById('wrongNotesStats');
    if (!container) return;

    const totalCount = items.length;
    const unmasteredCount = items.filter(it => !it.mastered).length;
    const masteredCount = items.filter(it => it.mastered).length;

    // Filter items based on current active filters to count how many will be retried
    let filteredForRetry = items;
    if (this.roundFilter !== 'all') {
      filteredForRetry = filteredForRetry.filter(it => String(it.round) === String(this.roundFilter));
    }
    if (this.currentFilter === 'unmastered') {
      filteredForRetry = filteredForRetry.filter(it => !it.mastered);
    } else if (this.currentFilter !== 'all') {
      filteredForRetry = filteredForRetry.filter(it => String(it.subject_id) === String(this.currentFilter));
    }

    container.innerHTML = `
      <div class="card" style="margin-bottom:16px; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <div style="font-weight:700; font-size:1.05rem;">🎯 오답 누적 통계</div>
            <div style="font-size:0.85rem; color:var(--text-muted);">
              전체 누적 ${totalCount}문항 / 미정복 ${unmasteredCount}문항 / 완벽 숙지 ${masteredCount}문항
            </div>
          </div>
          <span class="badge badge-danger" style="font-size:0.9rem;">미정복 ${unmasteredCount}</span>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary" style="flex:1;" onclick="WrongNotesManager.retryFiltered()" ${filteredForRetry.length === 0 ? 'disabled' : ''}>
            🔄 현재 필터링된 ${filteredForRetry.length}문항 다시 풀기
          </button>
          <button class="btn btn-secondary btn-sm" onclick="if(confirm('오답노트를 모두 초기화하시겠습니까?')) { StorageManager.addWrongQuestions([]); localStorage.removeItem('cbt_wrong_notes'); WrongNotesManager.renderView(); App.renderHomeStats(); }">
            🗑️ 오답 비우기
          </button>
        </div>
      </div>
    `;
  },

  /**
   * 회차별 필터 탭 렌더링 (HTML 상단에 동적 삽입)
   */
  renderRoundFilterTabs() {
    let roundFilterBox = document.getElementById('wrongRoundFilterBox');
    if (!roundFilterBox) {
      // Find where to insert
      const statsBox = document.getElementById('wrongNotesStats');
      if (statsBox) {
        roundFilterBox = document.createElement('div');
        roundFilterBox.id = 'wrongRoundFilterBox';
        roundFilterBox.className = 'omr-tabs';
        roundFilterBox.style.cssText = 'margin-bottom:12px; border:none; padding:0;';
        statsBox.parentNode.insertBefore(roundFilterBox, statsBox.nextSibling);
      }
    }

    if (roundFilterBox) {
      roundFilterBox.innerHTML = `
        <button class="omr-tab-btn wrong-round-btn ${this.roundFilter === 'all' ? 'active' : ''}" data-round-filter="all" onclick="WrongNotesManager.setRoundFilter('all')">전체 회차</button>
        <button class="omr-tab-btn wrong-round-btn ${this.roundFilter === '1' ? 'active' : ''}" data-round-filter="1" onclick="WrongNotesManager.setRoundFilter('1')">제1회 모의고사</button>
        <button class="omr-tab-btn wrong-round-btn ${this.roundFilter === '2' ? 'active' : ''}" data-round-filter="2" onclick="WrongNotesManager.setRoundFilter('2')">제2회 모의고사</button>
      `;
    }
  },

  /**
   * 오답 문항 리스트 렌더링
   */
  renderList(items) {
    const listEl = document.getElementById('wrongNotesList');
    if (!listEl) return;

    listEl.innerHTML = '';

    // Apply Round filter
    let filtered = items;
    if (this.roundFilter !== 'all') {
      filtered = filtered.filter(it => String(it.round) === String(this.roundFilter));
    }

    // Apply Category filter
    if (this.currentFilter === 'unmastered') {
      filtered = filtered.filter(it => !it.mastered);
    } else if (this.currentFilter !== 'all') {
      filtered = filtered.filter(it => String(it.subject_id) === String(this.currentFilter));
    }

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; padding:50px 20px; color:var(--text-muted);">해당 조건의 오답 문항이 없습니다. 🎉</div>';
      return;
    }

    const circs = ['①', '②', '③', '④', '⑤'];

    // Sort by last wrong date descending
    filtered.sort((a, b) => new Date(b.lastWrongDate) - new Date(a.lastWrongDate));

    filtered.forEach(it => {
      const uniqueKey = it.uniqueId || `r${it.round || 1}_q${it.id}`;
      const card = document.createElement('div');
      card.className = `card ${it.mastered ? 'mastered' : ''}`;
      card.style.marginBottom = '16px';
      card.style.padding = '18px';

      // Find full question object
      const roundNum = it.round || 1;
      const roundQuestions = (window.MOCK_EXAMS_DATA && window.MOCK_EXAMS_DATA[roundNum]) ? window.MOCK_EXAMS_DATA[roundNum] : (window.EXAM_QUESTIONS || []);
      const fullQ = roundQuestions.find(q => q.id === it.id) || it;

      const dateStr = new Date(it.lastWrongDate).toLocaleDateString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:6px;">
          <div>
            <span class="badge ${it.mastered ? 'badge-success' : 'badge-danger'}">
              ${it.mastered ? '✅ 정복 완료' : `❌ ${it.wrongCount}회 틀림`}
            </span>
            <span class="badge badge-accent" style="margin-left:4px;">제${roundNum}회</span>
            <span class="badge badge-primary" style="margin-left:4px;">${fullQ.subject_name || it.subject_name} ${it.id}번</span>
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted);">
            최근 오답: ${dateStr}
          </div>
        </div>

        <div class="markdown-content" style="font-weight:600; line-height:1.6; margin-bottom:12px; color:var(--text-main);">
          ${ExamEngine.formatMarkdown(fullQ.stem || it.stem || '')}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.88rem; margin-bottom:14px; background:var(--bg-secondary); padding:10px 14px; border-radius:var(--radius-sm);">
          <span>내가 찍은 오답: <strong style="color:var(--danger);">${it.lastSelectedAnswer ? circs[it.lastSelectedAnswer - 1] : '미표기'}</strong></span>
          <span>정답: <strong style="color:var(--success); font-size:1.05rem;">${circs[(fullQ.answer || it.correctAnswer || 1) - 1]}</strong></span>
        </div>

        <!-- Explanation accordion -->
        <details style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:10px 14px; margin-bottom:12px;">
          <summary style="font-weight:700; color:var(--primary); cursor:pointer;">📖 정답 해설 및 오답 반증 보기</summary>
          <div style="margin-top:10px; font-size:0.9rem; line-height:1.6;">
            <div style="font-weight:700; margin-bottom:4px;">[정답 해설]</div>
            <div style="margin-bottom:10px;">${ExamEngine.formatMarkdown(fullQ.explanation || it.explanation || '')}</div>
            ${(fullQ.distractor_exp || it.distractor_exp) ? `
              <div style="font-weight:700; margin-bottom:4px; color:var(--danger);">[오답 반증]</div>
              <div style="margin-bottom:10px; color:var(--text-muted);">${ExamEngine.formatMarkdown(fullQ.distractor_exp || it.distractor_exp)}</div>
            ` : ''}
            ${(fullQ.citation || it.citation) ? `
              <div style="font-size:0.8rem; color:var(--primary);">출처: ${ExamEngine.formatMarkdown(fullQ.citation || it.citation)}</div>
            ` : ''}
          </div>
        </details>

        <!-- User memo -->
        <div style="display:flex; gap:8px; margin-bottom:12px;">
          <input type="text" class="auth-input" id="memo_${uniqueKey}" placeholder="나만의 오답 핵심 요약 메모 입력..." value="${it.userNote || ''}" style="font-size:0.85rem; padding:8px 12px; height:auto;" />
          <button class="btn btn-secondary btn-sm" onclick="WrongNotesManager.saveMemo('${uniqueKey}')">저장</button>
        </div>

        <!-- Mastered Toggle & Single Retry -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); pt-2; padding-top:10px;">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.88rem;">
            <input type="checkbox" ${it.mastered ? 'checked' : ''} onchange="WrongNotesManager.toggleMastered('${uniqueKey}', this.checked)" style="width:18px; height:18px; cursor:pointer;" />
            <span>이 문제 완벽히 숙지함 (정복)</span>
          </label>
          <button class="btn btn-secondary btn-sm" onclick="WrongNotesManager.retrySingle('${uniqueKey}')">
            이 문제만 풀기 ▶
          </button>
        </div>
      `;

      listEl.appendChild(card);
    });
  },

  saveMemo(uniqueKey) {
    const input = document.getElementById(`memo_${uniqueKey}`);
    if (input) {
      StorageManager.saveUserNote(uniqueKey, input.value.trim());
      App.showToast('💾 나만의 메모가 저장되었습니다.');
    }
  },

  toggleMastered(uniqueKey, isChecked) {
    StorageManager.markWrongNoteMastered(uniqueKey, isChecked);
    this.renderView();
    App.renderHomeStats();
    App.showToast(isChecked ? '✅ 문항이 정복 완료로 표시되었습니다.' : '🔄 문항이 미정복 상태로 복구되었습니다.');
  },

  retrySingle(uniqueKey) {
    const rawDb = StorageManager.getWrongNotes();
    const it = rawDb[uniqueKey];
    if (!it) return;

    const roundNum = it.round || 1;
    const roundQuestions = (window.MOCK_EXAMS_DATA && window.MOCK_EXAMS_DATA[roundNum]) ? window.MOCK_EXAMS_DATA[roundNum] : (window.EXAM_QUESTIONS || []);
    const fullQ = roundQuestions.find(q => q.id === it.id);

    if (fullQ) {
      ExamEngine.startExam({
        round: roundNum,
        mode: 'retry',
        title: `[제${roundNum}회] 오답 1문항 집중 복습 (${fullQ.subject_name} ${fullQ.id}번)`,
        questions: [fullQ],
        isInstantFeedback: true
      });
    }
  },

  retryFiltered() {
    const rawDb = StorageManager.getWrongNotes();
    const items = Object.values(rawDb);

    let filtered = items;
    if (this.roundFilter !== 'all') {
      filtered = filtered.filter(it => String(it.round) === String(this.roundFilter));
    }
    if (this.currentFilter === 'unmastered') {
      filtered = filtered.filter(it => !it.mastered);
    } else if (this.currentFilter !== 'all') {
      filtered = filtered.filter(it => String(it.subject_id) === String(this.currentFilter));
    }

    if (filtered.length === 0) {
      App.showToast('풀이할 오답 문항이 없습니다.');
      return;
    }

    // Convert to full questions
    const questionList = [];
    filtered.forEach(it => {
      const roundNum = it.round || 1;
      const roundQuestions = (window.MOCK_EXAMS_DATA && window.MOCK_EXAMS_DATA[roundNum]) ? window.MOCK_EXAMS_DATA[roundNum] : (window.EXAM_QUESTIONS || []);
      const fullQ = roundQuestions.find(q => q.id === it.id);
      if (fullQ) {
        questionList.push(fullQ);
      }
    });

    const activeRoundTitle = this.roundFilter !== 'all' ? `[제${this.roundFilter}회]` : '[전체 회차]';

    ExamEngine.startExam({
      round: this.roundFilter !== 'all' ? parseInt(this.roundFilter, 10) : 2,
      mode: 'retry',
      title: `${activeRoundTitle} 오답노트 집중 다시 풀기 (${questionList.length}문항)`,
      questions: questionList,
      isInstantFeedback: true
    });
  }
};
