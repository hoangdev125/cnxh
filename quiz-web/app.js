(() => {
  const CHAPTERS = window.CNXH_CHAPTERS || [];
  const QUESTIONS = window.CNXH_QUESTIONS || [];
  const STORAGE_KEY = "cnxh_quiz_state_v1";

  // Persistent user state
  let userState = loadState();
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          wrongIds: Array.isArray(parsed.wrongIds) ? parsed.wrongIds : [],
          bookmarkedIds: Array.isArray(parsed.bookmarkedIds) ? parsed.bookmarkedIds : [],
          theme: parsed.theme || "light"
        };
      }
    } catch (_) {}
    return { wrongIds: [], bookmarkedIds: [], theme: "light" };
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
    } catch (_) {}
  }

  // Helpers
  const $ = (id) => document.getElementById(id);
  const LETTERS = ["A", "B", "C", "D"];

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getChapterTitle(chId) {
    const c = CHAPTERS.find((x) => x.id === chId);
    return c ? c.title : `Chương ${chId}`;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // Theme
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", userState.theme);
    $("themeIcon").textContent = userState.theme === "dark" ? "☀️" : "🌙";
  }
  $("themeToggle").addEventListener("click", () => {
    userState.theme = userState.theme === "dark" ? "light" : "dark";
    saveState();
    applyTheme();
  });
  applyTheme();

  // Navigation Tabs
  let activeView = "quiz";
  function switchView(viewName) {
    activeView = viewName;
    document.querySelectorAll(".nav-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === viewName);
    });
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("active", v.id === `view-${viewName}`);
    });
    if (viewName === "quiz") {
      updateStats();
      renderChapterList();
    } else if (viewName === "bank") {
      renderBank();
    }
  }

  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
  $("brandHome").addEventListener("click", () => {
    showQuizScreen("setup");
    switchView("quiz");
  });

  // ==================== QUIZ SETUP ====================
  let selectedScope = "all"; // 'all' | 'wrong' | 'bookmarked' | chapter id
  let selectedCount = "20"; // '10' | '20' | '40' | 'all'

  function updateStats() {
    $("stat-total").textContent = QUESTIONS.length;
    $("stat-wrong").textContent = userState.wrongIds.length;
    $("stat-bookmarked").textContent = userState.bookmarkedIds.length;
  }

  function getQuestionsByScope(scope) {
    if (scope === "all") return QUESTIONS.slice();
    if (scope === "wrong") return QUESTIONS.filter((q) => userState.wrongIds.includes(q.id));
    if (scope === "bookmarked") return QUESTIONS.filter((q) => userState.bookmarkedIds.includes(q.id));
    return QUESTIONS.filter((q) => q.chapter === Number(scope));
  }

  function renderChapterList() {
    const container = $("chapterList");
    container.innerHTML = "";

    const items = [
      { key: "all", label: "Tất cả 7 chương (Tổng hợp)", count: QUESTIONS.length },
      { key: "wrong", label: "Ôn lại các câu làm sai", count: userState.wrongIds.length },
      { key: "bookmarked", label: "Ôn lại các câu đã đánh dấu", count: userState.bookmarkedIds.length },
      ...CHAPTERS.map((c) => ({
        key: String(c.id),
        label: c.title,
        count: QUESTIONS.filter((q) => q.chapter === c.id).length
      }))
    ];

    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isDisabled = item.count === 0;
      btn.className = `chapter-item${String(selectedScope) === item.key ? " active" : ""}${isDisabled ? " disabled" : ""}`;
      btn.disabled = isDisabled;
      btn.innerHTML = `<span>${item.label}</span><span class="chapter-count">${item.count} câu</span>`;
      btn.addEventListener("click", () => {
        selectedScope = item.key;
        renderChapterList();
      });
      container.appendChild(btn);
    });
  }

  document.querySelectorAll("#countPills .pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedCount = btn.dataset.count;
      document.querySelectorAll("#countPills .pill").forEach((b) =>
        b.classList.toggle("active", b.dataset.count === selectedCount)
      );
    });
  });

  $("btnResetStats").addEventListener("click", () => {
    if (confirm("Bạn có chắc muốn xóa toàn bộ lịch sử câu sai và câu đã đánh dấu?")) {
      userState.wrongIds = [];
      userState.bookmarkedIds = [];
      saveState();
      if (selectedScope === "wrong" || selectedScope === "bookmarked") selectedScope = "all";
      updateStats();
      renderChapterList();
    }
  });

  // ==================== ACTIVE QUIZ ====================
  let quizSession = null;

  function showQuizScreen(screen) {
    $("quiz-setup").classList.toggle("hidden", screen !== "setup");
    $("quiz-active").classList.toggle("hidden", screen !== "active");
    $("quiz-result").classList.toggle("hidden", screen !== "result");
  }

  function startQuiz({ scope, count, shuffleQ, shuffleA }) {
    let pool = getQuestionsByScope(scope);
    if (!pool.length) {
      alert("Không có câu hỏi nào trong phạm vi này.");
      return;
    }
    if (shuffleQ) pool = shuffle(pool);
    if (count !== "all") {
      pool = pool.slice(0, Math.min(Number(count), pool.length));
    }

    const items = pool.map((q) => {
      const indexedOpts = q.options.map((text, idx) => ({ text, isCorrect: idx === q.answer }));
      const finalOpts = shuffleA ? shuffle(indexedOpts) : indexedOpts;
      const correctIdx = finalOpts.findIndex((o) => o.isCorrect);
      return {
        ...q,
        displayOptions: finalOpts.map((o) => o.text),
        correctIdx,
        chosenIdx: null
      };
    });

    quizSession = {
      scope,
      items,
      currentIndex: 0,
      startedAt: Date.now(),
      submitted: false
    };

    showQuizScreen("active");
    renderCurrentQuestion();
  }

  $("btnStartQuiz").addEventListener("click", () => {
    startQuiz({
      scope: selectedScope,
      count: selectedCount,
      shuffleQ: $("optShuffleQ").checked,
      shuffleA: $("optShuffleA").checked
    });
  });

  function renderCurrentQuestion() {
    if (!quizSession) return;
    const { items, currentIndex } = quizSession;
    const q = items[currentIndex];
    const total = items.length;

    $("quizCounter").textContent = `Câu ${currentIndex + 1} / ${total}`;
    const answered = items.filter((it) => it.chosenIdx !== null).length;
    $("answeredCount").textContent = `${answered}/${total} đã chọn`;
    $("quizProgressFill").style.width = `${((currentIndex + 1) / total) * 100}%`;

    $("qChapterTag").textContent = getChapterTitle(q.chapter);
    $("qText").textContent = `Câu ${currentIndex + 1}: ${q.question}`;

    const isBookmarked = userState.bookmarkedIds.includes(q.id);
    const bmBtn = $("btnBookmarkQ");
    bmBtn.classList.toggle("active", isBookmarked);
    bmBtn.textContent = isBookmarked ? "★ Đã đánh dấu" : "☆ Đánh dấu";

    const optList = $("optionsList");
    optList.innerHTML = "";

    const isAnswered = q.chosenIdx !== null;

    q.displayOptions.forEach((optText, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";

      if (isAnswered) {
        btn.disabled = true;
        if (idx === q.correctIdx) btn.classList.add("correct");
        else if (idx === q.chosenIdx) btn.classList.add("wrong");
      }

      btn.innerHTML = `<span class="option-key">${LETTERS[idx]}</span><span>${optText}</span>`;
      btn.addEventListener("click", () => selectOption(idx));
      optList.appendChild(btn);
    });

    const fb = $("qFeedback");
    if (isAnswered) {
      fb.classList.remove("hidden", "ok", "err");
      if (q.chosenIdx === q.correctIdx) {
        fb.classList.add("ok");
        fb.textContent = "✓ Chính xác!";
      } else {
        fb.classList.add("err");
        fb.textContent = `✕ Chưa đúng. Đáp án đúng là ${LETTERS[q.correctIdx]}: ${q.displayOptions[q.correctIdx]}`;
      }
    } else {
      fb.classList.add("hidden");
    }

    $("btnPrevQ").disabled = currentIndex === 0;
    $("btnNextQ").textContent = currentIndex === total - 1 ? "Nộp bài ✓" : "Câu tiếp →";

    renderNavigator();
  }

  function selectOption(optIdx) {
    if (!quizSession || quizSession.submitted) return;
    const q = quizSession.items[quizSession.currentIndex];
    if (q.chosenIdx !== null) return;

    q.chosenIdx = optIdx;
    updateWrongHistory(q.id, optIdx === q.correctIdx);
    renderCurrentQuestion();
  }

  function updateWrongHistory(qId, isCorrect) {
    const idx = userState.wrongIds.indexOf(qId);
    if (isCorrect && idx !== -1) {
      userState.wrongIds.splice(idx, 1);
      saveState();
    } else if (!isCorrect && idx === -1) {
      userState.wrongIds.push(qId);
      saveState();
    }
  }

  function renderNavigator() {
    const grid = $("navGrid");
    grid.innerHTML = "";
    const { items, currentIndex } = quizSession;

    items.forEach((it, i) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "nav-cell";
      cell.textContent = i + 1;

      if (i === currentIndex) cell.classList.add("current");
      if (it.chosenIdx !== null) {
        cell.classList.add(it.chosenIdx === it.correctIdx ? "correct" : "wrong");
      }
      if (userState.bookmarkedIds.includes(it.id)) cell.classList.add("bookmarked");

      cell.addEventListener("click", () => {
        quizSession.currentIndex = i;
        renderCurrentQuestion();
      });
      grid.appendChild(cell);
    });
  }

  $("btnPrevQ").addEventListener("click", () => {
    if (quizSession && quizSession.currentIndex > 0) {
      quizSession.currentIndex -= 1;
      renderCurrentQuestion();
    }
  });

  $("btnNextQ").addEventListener("click", () => {
    if (!quizSession) return;
    if (quizSession.currentIndex < quizSession.items.length - 1) {
      quizSession.currentIndex += 1;
      renderCurrentQuestion();
    } else {
      confirmSubmitQuiz();
    }
  });

  $("btnBookmarkQ").addEventListener("click", () => {
    if (!quizSession) return;
    toggleBookmark(quizSession.items[quizSession.currentIndex].id);
    renderCurrentQuestion();
  });

  function toggleBookmark(qId) {
    const idx = userState.bookmarkedIds.indexOf(qId);
    if (idx === -1) userState.bookmarkedIds.push(qId);
    else userState.bookmarkedIds.splice(idx, 1);
    saveState();
  }

  $("btnExitQuiz").addEventListener("click", () => {
    if (confirm("Thoát bài làm hiện tại và quay về màn hình chọn?")) {
      quizSession = null;
      updateStats();
      renderChapterList();
      showQuizScreen("setup");
    }
  });

  function confirmSubmitQuiz() {
    if (!quizSession) return;
    const unanswered = quizSession.items.filter((it) => it.chosenIdx === null).length;
    if (unanswered > 0) {
      if (!confirm(`Bạn còn ${unanswered} câu chưa chọn đáp án. Bạn vẫn muốn nộp bài?`)) return;
    }
    finishQuiz();
  }

  $("btnSubmitQuiz").addEventListener("click", confirmSubmitQuiz);

  // ==================== RESULTS ====================
  let reviewFilter = "all";

  function finishQuiz() {
    if (!quizSession) return;
    quizSession.submitted = true;

    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    quizSession.items.forEach((it) => {
      if (it.chosenIdx === null) {
        skipped += 1;
        updateWrongHistory(it.id, false);
      } else if (it.chosenIdx === it.correctIdx) {
        correct += 1;
        updateWrongHistory(it.id, true);
      } else {
        wrong += 1;
        updateWrongHistory(it.id, false);
      }
    });

    const total = quizSession.items.length;
    const score10 = ((correct / total) * 10).toFixed(1);
    const pct = Math.round((correct / total) * 100);
    const elapsedSec = Math.max(1, Math.round((Date.now() - quizSession.startedAt) / 1000));

    $("resScore10").textContent = score10;
    $("resTitle").textContent =
      pct >= 85 ? "Xuất sắc! Bạn nắm bài rất chắc!" :
      pct >= 65 ? "Khá tốt! Cố gắng thêm chút nữa nhé!" :
      "Cần ôn tập thêm ở các câu sai!";
    $("resSubtitle").textContent = `Bạn trả lời đúng ${correct}/${total} câu (${pct}%).`;
    $("resCorrect").textContent = `Đúng: ${correct}`;
    $("resWrong").textContent = `Sai: ${wrong}`;
    $("resSkipped").textContent = `Chưa làm: ${skipped}`;
    $("resTime").textContent = `Thời gian: ${formatTime(elapsedSec)}`;

    const wrongInSession = quizSession.items.filter((it) => it.chosenIdx !== it.correctIdx);
    $("btnRetryWrong").classList.toggle("hidden", wrongInSession.length === 0);

    reviewFilter = "all";
    document.querySelectorAll("#reviewFilters .pill").forEach((b) =>
      b.classList.toggle("active", b.dataset.rfilter === "all")
    );
    renderReviewList();
    showQuizScreen("result");
  }

  function renderReviewList() {
    const list = $("reviewList");
    list.innerHTML = "";
    const filtered = quizSession.items.filter((it) => {
      const isOk = it.chosenIdx === it.correctIdx;
      if (reviewFilter === "wrong") return !isOk;
      if (reviewFilter === "correct") return isOk;
      return true;
    });

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state">Không có câu hỏi nào trong mục này.</div>`;
      return;
    }

    filtered.forEach((it) => {
      const idxInQuiz = quizSession.items.indexOf(it) + 1;
      const isOk = it.chosenIdx === it.correctIdx;
      const div = document.createElement("div");
      div.className = "review-item";
      const chosenText =
        it.chosenIdx === null
          ? "Chưa chọn đáp án"
          : `${LETTERS[it.chosenIdx]}. ${it.displayOptions[it.chosenIdx]}`;
      const correctText = `${LETTERS[it.correctIdx]}. ${it.displayOptions[it.correctIdx]}`;

      div.innerHTML = `
        <div class="q-top" style="margin-bottom:4px;">
          <span class="chapter-tag">${getChapterTitle(it.chapter)}</span>
          <span class="badge ${isOk ? "badge-success" : "badge-danger"}">${isOk ? "Đúng" : "Sai"}</span>
        </div>
        <div class="review-q">Câu ${idxInQuiz}: ${it.question}</div>
        <div class="review-ans">
          <div class="${isOk ? "ans-ok" : "ans-err"}">Bạn chọn: ${chosenText}</div>
          ${!isOk ? `<div class="ans-ok">Đáp án đúng: ${correctText}</div>` : ""}
        </div>
      `;
      list.appendChild(div);
    });
  }

  document.querySelectorAll("#reviewFilters .pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      reviewFilter = btn.dataset.rfilter;
      document.querySelectorAll("#reviewFilters .pill").forEach((b) =>
        b.classList.toggle("active", b.dataset.rfilter === reviewFilter)
      );
      renderReviewList();
    });
  });

  $("btnRetryWrong").addEventListener("click", () => {
    if (!quizSession) return;
    const wrongIds = quizSession.items
      .filter((it) => it.chosenIdx !== it.correctIdx)
      .map((it) => it.id);
    const pool = QUESTIONS.filter((q) => wrongIds.includes(q.id));
    if (!pool.length) return;
    const items = shuffle(pool).map((q) => {
      const opts = shuffle(q.options.map((text, idx) => ({ text, isCorrect: idx === q.answer })));
      return {
        ...q,
        displayOptions: opts.map((o) => o.text),
        correctIdx: opts.findIndex((o) => o.isCorrect),
        chosenIdx: null
      };
    });
    quizSession = {
      scope: "wrong",
      items,
      currentIndex: 0,
      startedAt: Date.now(),
      submitted: false
    };
    showQuizScreen("active");
    renderCurrentQuestion();
  });

  $("btnRetrySame").addEventListener("click", () => {
    if (!quizSession) return;
    startQuiz({
      scope: quizSession.scope,
      count: String(quizSession.items.length),
      shuffleQ: true,
      shuffleA: true
    });
  });

  $("btnBackHome").addEventListener("click", () => {
    quizSession = null;
    updateStats();
    renderChapterList();
    showQuizScreen("setup");
  });

  // ==================== QUESTION BANK ====================
  function populateChapterSelects() {
    const sel = $("bankChapterSelect");
    CHAPTERS.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = String(c.id);
      opt.textContent = c.title;
      sel.appendChild(opt);
    });
  }

  function renderBank() {
    const query = $("bankSearch").value.trim().toLowerCase();
    const chVal = $("bankChapterSelect").value;
    const showAns = $("bankShowAnswers").checked;

    const filtered = QUESTIONS.filter((q) => {
      if (chVal !== "all" && q.chapter !== Number(chVal)) return false;
      if (query) {
        const hay = `${q.question} ${q.options[q.answer]}`.toLowerCase();
        return hay.includes(query);
      }
      return true;
    });

    $("bankCount").textContent = `Hiển thị ${filtered.length} / ${QUESTIONS.length} câu hỏi`;
    const list = $("bankList");
    list.innerHTML = "";

    if (!filtered.length) {
      list.innerHTML = `<div class="card empty-state">Không tìm thấy câu hỏi nào khớp với từ khóa "${query}".</div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach((q, idx) => {
      const item = document.createElement("div");
      item.className = "bank-item";
      item.innerHTML = `
        <span class="chapter-tag">${getChapterTitle(q.chapter)}</span>
        <div class="bank-q">Câu ${idx + 1}: ${q.question}</div>
        ${showAns ? `<div class="bank-a">Đáp án: ${q.options[q.answer]}</div>` : ""}
      `;
      frag.appendChild(item);
    });
    list.appendChild(frag);
  }

  $("bankSearch").addEventListener("input", renderBank);
  $("bankChapterSelect").addEventListener("change", renderBank);
  $("bankShowAnswers").addEventListener("change", renderBank);

  // ==================== KEYBOARD SHORTCUTS ====================
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;

    if (activeView === "quiz" && quizSession && !quizSession.submitted) {
      const key = e.key.toLowerCase();
      if (["1", "2", "3", "4"].includes(key)) {
        selectOption(Number(key) - 1);
      } else if (["a", "b", "c", "d"].includes(key)) {
        selectOption(["a", "b", "c", "d"].indexOf(key));
      } else if (e.key === "ArrowRight") {
        $("btnNextQ").click();
      } else if (e.key === "ArrowLeft") {
        $("btnPrevQ").click();
      } else if (key === "b") {
        $("btnBookmarkQ").click();
      }
    }
  });

  // Init
  populateChapterSelects();
  updateStats();
  renderChapterList();
})();
