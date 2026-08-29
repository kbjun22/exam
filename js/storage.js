/**
 * 2026 청소년상담사 1급 CBT - 로컬 스토리지 데이터 매니저 (Offline Persistence & Multi-Round)
 */
const StorageManager = {
  KEYS: {
    AUTH: 'cbt_auth_state',
    THEME: 'cbt_theme',
    FONT_SIZE: 'cbt_font_size',
    SELECTED_ROUND: 'cbt_selected_round',
    ACTIVE_SESSION: 'cbt_active_session',
    HISTORY: 'cbt_history',
    WRONG_NOTES: 'cbt_wrong_notes',
    BOOKMARKS: 'cbt_bookmarks'
  },

  // Authentication Gate
  isAuthenticated() {
    return localStorage.getItem(this.KEYS.AUTH) === 'true' || sessionStorage.getItem(this.KEYS.AUTH) === 'true';
  },
  setAuthenticated(remember = true) {
    if (remember) {
      localStorage.setItem(this.KEYS.AUTH, 'true');
    } else {
      sessionStorage.setItem(this.KEYS.AUTH, 'true');
    }
  },
  clearAuth() {
    localStorage.removeItem(this.KEYS.AUTH);
    sessionStorage.removeItem(this.KEYS.AUTH);
  },

  // Multi-Round Selection
  getSelectedRound() {
    try {
      const saved = localStorage.getItem(this.KEYS.SELECTED_ROUND);
      return saved ? parseInt(saved, 10) : 2; // Default to Round 2 (latest)
    } catch (e) {
      return 2;
    }
  },
  setSelectedRound(roundId) {
    localStorage.setItem(this.KEYS.SELECTED_ROUND, roundId.toString());
  },

  // Settings
  getTheme() {
    return localStorage.getItem(this.KEYS.THEME) || 'light';
  },
  setTheme(theme) {
    localStorage.setItem(this.KEYS.THEME, theme);
  },

  getFontSize() {
    return localStorage.getItem(this.KEYS.FONT_SIZE) || 'md';
  },
  setFontSize(size) {
    localStorage.setItem(this.KEYS.FONT_SIZE, size);
  },

  // Active Session (for resuming upon refresh/crash)
  saveActiveSession(sessionData) {
    try {
      localStorage.setItem(this.KEYS.ACTIVE_SESSION, JSON.stringify(sessionData));
    } catch (e) {
      console.warn('Failed to save active session', e);
    }
  },
  getActiveSession() {
    try {
      const data = localStorage.getItem(this.KEYS.ACTIVE_SESSION);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },
  clearActiveSession() {
    localStorage.removeItem(this.KEYS.ACTIVE_SESSION);
  },

  // Exam History
  getHistory() {
    try {
      const data = localStorage.getItem(this.KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },
  saveHistoryItem(item) {
    const history = this.getHistory();
    history.unshift({
      id: 'hist_' + Date.now(),
      date: new Date().toISOString(),
      ...item
    });
    // Keep last 50 tests
    const trimmed = history.slice(0, 50);
    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(trimmed));
  },
  clearHistory() {
    localStorage.removeItem(this.KEYS.HISTORY);
  },

  // Wrong Answers Database (Multi-Round Aware with uniqueId)
  getWrongNotes() {
    try {
      const data = localStorage.getItem(this.KEYS.WRONG_NOTES);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  },
  addWrongQuestions(wrongList) {
    const db = this.getWrongNotes();
    const now = new Date().toISOString();
    
    wrongList.forEach(item => {
      const uniqueKey = item.uniqueId || `r${item.round || 1}_q${item.id}`;
      if (!db[uniqueKey]) {
        db[uniqueKey] = {
          uniqueId: uniqueKey,
          id: item.id,
          round: item.round || 1,
          subject_id: item.subject_id,
          subject_name: item.subject_name,
          stem: item.stem || '',
          options: item.options || [],
          explanation: item.explanation || '',
          distractor_exp: item.distractor_exp || '',
          citation: item.citation || '',
          wrongCount: 1,
          lastWrongDate: now,
          mastered: false,
          userNote: '',
          lastSelectedAnswer: item.userAnswer,
          correctAnswer: item.answer
        };
      } else {
        db[uniqueKey].wrongCount += 1;
        db[uniqueKey].lastWrongDate = now;
        db[uniqueKey].mastered = false;
        db[uniqueKey].lastSelectedAnswer = item.userAnswer;
      }
    });

    localStorage.setItem(this.KEYS.WRONG_NOTES, JSON.stringify(db));
  },
  markWrongNoteMastered(uniqueKey, mastered = true) {
    const db = this.getWrongNotes();
    if (db[uniqueKey]) {
      db[uniqueKey].mastered = mastered;
      localStorage.setItem(this.KEYS.WRONG_NOTES, JSON.stringify(db));
    }
  },
  saveUserNote(uniqueKey, note) {
    const db = this.getWrongNotes();
    if (db[uniqueKey]) {
      db[uniqueKey].userNote = note;
      localStorage.setItem(this.KEYS.WRONG_NOTES, JSON.stringify(db));
    }
  },
  removeWrongNote(uniqueKey) {
    const db = this.getWrongNotes();
    delete db[uniqueKey];
    localStorage.setItem(this.KEYS.WRONG_NOTES, JSON.stringify(db));
  },

  // Bookmarks
  getBookmarks() {
    try {
      const data = localStorage.getItem(this.KEYS.BOOKMARKS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },
  toggleBookmark(uniqueKey) {
    let list = this.getBookmarks();
    const idx = list.indexOf(uniqueKey);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(uniqueKey);
    }
    localStorage.setItem(this.KEYS.BOOKMARKS, JSON.stringify(list));
    return list.includes(uniqueKey);
  },
  isBookmarked(uniqueKey) {
    const list = this.getBookmarks();
    return list.includes(uniqueKey);
  }
};
