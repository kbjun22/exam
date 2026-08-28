/**
 * 2026 청소년상담사 1급 CBT - 로컬 스토리지 데이터 매니저 (Offline Persistence)
 */
const StorageManager = {
  KEYS: {
    THEME: 'cbt_theme',
    FONT_SIZE: 'cbt_font_size',
    ACTIVE_SESSION: 'cbt_active_session',
    HISTORY: 'cbt_history',
    WRONG_NOTES: 'cbt_wrong_notes',
    BOOKMARKS: 'cbt_bookmarks'
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
    // Keep last 30 tests
    const trimmed = history.slice(0, 30);
    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(trimmed));
  },
  clearHistory() {
    localStorage.removeItem(this.KEYS.HISTORY);
  },

  // Wrong Answers Database
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
      const qId = item.id;
      if (!db[qId]) {
        db[qId] = {
          id: qId,
          subject_id: item.subject_id,
          subject_name: item.subject_name,
          wrongCount: 1,
          lastWrongDate: now,
          mastered: false,
          userNote: '',
          lastSelectedAnswer: item.userAnswer,
          correctAnswer: item.answer
        };
      } else {
        db[qId].wrongCount += 1;
        db[qId].lastWrongDate = now;
        db[qId].mastered = false;
        db[qId].lastSelectedAnswer = item.userAnswer;
      }
    });

    localStorage.setItem(this.KEYS.WRONG_NOTES, JSON.stringify(db));
  },
  markWrongNoteMastered(qId, mastered = true) {
    const db = this.getWrongNotes();
    if (db[qId]) {
      db[qId].mastered = mastered;
      localStorage.setItem(this.KEYS.WRONG_NOTES, JSON.stringify(db));
    }
  },
  saveUserNote(qId, note) {
    const db = this.getWrongNotes();
    if (db[qId]) {
      db[qId].userNote = note;
      localStorage.setItem(this.KEYS.WRONG_NOTES, JSON.stringify(db));
    }
  },
  removeWrongNote(qId) {
    const db = this.getWrongNotes();
    delete db[qId];
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
  toggleBookmark(qId) {
    let list = this.getBookmarks();
    const idx = list.indexOf(qId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(qId);
    }
    localStorage.setItem(this.KEYS.BOOKMARKS, JSON.stringify(list));
    return list.includes(qId);
  },
  isBookmarked(qId) {
    const list = this.getBookmarks();
    return list.includes(qId);
  }
};
