/**
 * 2026 청소년상담사 1급 CBT - 자동 채점 & 성적 분석 엔진 (Score & Analytics)
 */
const ScoreEngine = {
  lastResult: null,

  /**
   * 답안 채점 및 결과 렌더링
   */
  evaluateAndRender(sessionPayload) {
    const { mode, title, questions, answers, elapsedSeconds, isTimeOut } = sessionPayload;

    let correctCount = 0;
    const totalQuestions = questions.length;
    const wrongList = [];
    const gradedQuestions = [];

    // Subject breakdown map
    const subjectStats = {};

    questions.forEach((q, idx) => {
      const qId = q.id;
      const userAns = answers[qId] || 0;
      const isCorrect = (userAns === q.answer);

      if (isCorrect) {
        correctCount += 1;
      } else {
        wrongList.push({
          id: qId,
          subject_id: q.subject_id,
          subject_name: q.subject_name,
          title: q.title,
          userAnswer: userAns,
          answer: q.answer
        });
      }

      // Initialize subject stats
      const sId = q.subject_id;
      if (!subjectStats[sId]) {
        subjectStats[sId] = {
          id: sId,
          name: q.subject_name,
          total: 0,
          correct: 0,
          score100: 0,
          isDisqualified: false // < 40
        };
      }

      subjectStats[sId].total += 1;
      if (isCorrect) {
        subjectStats[sId].correct += 1;
      }

      gradedQuestions.push({
        ...q,
        index: idx + 1,
        userAnswer: userAns,
        isCorrect: isCorrect
      });
    });

    // Calculate subject 100-point scores and check cutoff (과락: 40점 미만)
    let hasDisqualification = false;
    const disqualifiedSubjects = [];
    const subjectsArray = Object.values(subjectStats);

    subjectsArray.forEach(subj => {
      subj.score100 = Math.round((subj.correct / subj.total) * 100);
      if (subj.score100 < 40) {
        subj.isDisqualified = true;
        hasDisqualification = true;
        disqualifiedSubjects.push(subj.name);
      }
    });

    // Calculate total average score (100 scaled)
    const averageScore = Math.round((correctCount / totalQuestions) * 100);

    // Official Pass/Fail Criteria:
    // 1. Average score >= 60
    // 2. Every subject >= 40 (No disqualification)
    const isPassed = (averageScore >= 60) && !hasDisqualification;

    // Save to Wrong Notes DB in Storage
    if (wrongList.length > 0) {
      StorageManager.addWrongQuestions(wrongList);
    }

    // Save Exam History
    const historyItem = {
      mode: mode,
      title: title,
      totalQuestions: totalQuestions,
      correctCount: correctCount,
      averageScore: averageScore,
      isPassed: isPassed,
      hasDisqualification: hasDisqualification,
      disqualifiedSubjects: disqualifiedSubjects,
      elapsedSeconds: elapsedSeconds,
      subjectStats: subjectsArray
    };
    StorageManager.saveHistoryItem(historyItem);

    // Store in memory for retry
    this.lastResult = {
      ...historyItem,
      gradedQuestions: gradedQuestions,
      wrongList: wrongList
    };

    // Render View
    this.renderScoreView(this.lastResult);
    App.showView('score');
  },

  /**
   * 성적표 화면 HTML 생성
   */
  renderScoreView(result) {
    const {
      title,
      totalQuestions,
      correctCount,
      averageScore,
      isPassed,
      hasDisqualification,
      disqualifiedSubjects,
      elapsedSeconds,
      subjectStats,
      gradedQuestions,
      wrongList
    } = result;

    // Time formatting
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    const timeStr = `${mins}분 ${secs}초`;

    // 1. Pass / Fail Banner
    const bannerEl = document.getElementById('scoreBanner');
    let bannerClass = 'score-banner';
    let badgeText = '';
    let badgeClass = 'score-pass-badge';
    let subMessage = '';

    if (isPassed) {
      bannerClass += ' pass';
      badgeClass += ' pass';
      badgeText = '🎉 합격 (PASS)';
      subMessage = '축하합니다! 전 과목 과락 없이 평균 60점 이상을 달성하셨습니다.';
    } else if (hasDisqualification) {
      bannerClass += ' disqualified';
      badgeClass += ' fail';
      badgeText = '⚠️ 과락 불합격 (DISQUALIFIED)';
      subMessage = `과목별 과락(40점 미만)이 발생하였습니다: [${disqualifiedSubjects.join(', ')}]`;
    } else {
      bannerClass += ' fail';
      badgeClass += ' fail';
      badgeText = '❌ 불합격 (FAIL)';
      subMessage = '합격 기준(평균 60점 이상)에 미달하였습니다. 취약 과목을 보완해 보세요.';
    }

    bannerEl.className = bannerClass;
    bannerEl.innerHTML = `
      <div class="${badgeClass}">${badgeText}</div>
      <div class="score-big-number">${averageScore}<span>점 / 100점 만점</span></div>
      <p style="font-size:0.9rem; color:var(--text-sub); margin-top:4px;">${subMessage}</p>

      <div class="score-stats-grid">
        <div class="score-stat-box">
          <div class="num">${correctCount} / ${totalQuestions}</div>
          <div class="label">정답 문항수</div>
        </div>
        <div class="score-stat-box">
          <div class="num">${Math.round((correctCount / totalQuestions) * 100)}%</div>
          <div class="label">정답률</div>
        </div>
        <div class="score-stat-box">
          <div class="num">${timeStr}</div>
          <div class="label">소요 시간</div>
        </div>
      </div>
    `;

    // 2. Retry Wrong Questions Button
    const retryBtn = document.getElementById('btnRetryWrongFromScore');
    if (wrongList.length > 0) {
      retryBtn.style.display = 'inline-flex';
      retryBtn.textContent = `🔄 틀린 문제 ${wrongList.length}문항 다시 풀기`;
    } else {
      retryBtn.style.display = 'none';
    }

    // 3. Subject Score Bars
    const subjectListEl = document.getElementById('scoreSubjectList');
    subjectListEl.innerHTML = '';

    subjectStats.forEach(subj => {
      let barClass = 'safe';
      let statusBadge = '<span class="badge badge-success">통과</span>';
      if (subj.score100 < 40) {
        barClass = 'danger';
        statusBadge = '<span class="badge badge-danger">과락(40점 미만)</span>';
      } else if (subj.score100 < 60) {
        barClass = 'warning';
        statusBadge = '<span class="badge badge-warning">보통(60점 미만)</span>';
      }

      const row = document.createElement('div');
      row.className = 'subject-score-row';
      row.innerHTML = `
        <div class="subject-score-header">
          <div>
            <span class="subject-score-title">${subj.name}</span>
            ${statusBadge}
          </div>
          <div class="subject-score-points" style="color: ${subj.score100 < 40 ? 'var(--danger)' : 'var(--primary)'}">
            ${subj.score100}점 <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal;">(${subj.correct}/${subj.total}문항)</span>
          </div>
        </div>
        <div class="subject-score-bar-wrap">
          <div class="subject-score-bar-fill ${barClass}" style="width: ${subj.score100}%"></div>
        </div>
        <div class="threshold-legend">
          <span>0점</span>
          <span style="color:var(--danger); font-weight:600;">▼ 과락기준(40점)</span>
          <span style="color:var(--success); font-weight:600;">▼ 합격기준(60점)</span>
          <span>100점</span>
        </div>
      `;
      subjectListEl.appendChild(row);
    });

    // 4. Render All Questions Review List (정오표 & 상세 해설 아코디언)
    this.renderReviewList(gradedQuestions, 'all');
  },

  /**
   * 정오표 및 심층 해설 아코디언 렌더링
   */
  renderReviewList(gradedQuestions, filterType = 'all') {
    const container = document.getElementById('scoreReviewContainer');
    if (!container) return;

    container.innerHTML = '';
    const circNums = ['', '①', '②', '③', '④', '⑤'];

    const filtered = gradedQuestions.filter(q => {
      if (filterType === 'wrong') return !q.isCorrect;
      if (filterType === 'correct') return q.isCorrect;
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">해당 조건의 문항이 없습니다.</div>';
      return;
    }

    filtered.forEach(q => {
      const card = document.createElement('div');
      card.className = `review-question-card ${q.isCorrect ? 'correct' : 'wrong'}`;

      const userAnsText = q.userAnswer ? circNums[q.userAnswer] : '미답안';
      const correctAnsText = circNums[q.answer];

      card.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="badge ${q.isCorrect ? 'badge-success' : 'badge-danger'}">
              ${q.isCorrect ? '✅ 정답' : '❌ 오답'}
            </span>
            <span style="font-size:0.85rem; font-weight:700;">[문항 ${q.index}] ${q.subject_name}</span>
          </div>
          <div style="font-size:0.82rem; font-weight:600;">
            내 선택: <span style="color:${q.isCorrect ? 'var(--success)' : 'var(--danger)'};">${userAnsText}</span> | 
            정답: <span style="color:var(--success);">${correctAnsText}</span>
          </div>
        </div>

        <div class="markdown-content" style="font-size:0.95rem; font-weight:600; line-height:1.6; margin-bottom:12px; color:var(--text-main);">
          <span style="color:var(--primary); font-weight:800; margin-right:4px;">${q.index}.</span>${ExamEngine.parseMarkdown(q.stem)}
        </div>

        <div class="options-list" style="margin-bottom:12px;">
          ${q.options.map((opt, oIdx) => {
            const optNum = oIdx + 1;
            let optClass = 'option-card';
            if (optNum === q.answer) optClass += ' correct-answer';
            else if (optNum === q.userAnswer && !q.isCorrect) optClass += ' wrong-selected';

            return `
              <div class="${optClass}" style="cursor:default; padding:8px 12px;">
                <div class="option-circle" style="width:24px; height:24px; min-width:24px; font-size:0.75rem;">${circNums[optNum]}</div>
                <div class="option-text" style="font-size:0.88rem;">${ExamEngine.escapeHtml(opt)}</div>
              </div>
            `;
          }).join('')}
        </div>

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

            ${q.safety ? `
              <div class="explanation-section-title">🛡️ 안전·윤리 검토</div>
              <div style="font-size:0.82rem; color:var(--text-muted);">${ExamEngine.escapeHtml(q.safety)}</div>
            ` : ''}
          </div>
        </details>
      `;

      container.appendChild(card);
    });
  },

  /**
   * 틀린 문제만 다시 풀기 세션 시작
   */
  retryWrongQuestions() {
    if (!this.lastResult || !this.lastResult.wrongList || this.lastResult.wrongList.length === 0) {
      App.showToast('틀린 문제가 없습니다.');
      return;
    }

    const wrongIds = this.lastResult.wrongList.map(w => w.id);
    const allQuestions = window.EXAM_QUESTIONS || [];
    const selectedQuestions = allQuestions.filter(q => wrongIds.includes(q.id));

    ExamEngine.startExam({
      mode: 'retry',
      title: `오답 다시 풀기 (${selectedQuestions.length}문항)`,
      questions: selectedQuestions
    });
  }
};
