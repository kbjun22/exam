/**
 * 2026 청소년상담사 1급 CBT - 자동 채점 & 성적 분석 엔진 (Score & Analytics & Multi-Round)
 */
const ScoreEngine = {
  lastResult: null,

  /**
   * 답안 채점 및 결과 렌더링
   */
  evaluateAndRender(sessionPayload) {
    const { round, mode, title, questions, answers, elapsedSeconds, isTimeOut } = sessionPayload;

    let correctCount = 0;
    const totalQuestions = questions.length;
    const wrongList = [];
    const gradedQuestions = [];

    // Subject breakdown map
    const subjectStats = {};

    questions.forEach((q, idx) => {
      const qKey = q.uniqueId || `r${q.round || round || 1}_q${q.id}`;
      const userAns = answers[qKey] || 0;
      const isCorrect = (userAns === q.answer);

      if (isCorrect) {
        correctCount += 1;
      } else {
        wrongList.push({
          uniqueId: qKey,
          id: q.id,
          round: q.round || round || 1,
          subject_id: q.subject_id,
          subject_name: q.subject_name,
          stem: q.stem,
          options: q.options,
          explanation: q.explanation,
          distractor_exp: q.distractor_exp,
          citation: q.citation,
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
        uniqueId: qKey,
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
      round: round || 1,
      mode: mode,
      title: title,
      totalQuestions: totalQuestions,
      correctCount: correctCount,
      averageScore: averageScore,
      isPassed: isPassed,
      hasDisqualification: hasDisqualification,
      disqualifiedSubjects: disqualifiedSubjects,
      subjectScores: subjectsArray.map(s => ({
        id: s.id,
        name: s.name,
        correct: s.correct,
        total: s.total,
        score: s.score100
      })),
      elapsedSeconds: elapsedSeconds
    };
    StorageManager.saveHistoryItem(historyItem);

    // Store in memory for review
    this.lastResult = {
      round: round || 1,
      mode: mode,
      title: title,
      totalQuestions: totalQuestions,
      correctCount: correctCount,
      averageScore: averageScore,
      isPassed: isPassed,
      hasDisqualification: hasDisqualification,
      disqualifiedSubjects: disqualifiedSubjects,
      subjectStats: subjectsArray,
      gradedQuestions: gradedQuestions,
      elapsedSeconds: elapsedSeconds,
      isTimeOut: isTimeOut
    };

    // Render View
    this.renderResultView(this.lastResult);
    App.showView('score');
  },

  /**
   * 결과 화면 전체 렌더링
   */
  renderResultView(res) {
    this.renderScoreBanner(res);
    this.renderSubjectList(res.subjectStats);
    this.renderReviewList(res.gradedQuestions, 'all');

    // Update retry button
    const retryBtn = document.getElementById('btnRetryWrongFromScore');
    const wrongOnes = res.gradedQuestions.filter(q => !q.isCorrect);
    if (retryBtn) {
      if (wrongOnes.length === 0) {
        retryBtn.style.display = 'none';
      } else {
        retryBtn.style.display = 'block';
        retryBtn.textContent = `🔄 틀린 ${wrongOnes.length}문제만 다시 풀기`;
      }
    }
  },

  /**
   * 상단 합격/불합격 배너
   */
  renderScoreBanner(res) {
    const banner = document.getElementById('scoreBanner');
    if (!banner) return;

    const roundLabel = `제${res.round || 1}회`;
    let statusClass = res.isPassed ? 'pass' : 'fail';
    let statusBadge = res.isPassed ? '<span class="badge badge-success">🏆 최종 합격</span>' : '<span class="badge badge-danger">⚠️ 불합격</span>';
    let statusMsg = '';

    if (res.isPassed) {
      statusMsg = '축하합니다! 전 과목 과락 없이 평균 60점 이상을 달성하여 합격 기준을 충족하였습니다.';
    } else if (res.hasDisqualification) {
      statusMsg = `과락 발생! (${res.disqualifiedSubjects.join(', ')} 40점 미만) 평균 점수와 관계없이 불합격 처리됩니다.`;
    } else {
      statusMsg = '과락은 없으나 전체 평균 60점 미만으로 합격 기준에 미달하였습니다.';
    }

    const m = Math.floor(res.elapsedSeconds / 60);
    const s = res.elapsedSeconds % 60;
    const timeStr = `${m}분 ${s}초`;

    banner.className = `score-banner ${statusClass}`;
    banner.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span class="badge badge-primary">${roundLabel} 모의고사</span>
        ${statusBadge}
      </div>
      <h1 class="score-number">${res.averageScore}<span style="font-size:1.4rem; font-weight:600;">점</span></h1>
      <div style="font-weight:700; margin-bottom:6px; font-size:1.05rem;">
        맞힌 문항: ${res.correctCount} / ${res.totalQuestions}문항 (정답률 ${Math.round((res.correctCount / res.totalQuestions) * 100)}%)
      </div>
      <p style="font-size:0.88rem; opacity:0.9; line-height:1.5; margin-bottom:8px;">${statusMsg}</p>
      <div style="font-size:0.8rem; opacity:0.8;">⏱️ 소요 시간: ${timeStr} ${res.isTimeOut ? ' (시간 초과)' : ''}</div>
    `;
  },

  /**
   * 과목별 점수 & 과락 분석 리스트
   */
  renderSubjectList(subjStats) {
    const container = document.getElementById('scoreSubjectList');
    if (!container) return;

    container.innerHTML = '';

    subjStats.forEach(s => {
      const card = document.createElement('div');
      card.className = 'subject-score-card';

      const barColor = s.isDisqualified ? 'var(--danger)' : (s.score100 >= 60 ? 'var(--success)' : 'var(--warning)');

      card.innerHTML = `
        <div class="subject-score-title">
          <span style="font-weight:700;">${s.name}</span>
          <span>
            <span style="font-weight:800; color:${barColor}; font-size:1.1rem;">${s.score100}점</span>
            <span style="font-size:0.8rem; color:var(--text-muted);">(${s.correct}/${s.total})</span>
            ${s.isDisqualified ? '<span class="badge badge-danger" style="margin-left:6px;">과락</span>' : ''}
          </span>
        </div>
        <div class="subject-score-bar-bg">
          <div class="subject-score-bar-fill" style="width:${s.score100}%; background:${barColor};"></div>
        </div>
      `;

      container.appendChild(card);
    });
  },

  /**
   * 전체 문항 심층 해설 & 오답 반증 리스트 렌더링
   */
  renderReviewList(gradedQuestions, filter = 'all') {
    const container = document.getElementById('scoreReviewContainer');
    if (!container) return;

    container.innerHTML = '';

    let filtered = gradedQuestions;
    if (filter === 'wrong') {
      filtered = gradedQuestions.filter(q => !q.isCorrect);
    } else if (filter === 'correct') {
      filtered = gradedQuestions.filter(q => q.isCorrect);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">해당 조건의 문항이 없습니다.</div>';
      return;
    }

    const circs = ['①', '②', '③', '④', '⑤'];

    filtered.forEach(q => {
      const card = document.createElement('div');
      card.className = `review-question-card ${q.isCorrect ? 'correct-card' : 'wrong-card'}`;

      let optionsHtml = '';
      (q.options || []).forEach((opt, idx) => {
        const optNum = idx + 1;
        let optClass = '';
        let badge = '';

        if (optNum === q.answer) {
          optClass = 'correct-opt';
          badge = ' <span class="badge badge-success">정답</span>';
        }
        if (optNum === q.userAnswer && optNum !== q.answer) {
          optClass = 'user-wrong-opt';
          badge = ' <span class="badge badge-danger">내가 선택한 오답</span>';
        }

        optionsHtml += `
          <div class="review-opt ${optClass}">
            <span>${circs[idx]} ${ExamEngine.formatMarkdown(opt)}</span>
            ${badge}
          </div>
        `;
      });

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <span class="badge ${q.isCorrect ? 'badge-success' : 'badge-danger'}">
              ${q.isCorrect ? '⭕ 정답' : '❌ 오답'}
            </span>
            <span class="badge badge-primary" style="margin-left:4px;">제${q.round || 1}회 ${q.id}번</span>
            <span class="badge badge-secondary" style="margin-left:4px;">${q.subject_name}</span>
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted);">
            내 선택: <strong>${q.userAnswer ? circs[q.userAnswer - 1] : '미표기'}</strong> / 정답: <strong style="color:var(--success);">${circs[q.answer - 1]}</strong>
          </div>
        </div>

        <div class="markdown-content" style="font-weight:600; line-height:1.6; margin-bottom:12px; color:var(--text-main);">
          ${ExamEngine.formatMarkdown(q.stem)}
        </div>

        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:14px;">
          ${optionsHtml}
        </div>

        <!-- Detailed Explanation Box -->
        <div class="review-explanation-box">
          <div style="font-weight:700; color:var(--primary); margin-bottom:6px;">📖 정답 및 심층 해설</div>
          <div style="font-size:0.9rem; line-height:1.6; margin-bottom:10px;">${ExamEngine.formatMarkdown(q.explanation || '해설이 없습니다.')}</div>

          ${q.distractor_exp ? `
            <div style="font-weight:700; color:var(--danger); margin-bottom:6px;">🔍 오답 반증 및 선지 분석</div>
            <div style="font-size:0.88rem; line-height:1.6; color:var(--text-muted); margin-bottom:10px;">${ExamEngine.formatMarkdown(q.distractor_exp)}</div>
          ` : ''}

          ${q.citation ? `
            <div style="font-size:0.8rem; color:var(--primary); background:var(--primary-light); padding:8px 12px; border-radius:var(--radius-sm);">
              <strong>출처 및 법령 근거:</strong> ${ExamEngine.formatMarkdown(q.citation)}
            </div>
          ` : ''}
        </div>
      `;

      container.appendChild(card);
    });
  },

  /**
   * 점수 화면에서 틀린 문제만 다시 풀기
   */
  retryWrongQuestions() {
    if (!this.lastResult || !this.lastResult.gradedQuestions) return;
    const wrongOnes = this.lastResult.gradedQuestions.filter(q => !q.isCorrect);
    if (wrongOnes.length === 0) {
      App.showToast('틀린 문제가 없습니다.');
      return;
    }

    ExamEngine.startExam({
      round: this.lastResult.round,
      mode: 'retry',
      title: `[제${this.lastResult.round || 1}회] 직전 모의고사 오답 복습 (${wrongOnes.length}문항)`,
      questions: wrongOnes,
      isInstantFeedback: true
    });
  }
};
