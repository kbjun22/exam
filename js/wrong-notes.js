/**
 * 2026 청소년상담사 1급 CBT - 오답노트 & 다시 풀기 관리자 (Wrong Notes Manager)
 */
const WrongNotesManager = {
  currentFilter: 'all', // 'all', subjectId, 'unmastered'

  /**
   * 오답노트 화면 렌더링
   */
  renderView() {
    const wrongDb = StorageManager.getWrongNotes();
    const wrongIds = Object.keys(wrongDb);
    const allQuestions = window.EXAM_QUESTIONS || [];
    const questionsMap = {};
    allQuestions.forEach(q => questionsMap[q.id] = q);

    const container = document.getElementById('wrongNotesList');
    const statsContainer = document.getElementById('wrongNotesStats');
    if (!container) return;

    container.innerHTML = '';

    const totalWrong = wrongIds.length;
    const unmastered = wrongIds.filter(id => !wrongDb[id].mastered).length;

    // Stats bar
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-subtle); padding:14px 18px; border-radius:var(--radius-md); margin-bottom:16px; border:1px solid var(--border-color);">
          <div>
            <div style="font-size:0.85rem; color:var(--text-muted);">총 누적 오답 문항</div>
            <div style="font-size:1.25rem; font-weight:800; color:var(--danger);">${totalWrong}문항 <span style="font-size:0.85rem; font-weight:normal; color:var(--text-sub);">(미완료: ${unmastered}개)</span></div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="WrongNotesManager.startRetryAll()">
            🔄 미완료 ${unmastered}문항 다시 풀기
          </button>
        </div>
      `;
    }

    if (totalWrong === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:50px 20px; color:var(--text-muted);">
          <div style="font-size:2.5rem; margin-bottom:10px;">🎉</div>
          <div style="font-size:1.1rem; font-weight:700; color:var(--text-main);">오답노트가 비어 있습니다!</div>
          <p style="font-size:0.88rem; margin-top:6px;">모의고사를 풀고 틀린 문제가 자동으로 이곳에 기록됩니다.</p>
        </div>
      `;
      return;
    }

    // Filter questions
    let filteredIds = wrongIds;
    if (this.currentFilter === 'unmastered') {
      filteredIds = wrongIds.filter(id => !wrongDb[id].mastered);
    } else if (this.currentFilter !== 'all') {
      const sId = parseInt(this.currentFilter);
      filteredIds = wrongIds.filter(id => wrongDb[id].subject_id === sId);
    }

    const circNums = ['', '①', '②', '③', '④', '⑤'];

    filteredIds.forEach(qId => {
      const info = wrongDb[qId];
      const q = questionsMap[qId];
      if (!q) return;

      const card = document.createElement('div');
      card.className = `review-question-card ${info.mastered ? 'correct' : 'wrong'}`;
      card.id = `wrongCard_${qId}`;

      card.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="badge ${info.mastered ? 'badge-success' : 'badge-danger'}">
              ${info.mastered ? '✅ 복습 완료' : `❌ ${info.wrongCount}회 오답`}
            </span>
            <span style="font-size:0.85rem; font-weight:700;">[문항 ${q.id}] ${q.subject_name}</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="WrongNotesManager.toggleMastered(${q.id})">
            ${info.mastered ? '다시 오답으로' : '✓ 마스터 완료'}
          </button>
        </div>

        <div class="markdown-content" style="font-size:0.95rem; font-weight:600; line-height:1.6; margin-bottom:12px; color:var(--text-main);">
          <span style="color:var(--primary); font-weight:800; margin-right:4px;">${q.id}.</span>${ExamEngine.parseMarkdown(q.stem)}
        </div>

        <div class="options-list" style="margin-bottom:12px;">
          ${q.options.map((opt, oIdx) => {
            const optNum = oIdx + 1;
            let optClass = 'option-card';
            if (optNum === q.answer) optClass += ' correct-answer';
            else if (optNum === info.lastSelectedAnswer) optClass += ' wrong-selected';

            return `
              <div class="${optClass}" style="cursor:default; padding:8px 12px;">
                <div class="option-circle" style="width:24px; height:24px; min-width:24px; font-size:0.75rem;">${circNums[optNum]}</div>
                <div class="option-text" style="font-size:0.88rem;">${ExamEngine.escapeHtml(opt)}</div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Explanation Section -->
        <details style="background:var(--bg-subtle); border-radius:var(--radius-md); padding:12px; margin-top:8px;">
          <summary style="cursor:pointer; font-weight:700; color:var(--primary); font-size:0.88rem; outline:none;">
            📖 심층 해설 & 5개 보기 오답 반증 보기
          </summary>
          <div class="explanation-content" style="margin-top:10px; padding:0; background:transparent;">
            <div class="explanation-section-title">💡 정답 해설</div>
            <p>${ExamEngine.escapeHtml(q.explanation)}</p>

            ${q.distractor_exp ? `
              <div class="explanation-section-title">🔍 5개 보기별 오답 반증</div>
              <div class="markdown-content">${ExamEngine.parseMarkdown(q.distractor_exp)}</div>
            ` : ''}

            ${q.citation ? `
              <div class="explanation-section-title">📚 학술 및 법령 출처</div>
              <div class="markdown-content" style="font-size:0.82rem; color:var(--text-muted);">${ExamEngine.parseMarkdown(q.citation)}</div>
            ` : ''}
          </div>
        </details>

        <!-- User Note Input -->
        <div style="margin-top:10px; display:flex; gap:8px;">
          <input type="text" id="userNoteInput_${q.id}" class="form-control" 
            style="flex:1; padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-main); font-size:0.85rem;" 
            placeholder="나만의 오답 이유/핵심 암기 메모..." 
            value="${ExamEngine.escapeHtml(info.userNote || '')}"
            onchange="WrongNotesManager.saveNote(${q.id}, this.value)" />
          <button class="btn btn-secondary btn-sm" onclick="WrongNotesManager.startSingleRetry(${q.id})">
            단독 풀기
          </button>
        </div>
      `;

      container.appendChild(card);
    });
  },

  setFilter(filter) {
    this.currentFilter = filter;
    document.querySelectorAll('.wrong-filter-btn').forEach(btn => {
      if (btn.dataset.filter === String(filter)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    this.renderView();
  },

  toggleMastered(qId) {
    const wrongDb = StorageManager.getWrongNotes();
    const current = wrongDb[qId] ? !!wrongDb[qId].mastered : false;
    StorageManager.markWrongNoteMastered(qId, !current);
    this.renderView();
    App.showToast(!current ? '✓ 마스터 완료 처리되었습니다.' : '오답 목록으로 복원되었습니다.');
  },

  saveNote(qId, note) {
    StorageManager.saveUserNote(qId, note);
    App.showToast('메모가 저장되었습니다.');
  },

  startRetryAll() {
    const wrongDb = StorageManager.getWrongNotes();
    const unmasteredIds = Object.keys(wrongDb).filter(id => !wrongDb[id].mastered).map(Number);

    if (unmasteredIds.length === 0) {
      App.showToast('다시 풀 미완료 오답 문항이 없습니다.');
      return;
    }

    const allQuestions = window.EXAM_QUESTIONS || [];
    const selected = allQuestions.filter(q => unmasteredIds.includes(q.id));

    ExamEngine.startExam({
      mode: 'retry',
      title: `오답노트 다시 풀기 (${selected.length}문항)`,
      questions: selected
    });
  },

  startSingleRetry(qId) {
    const allQuestions = window.EXAM_QUESTIONS || [];
    const q = allQuestions.find(item => item.id === qId);
    if (!q) return;

    ExamEngine.startExam({
      mode: 'retry',
      title: `문항 ${qId} 다시 풀기`,
      questions: [q],
      isInstantFeedback: true
    });
  }
};
