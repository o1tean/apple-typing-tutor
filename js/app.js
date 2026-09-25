/**
 * Apple-grade Typing Tutor - Application Controller
 */

import { CURRICULUM } from './lessons.js';
import { sound } from './audio.js';
import { KeyboardView } from './keyboard.js';
import { TypingEngine } from './engine.js';
import { storage } from './storage.js';

class AppController {
  constructor() {
    this.currentTrack = 'amateur'; // 'amateur', 'pro', 'speed', 'custom'
    this.currentLessonIndex = 0;
    this.currentLesson = null;
    this.currentLines = [];
    this.isTimedSpeedTest = false;
    this.speedDuration = 30; // default 30s

    this.initDOM();
    this.initKeyboard();
    this.initEngine();
    this.initSettings();
    this.initEvents();

    // Load initial lesson
    this.loadLesson(this.currentTrack, 0);
  }

  initDOM() {
    // Nav elements
    this.trackSelector = document.getElementById('track-selector');
    this.btnLessonsDrawer = document.getElementById('btn-lessons-drawer');
    this.btnSoundToggle = document.getElementById('btn-sound-toggle');
    this.btnThemeToggle = document.getElementById('btn-theme-toggle');
    this.btnSettings = document.getElementById('btn-settings');
    this.brandHome = document.getElementById('brand-home');

    // Lesson Card
    this.lessonBadge = document.getElementById('lesson-badge');
    this.lessonTitle = document.getElementById('lesson-title');
    this.lessonSubtitle = document.getElementById('lesson-subtitle');
    this.lessonStars = document.getElementById('lesson-stars');
    this.btnPrevLesson = document.getElementById('btn-prev-lesson');
    this.btnNextLesson = document.getElementById('btn-next-lesson');
    this.btnRestart = document.getElementById('btn-restart');

    // HUD
    this.metricWpm = document.getElementById('metric-wpm');
    this.metricAccuracy = document.getElementById('metric-accuracy');
    this.metricTime = document.getElementById('metric-time');
    this.metricTimeLabel = document.getElementById('metric-time-label');
    this.metricErrors = document.getElementById('metric-errors');
    this.modeTogglePill = document.getElementById('mode-toggle-pill');
    this.modeText = document.getElementById('mode-text');

    // Arena
    this.arena = document.getElementById('typing-arena');
    this.smoothCaret = document.getElementById('smooth-caret');
    this.linesWrapper = document.getElementById('typing-lines-wrapper');
    this.lineCounter = document.getElementById('line-counter');

    // Containers
    this.handsContainer = document.getElementById('hands-container');
    this.keyboardContainer = document.getElementById('keyboard-container');

    // Modals
    this.modalCompletion = document.getElementById('modal-completion');
    this.modalSettings = document.getElementById('modal-settings');
    this.modalCustomText = document.getElementById('modal-custom-text');
    this.drawerBackdrop = document.getElementById('curriculum-drawer-backdrop');
    this.drawerLessonList = document.getElementById('drawer-lesson-list');
    this.drawerCourseTitle = document.getElementById('drawer-course-title');

    // Sound icons
    this.iconSoundOn = document.getElementById('icon-sound-on');
    this.iconSoundOff = document.getElementById('icon-sound-off');
    this.iconThemeDark = document.getElementById('icon-theme-dark');
    this.iconThemeLight = document.getElementById('icon-theme-light');
  }

  initKeyboard() {
    this.keyboardView = new KeyboardView(
      this.keyboardContainer,
      this.handsContainer,
      document.getElementById('finger-hint-text')
    );
  }

  initEngine() {
    const typingMode = storage.getSetting('typingMode') || 'strict';
    this.updateModeUI(typingMode);

    this.engine = new TypingEngine({
      mode: typingMode,
      onCharTyped: (char, isCorrect, nextChar) => {
        this.renderActiveLineChars();
        this.updateCaretPosition();
        if (nextChar !== undefined) {
          this.keyboardView.highlightTarget(nextChar);
        }
      },
      onTick: (stats) => {
        this.updateHUD(stats);
      },
      onLineComplete: (lineIdx, totalLines) => {
        this.renderAllLines();
        this.updateCaretPosition();
        this.lineCounter.textContent = `Line ${Math.min(lineIdx + 1, totalLines)} / ${totalLines}`;
      },
      onComplete: (finalStats) => {
        this.handleLessonComplete(finalStats);
      },
      onError: (targetChar, typedChar) => {
        sound.playError();
        this.triggerArenaErrorVisual();
      }
    });
  }

  initSettings() {
    // Load and apply theme
    const savedTheme = storage.getSetting('theme') || 'dark';
    this.applyTheme(savedTheme);

    // Audio settings
    const savedMuted = storage.getSetting('soundMuted') || false;
    sound.setMuted(savedMuted);
    this.updateSoundIcon(savedMuted);

    const savedVolume = storage.getSetting('volume') !== undefined ? storage.getSetting('volume') : 0.6;
    sound.setVolume(savedVolume);
    const volumeSlider = document.getElementById('settings-volume');
    if (volumeSlider) {
      volumeSlider.value = Math.round(savedVolume * 100);
      document.getElementById('volume-val-label').textContent = `${Math.round(savedVolume * 100)}%`;
    }

    const savedProfile = storage.getSetting('soundProfile') || 'magic';
    sound.setProfile(savedProfile);
    document.querySelectorAll('#sound-profile-selector .segment-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.profile === savedProfile);
    });

    // Visibility toggles
    const showHands = storage.getSetting('showHands') !== false;
    const showKeyboard = storage.getSetting('showKeyboard') !== false;
    this.handsContainer.style.display = showHands ? 'flex' : 'none';
    this.keyboardContainer.style.display = showKeyboard ? 'flex' : 'none';
    document.getElementById('toggle-show-hands').checked = showHands;
    document.getElementById('toggle-show-keyboard').checked = showKeyboard;
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    storage.setSetting('theme', theme);
    if (theme === 'light') {
      this.iconThemeDark.style.display = 'none';
      this.iconThemeLight.style.display = 'block';
    } else {
      this.iconThemeDark.style.display = 'block';
      this.iconThemeLight.style.display = 'none';
    }
  }

  updateSoundIcon(isMuted) {
    if (isMuted) {
      this.iconSoundOn.style.display = 'none';
      this.iconSoundOff.style.display = 'block';
    } else {
      this.iconSoundOn.style.display = 'block';
      this.iconSoundOff.style.display = 'none';
    }
  }

  updateModeUI(mode) {
    if (mode === 'strict') {
      this.modeText.textContent = 'Strict Tutor (TypingMe)';
      this.modeTogglePill.querySelector('span:first-child').style.background = 'var(--accent-green)';
    } else {
      this.modeText.textContent = 'Fluid Flow Mode';
      this.modeTogglePill.querySelector('span:first-child').style.background = 'var(--accent-blue)';
    }
    document.querySelectorAll('#settings-mode-selector .segment-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.mode === mode);
    });
  }

  loadLesson(track, index) {
    this.currentTrack = track;
    this.currentLessonIndex = index;
    const lessonsList = CURRICULUM[track];

    if (!lessonsList || !lessonsList[index]) {
      this.loadLesson('amateur', 0);
      return;
    }

    this.currentLesson = lessonsList[index];
    this.isTimedSpeedTest = false;
    this.currentLines = [...this.currentLesson.lines];

    // Update Header Card
    this.lessonBadge.textContent = this.currentLesson.badge || `Lesson ${index + 1}`;
    this.lessonTitle.textContent = this.currentLesson.title;
    this.lessonSubtitle.textContent = this.currentLesson.subtitle || this.currentLesson.description;

    // Render stars from saved storage
    const progress = storage.getLessonProgress(this.currentLesson.id);
    this.renderLessonStars(progress ? progress.stars : 0);

    this.startExercise();
  }

  startExercise(duration = 0) {
    this.engine.loadExercise(this.currentLines, duration);
    this.renderAllLines();
    this.metricTimeLabel.textContent = duration ? 'Remaining' : 'Time';
    this.updateHUD(this.engine.getStats());
    this.lineCounter.textContent = `Line 1 / ${this.currentLines.length}`;
    this.trackSelector.querySelectorAll('.segment-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.track === this.currentTrack);
    });
    const lessons = CURRICULUM[this.currentTrack];
    this.btnPrevLesson.disabled = !lessons || this.currentLessonIndex === 0;
    this.btnNextLesson.disabled = !lessons || this.currentLessonIndex >= lessons.length - 1;
    this.closeDrawersAndModals();
    this.updateCaretPosition();
    this.keyboardView.highlightTarget(this.engine.getCurrentChar());
  }

  loadSpeedTest(seconds = 30) {
    this.currentTrack = 'speed';
    this.currentLesson = null;
    this.currentLessonIndex = 0;
    this.isTimedSpeedTest = true;
    this.speedDuration = seconds;

    // Generate random lines from speed words pool
    const lines = [];
    for (let l = 0; l < 4; l++) {
      const lineWords = Array.from({ length: 8 }, () => CURRICULUM.speedWords[Math.floor(Math.random() * CURRICULUM.speedWords.length)]);
      lines.push(lineWords.join(' '));
    }
    this.currentLines = lines;

    this.lessonBadge.textContent = 'Speed Test';
    this.lessonTitle.textContent = `${seconds}s Sprint Challenge`;
    this.lessonSubtitle.textContent = 'Type smoothly and accurately. The timer starts on your first keystroke.';
    this.lessonStars.innerHTML = '';

    this.startExercise(seconds);
  }

  loadCustomText(rawText) {
    const clean = rawText.trim().normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, '  ');
    if (!clean) return;

    // CSS wraps long lines without dropping indentation or creating empty exercises.
    const lines = clean.split('\n').filter(line => line.trim().length > 0);

    this.currentTrack = 'custom';
    this.currentLesson = null;
    this.currentLessonIndex = 0;
    this.isTimedSpeedTest = false;
    this.currentLines = lines;

    this.lessonBadge.textContent = 'Custom';
    this.lessonTitle.textContent = 'Custom Practice';
    this.lessonSubtitle.textContent = `Practicing ${lines.length} lines of custom text.`;
    this.lessonStars.innerHTML = '';

    this.startExercise();
  }

  renderLessonStars(count) {
    let html = '';
    for (let i = 1; i <= 3; i++) {
      if (i <= count) {
        html += '<span style="color:var(--accent-orange);margin-left:4px;font-size:14px;">★</span>';
      } else {
        html += '<span style="color:var(--text-disabled);margin-left:4px;font-size:14px;">☆</span>';
      }
    }
    this.lessonStars.innerHTML = html;
  }

  renderAllLines() {
    this.linesWrapper.innerHTML = '';
    const currentLineIdx = this.engine.currentLineIndex;

    this.currentLines.forEach((lineText, idx) => {
      const lineEl = document.createElement('div');
      lineEl.className = 'typing-line';
      lineEl.dataset.lineIndex = idx;

      if (idx < currentLineIdx) {
        lineEl.classList.add('completed');
        lineEl.textContent = lineText;
      } else if (idx === currentLineIdx) {
        lineEl.classList.add('active');
        // Render individual character spans for the active line
        const spansHtml = this.engine.typedChars.map((item, charIdx) => {
          const isSpace = item.char === ' ';
          const charDisplay = isSpace ? '&nbsp;' : this.escapeHtml(item.char);
          let statusClass = '';
          if (item.status === 'correct') statusClass = 'char-correct';
          else if (item.status === 'incorrect') statusClass = 'char-incorrect';

          return `<span class="char ${isSpace ? 'char-space' : ''} ${statusClass}" data-char-index="${charIdx}">${charDisplay}</span>`;
        }).join('');
        lineEl.innerHTML = spansHtml;
      } else {
        lineEl.textContent = lineText;
      }

      this.linesWrapper.appendChild(lineEl);
    });
  }

  renderActiveLineChars() {
    const activeLineEl = this.linesWrapper.querySelector('.typing-line.active');
    if (!activeLineEl) return;

    const charSpans = activeLineEl.querySelectorAll('.char');
    this.engine.typedChars.forEach((item, idx) => {
      const span = charSpans[idx];
      if (span) {
        span.className = `char ${item.char === ' ' ? 'char-space' : ''}`;
        if (item.status === 'correct') span.classList.add('char-correct');
        else if (item.status === 'incorrect') span.classList.add('char-incorrect');
      }
    });
  }

  updateCaretPosition() {
    const activeLineEl = this.linesWrapper.querySelector('.typing-line.active');
    if (!activeLineEl) {
      this.smoothCaret.hidden = true;
      return;
    }

    this.smoothCaret.hidden = this.engine.isComplete;
    const charIndex = this.engine.currentCharIndex;
    const charSpans = activeLineEl.querySelectorAll('.char');
    const targetSpan = charSpans[charIndex];

    const arenaRect = this.arena.getBoundingClientRect();

    if (targetSpan) {
      const spanRect = targetSpan.getBoundingClientRect();
      const left = spanRect.left - arenaRect.left;
      const top = spanRect.top - arenaRect.top + (spanRect.height - 28) / 2;

      this.smoothCaret.style.left = `${left}px`;
      this.smoothCaret.style.top = `${top}px`;
      this.smoothCaret.style.opacity = '1';
    } else if (charSpans.length > 0) {
      // Caret at end of line
      const lastSpan = charSpans[charSpans.length - 1];
      const spanRect = lastSpan.getBoundingClientRect();
      const left = spanRect.right - arenaRect.left;
      const top = spanRect.top - arenaRect.top + (spanRect.height - 28) / 2;

      this.smoothCaret.style.left = `${left}px`;
      this.smoothCaret.style.top = `${top}px`;
      this.smoothCaret.style.opacity = '1';
    }
  }

  updateHUD(stats) {
    this.metricWpm.innerHTML = `${stats.wpm} <span style="font-size:14px;font-weight:500;color:var(--text-tertiary)">WPM</span>`;
    this.metricAccuracy.innerHTML = `${stats.accuracy}<span style="font-size:14px;font-weight:500;color:var(--text-tertiary)">%</span>`;
    this.metricErrors.textContent = stats.errorKeystrokes;

    if (this.isTimedSpeedTest) {
      this.metricTime.innerHTML = `${stats.timeRemaining}<span style="font-size:14px;font-weight:500;color:var(--text-tertiary)">s</span>`;
    } else {
      this.metricTime.innerHTML = `${stats.elapsedSeconds}<span style="font-size:14px;font-weight:500;color:var(--text-tertiary)">s</span>`;
    }
  }

  triggerArenaErrorVisual() {
    this.arena.style.boxShadow = '0 0 0 3px rgba(255, 69, 58, 0.4)';
    setTimeout(() => {
      this.arena.style.boxShadow = '';
    }, 220);
  }

  handleLessonComplete(finalStats) {
    sound.playSuccess();

    this.updateHUD(finalStats);
    this.smoothCaret.hidden = true;
    this.keyboardView.highlightTarget(null);

    const lessonId = this.currentLesson?.id || (this.isTimedSpeedTest ? `speed-${this.speedDuration}` : 'custom');
    const result = storage.recordLesson(
      lessonId, finalStats, this.currentLesson?.targetWpm || 45, this.currentLesson?.targetAccuracy || 95
    );
    const starsEarned = result.stars;
    if (this.currentLesson) this.renderLessonStars(storage.getLessonProgress(lessonId).stars);
    const lessons = CURRICULUM[this.currentTrack];
    document.getElementById('modal-btn-next').textContent = lessons && this.currentLessonIndex < lessons.length - 1
      ? 'Next Lesson ➔' : 'Practice Again';
    document.getElementById('completion-title').textContent = this.isTimedSpeedTest ? 'Sprint Completed' : 'Lesson Completed';

    // Populate Modal Rings
    document.getElementById('modal-center-wpm').textContent = finalStats.wpm;
    document.getElementById('modal-stat-accuracy').textContent = `${finalStats.accuracy}%`;
    document.getElementById('modal-stat-time').textContent = `${finalStats.elapsedSeconds}s`;
    document.getElementById('modal-stat-consistency').textContent = `${finalStats.consistency}%`;

    // Activity Rings SVG stroke animations
    // Speed circumference: 2 * PI * 66 = 414.7
    // Accuracy circumference: 2 * PI * 50 = 314.1
    // Consistency circumference: 2 * PI * 34 = 213.6
    const targetWpm = (this.currentLesson && this.currentLesson.targetWpm) || 45;
    const speedRatio = Math.min(1.2, finalStats.wpm / targetWpm);
    const accRatio = finalStats.accuracy / 100;
    const constRatio = finalStats.consistency / 100;

    const ringSpeed = document.getElementById('ring-speed-stroke');
    const ringAcc = document.getElementById('ring-acc-stroke');
    const ringConst = document.getElementById('ring-const-stroke');

    ringSpeed.style.strokeDashoffset = 414.7;
    ringAcc.style.strokeDashoffset = 314.1;
    ringConst.style.strokeDashoffset = 213.6;

    setTimeout(() => {
      ringSpeed.style.strokeDashoffset = Math.max(0, 414.7 * (1 - speedRatio));
      ringAcc.style.strokeDashoffset = Math.max(0, 314.1 * (1 - accRatio));
      ringConst.style.strokeDashoffset = Math.max(0, 213.6 * (1 - constRatio));
    }, 150);

    // Render Modal Stars
    const starsContainer = document.getElementById('completion-stars');
    starsContainer.innerHTML = '';
    for (let s = 1; s <= 3; s++) {
      const star = document.createElement('span');
      star.style.fontSize = '32px';
      star.style.color = s <= starsEarned ? 'var(--accent-orange)' : 'var(--text-disabled)';
      star.style.filter = s <= starsEarned ? 'drop-shadow(0 2px 8px rgba(255, 159, 10, 0.4))' : 'none';
      star.textContent = s <= starsEarned ? '★' : '☆';
      starsContainer.appendChild(star);
    }

    // Problem keys breakdown
    const problemKeysEl = document.getElementById('modal-problem-keys');
    const errorKeys = Object.entries(finalStats.errorsByChar).sort((a, b) => b[1] - a[1]);
    if (errorKeys.length > 0) {
      const topErrors = errorKeys.slice(0, 3).map(([k, count]) => `"${k === ' ' ? 'Space' : k}" (${count}x)`).join(', ');
      problemKeysEl.textContent = `Focus Keys: Practice accuracy on ${topErrors}.`;
    } else {
      problemKeysEl.innerHTML = `<span style="color:var(--accent-green);font-weight:600;">Flawless Execution — Zero Errors!</span>`;
    }

    // Show modal
    this.openOverlay(this.modalCompletion);
  }

  openCurriculumDrawer() {
    const listEl = this.drawerLessonList;
    listEl.innerHTML = '';

    const courseTrack = this.currentTrack === 'pro' ? 'pro' : 'amateur';
    const courseLessons = CURRICULUM[courseTrack];
    this.drawerCourseTitle.textContent = this.currentTrack === 'pro' ? 'Pro Course Curriculum' : 'Amateur Touch Typing';

    courseLessons.forEach((lesson, idx) => {
      const itemEl = document.createElement('button');
      itemEl.className = 'lesson-list-item';
      if (idx === this.currentLessonIndex && this.currentTrack !== 'speed' && this.currentTrack !== 'custom') {
        itemEl.classList.add('active');
      }

      const progress = storage.getLessonProgress(lesson.id);
      let starsHtml = '';
      if (progress && progress.stars) {
        starsHtml = '★'.repeat(progress.stars) + '☆'.repeat(3 - progress.stars);
      }

      itemEl.innerHTML = `
        <div class="item-left">
          <span class="item-title">${lesson.title}</span>
          <span class="item-sub">${lesson.subtitle || ''}</span>
        </div>
        <div class="item-right">
          ${progress ? `<span style="font-size:11px;color:var(--accent-blue);">${progress.bestWpm} WPM</span>` : ''}
          <span class="item-stars">${starsHtml}</span>
        </div>
      `;

      itemEl.addEventListener('click', () => {
        this.loadLesson(courseTrack, idx);
        this.closeDrawersAndModals();
      });

      listEl.appendChild(itemEl);
    });

    this.openOverlay(this.drawerBackdrop);
  }

  openOverlay(overlay) {
    this.engine.pause();
    // Pausing at the deadline may open the completion dialog instead.
    if (this.modalCompletion.open && overlay !== this.modalCompletion) return;
    overlay.showModal();
    overlay.classList.add('open');
    (overlay.querySelector('textarea') || overlay.querySelector('button'))?.focus();
  }

  closeDrawersAndModals() {
    [this.drawerBackdrop, this.modalCompletion, this.modalSettings, this.modalCustomText].forEach(overlay => {
      overlay.classList.remove('open');
      overlay.close();
    });
    if (!document.hidden) this.engine.resume();
    this.arena.focus();
  }

  initEvents() {
    // Physical Keyboard Listeners
    window.addEventListener('keydown', (e) => {
      const restartWasFocusedByTab = this.restartWasFocusedByTab;
      this.restartWasFocusedByTab = false;
      if (restartWasFocusedByTab && e.key === 'Tab' && !e.shiftKey && document.activeElement === this.btnRestart) {
        e.preventDefault();
        this.brandHome.focus();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (document.querySelector('dialog[open]')) this.closeDrawersAndModals();
        else this.openCurriculumDrawer();
        return;
      }

      if (!document.querySelector('dialog[open]') &&
          (document.activeElement === this.arena || document.activeElement === document.body)) {
        this.keyboardView.pressKey(e.code);
        this.keyboardView.setCapsLock(e.getModifierState?.('CapsLock') || false);
      }
      if (e.metaKey || ((e.ctrlKey || e.altKey) && !e.getModifierState?.('AltGraph')) || e.isComposing) return;
      if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'Enter' && e.shiftKey && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        this.restartCurrent();
        return;
      }
      if (document.querySelector('dialog[open]')) return;
      if (document.activeElement !== this.arena && document.activeElement !== document.body) return;

      // Tab then Enter uses the restart button's native keyboard behavior.
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        this.restartWasFocusedByTab = true;
        this.btnRestart.focus();
        return;
      }

      if (Array.from(e.key).length === 1 || e.key === 'Backspace') {
        e.preventDefault();
        if (!this.engine.isComplete && !this.engine.isPaused) sound.playKey();
        this.engine.handleKey(e);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keyboardView.releaseKey(e.code);
      if (e.getModifierState && e.getModifierState('CapsLock') !== this.keyboardView.capsLockActive) {
        this.keyboardView.setCapsLock(e.getModifierState('CapsLock'));
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.engine.pause();
      else if (!document.querySelector('dialog[open]')) this.engine.resume();
      this.keyboardContainer.querySelectorAll('.key-pressed').forEach(key => key.classList.remove('key-pressed'));
    });
    [this.drawerBackdrop, this.modalCompletion, this.modalSettings, this.modalCustomText].forEach(overlay => {
      overlay.addEventListener('cancel', e => {
        e.preventDefault();
        this.closeDrawersAndModals();
      });
    });

    // Window resize -> reposition caret smoothly
    window.addEventListener('resize', () => {
      this.updateCaretPosition();
    });

    // Track Navigation (Amateur, Pro, Speed Test, Custom)
    this.trackSelector.querySelectorAll('.segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const track = btn.dataset.track;
        if (track === 'amateur' || track === 'pro') {
          this.loadLesson(track, 0);
        } else if (track === 'speed') {
          this.loadSpeedTest(30);
        } else if (track === 'custom') {
          this.openOverlay(this.modalCustomText);
        }
      });
    });

    // Brand Home click
    this.brandHome.addEventListener('click', () => {
      this.loadLesson('amateur', 0);
    });

    // Restart button
    this.btnRestart.addEventListener('click', () => {
      this.restartCurrent();
    });

    // Prev / Next Lesson
    this.btnPrevLesson.addEventListener('click', () => {
      if (this.currentLessonIndex > 0) {
        this.loadLesson(this.currentTrack, this.currentLessonIndex - 1);
      }
    });

    this.btnNextLesson.addEventListener('click', () => {
      const list = CURRICULUM[this.currentTrack];
      if (list && this.currentLessonIndex < list.length - 1) {
        this.loadLesson(this.currentTrack, this.currentLessonIndex + 1);
      }
    });

    // Mode Toggle Pill (Strict vs Flow)
    this.modeTogglePill.addEventListener('click', () => {
      const currentMode = this.engine.mode;
      const newMode = currentMode === 'strict' ? 'flow' : 'strict';
      this.engine.mode = newMode;
      storage.setSetting('typingMode', newMode);
      this.updateModeUI(newMode);
    });

    // Sound Toggle
    this.btnSoundToggle.addEventListener('click', () => {
      const newMuted = !sound.isMuted;
      sound.setMuted(newMuted);
      storage.setSetting('soundMuted', newMuted);
      this.updateSoundIcon(newMuted);
    });

    // Theme Toggle
    this.btnThemeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      this.applyTheme(newTheme);
    });

    // Drawer Buttons
    this.btnLessonsDrawer.addEventListener('click', () => {
      this.openCurriculumDrawer();
    });

    document.getElementById('btn-close-drawer').addEventListener('click', () => {
      this.closeDrawersAndModals();
    });

    this.drawerBackdrop.addEventListener('click', (e) => {
      if (e.target === this.drawerBackdrop) {
        this.closeDrawersAndModals();
      }
    });

    // Settings Modal
    this.btnSettings.addEventListener('click', () => {
      this.openOverlay(this.modalSettings);
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
      this.closeDrawersAndModals();
    });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
      this.closeDrawersAndModals();
    });

    // Volume Slider
    document.getElementById('settings-volume').addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      document.getElementById('volume-val-label').textContent = `${val}%`;
      sound.setVolume(val / 100);
      storage.setSetting('volume', val / 100);
    });

    // Sound Profile Buttons
    document.querySelectorAll('#sound-profile-selector .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#sound-profile-selector .segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const profile = btn.dataset.profile;
        sound.setProfile(profile);
        storage.setSetting('soundProfile', profile);
        sound.playKey(); // preview sound
      });
    });

    // Mode Selector in Settings
    document.querySelectorAll('#settings-mode-selector .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.engine.mode = mode;
        storage.setSetting('typingMode', mode);
        this.updateModeUI(mode);
      });
    });

    // Visibility toggles in Settings
    document.getElementById('toggle-show-hands').addEventListener('change', (e) => {
      const checked = e.target.checked;
      this.handsContainer.style.display = checked ? 'flex' : 'none';
      storage.setSetting('showHands', checked);
    });

    document.getElementById('toggle-show-keyboard').addEventListener('change', (e) => {
      const checked = e.target.checked;
      this.keyboardContainer.style.display = checked ? 'flex' : 'none';
      storage.setSetting('showKeyboard', checked);
    });

    // Completion Modal Buttons
    document.getElementById('modal-btn-retry').addEventListener('click', () => {
      this.closeDrawersAndModals();
      this.restartCurrent();
    });

    document.getElementById('modal-btn-next').addEventListener('click', () => {
      this.closeDrawersAndModals();
      const list = CURRICULUM[this.currentTrack];
      if (list && this.currentLessonIndex < list.length - 1) {
        this.loadLesson(this.currentTrack, this.currentLessonIndex + 1);
      } else {
        this.restartCurrent();
      }
    });

    // Custom Text Modal
    document.getElementById('btn-close-custom').addEventListener('click', () => {
      this.closeDrawersAndModals();
    });

    document.getElementById('btn-load-steve-jobs').addEventListener('click', () => {
      const quote = CURRICULUM.quotes[0].text;
      document.getElementById('custom-text-input').value = quote;
    });

    document.getElementById('btn-apply-custom-text').addEventListener('click', () => {
      const text = document.getElementById('custom-text-input').value;
      if (text.trim()) {
        this.loadCustomText(text);
        this.closeDrawersAndModals();
      }
    });

    // Ensure typing arena stays focused
    this.arena.addEventListener('click', () => {
      this.arena.focus();
    });
  }

  restartCurrent() {
    if (this.isTimedSpeedTest) {
      this.loadSpeedTest(this.speedDuration);
    } else if (this.currentTrack === 'custom') {
      this.loadCustomText(this.currentLines.join('\n'));
    } else {
      this.loadLesson(this.currentTrack, this.currentLessonIndex);
    }
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.typeFlowApp = new AppController();
});
