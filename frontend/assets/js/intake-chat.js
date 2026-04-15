// intake-chat.js — Conversational intake chat engine (ES module)
// AI-ready architecture: swap getNextQuestion() for Claude API call in Phase 9

import { submitLead } from "./api.js";

// ── Utilities ──

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

const DRAFT_KEY = "gcoat-intake-draft";

function saveDraft(step, ans) {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ step, answers: ans, ts: Date.now() })
    );
  } catch {}
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (Date.now() - d.ts > 86400000) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

function launchConfetti(container) {
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;
  container.style.position = "relative";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const pieces = [];
  const colors = ["#6C63FF", "#FF6584", "#38B2AC", "#F6AD55", "#68D391"];

  for (let i = 0; i < 80; i++) {
    pieces.push({
      x: canvas.width / 2,
      y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 14 - 5,
      w: Math.random() * 8 + 4,
      h: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      rv: (Math.random() - 0.5) * 12,
      opacity: 1,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.rot += p.rv;
      p.opacity -= 0.01;
      if (p.opacity <= 0) continue;
      alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (alive && frame < 150) requestAnimationFrame(animate);
    else canvas.remove();
  }
  requestAnimationFrame(animate);
}

const PLACEHOLDER_EXAMPLES = [
  'e.g. "A portfolio site for my photography business"',
  'e.g. "A landing page for our SaaS launch"',
  'e.g. "An event page for my conference next month"',
  'e.g. "A simple waitlist page to collect emails"',
  'e.g. "A small business site with booking integration"',
];

const ENCOURAGEMENT = {
  message: "Great picks!",
  references: "Love the vision!",
  budget: "Almost there. Just a couple more details!",
};

// ── Chat Step Definitions ──
const SERVICE_MAP = {
  "landing-page": "Landing Page",
  "business-website": "Business Website",
  "portfolio": "Portfolio",
  "event-page": "Event Page",
  "waitlist": "Waitlist Page",
  "e-commerce": "E-Commerce",
};

const FEATURE_OPTIONS = [
  { label: "Hero Section", hint: "Big intro banner at the top" },
  { label: "About", hint: "Your story and mission" },
  { label: "Services", hint: "What you offer" },
  { label: "Portfolio / Gallery", hint: "Showcase your work" },
  { label: "Testimonials", hint: "Client reviews and quotes" },
  { label: "Contact Form", hint: "Let visitors reach out" },
  { label: "Newsletter Signup", hint: "Collect email subscribers" },
  { label: "FAQ", hint: "Common questions answered" },
  { label: "Pricing", hint: "Plans, packages, or rates" },
];

/** Helper — get just the label strings for data storage */
const FEATURE_LABELS = FEATURE_OPTIONS.map((f) => f.label);

/** Smart defaults — pre-select common features by project type */
const FEATURE_DEFAULTS = {
  "Landing Page": ["Hero Section", "About", "Contact Form"],
  "Business Website": ["Hero Section", "About", "Services", "Contact Form", "Testimonials"],
  "Portfolio": ["Hero Section", "About", "Portfolio / Gallery", "Contact Form"],
  "Event Page": ["Hero Section", "About", "FAQ", "Contact Form"],
  "Waitlist / Pre-Launch": ["Hero Section", "About", "Newsletter Signup"],
  "E-Commerce": ["Hero Section", "About", "Portfolio / Gallery", "Pricing", "Contact Form"],
};

const STEPS = [
  {
    id: "name",
    question: () => `${getGreeting()}! What's your name?`,
    type: "text",
    placeholder: "Your name",
    required: true,
    field: "name",
    maxLength: 100,
  },
  {
    id: "email",
    question: (a) => `Pleasure to meet you, ${a.name}! What is the best email to reach you?`,
    type: "email",
    placeholder: "you@example.com",
    required: true,
    field: "email",
    maxLength: 254,
  },
  {
    id: "projectType",
    question: () => "What type of project are you looking for?",
    type: "choice",
    options: [
      "Landing Page",
      "Business Website",
      "Portfolio",
      "Event Page",
      "Waitlist / Pre-Launch",
      "E-Commerce",
      "Something Else",
    ],
    required: true,
    field: "projectType",
  },
  {
    id: "features",
    question: (a) =>
      FEATURE_DEFAULTS[a.projectType]
        ? "I've pre-selected the most common sections for that type. Adjust as you like!"
        : "What do you need on it? Pick all that apply.",
    type: "multiselect",
    options: FEATURE_OPTIONS,
    required: true,
    field: "features",
  },
  {
    id: "message",
    question: () =>
      "Paint the picture for us. What do you want this to look and feel like?",
    type: "textarea",
    placeholder: "Describe your project…",
    required: true,
    field: "message",
    maxLength: 2000,
  },
  {
    id: "references",
    question: () =>
      "Any sites that inspire you? Drop a link to a site that catches your eye.",
    type: "text",
    placeholder: "e.g. https://stripe.com, https://linear.app",
    required: false,
    field: "inspirationLinks",
    maxLength: 500,
  },
  {
    id: "budget",
    question: () =>
      "What's your budget range? No pressure, just helps us scope the right package.",
    type: "choice",
    options: [
      "$500–$1K",
      "$1K–$2K",
      "$2K–$3.5K",
      "$3.5K+",
      "Not sure yet",
    ],
    required: true,
    field: "budgetRange",
  },
  {
    id: "timeline",
    question: () => "What's your timeline looking like?",
    type: "choice",
    options: ["ASAP", "2 weeks", "1 month", "Flexible"],
    required: true,
    field: "timeline",
  },
  {
    id: "summary",
    type: "summary",
  },
];

const CONTENT_STEPS = STEPS.filter((s) => s.type !== "summary");
const TOTAL_VISIBLE_STEPS = CONTENT_STEPS.length;

// ── Email Validation ──
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// ── Core API (AI-ready — Phase 9 swaps these for Claude calls) ──

export function getNextQuestion(step, answers) {
  if (step >= STEPS.length) return null;
  const s = STEPS[step];
  if (s.type === "summary") {
    return { type: "summary", html: generateSummary(answers) };
  }
  return {
    type: s.type,
    text: s.question(answers),
    placeholder: s.placeholder || "",
    options: s.options || null,
    required: s.required,
    field: s.field,
  };
}

export function processAnswer(step, answer) {
  const s = STEPS[step];
  if (s.type === "multiselect") {
    return { valid: true, value: answer };
  }
  const trimmed = typeof answer === "string" ? answer.trim() : answer;

  if (!trimmed && !s.required) {
    return { valid: true, value: "" };
  }
  if (!trimmed && s.required) {
    return { valid: false, error: "This one's required - give it a go!" };
  }
  if (s.type === "email" && !EMAIL_RE.test(trimmed)) {
    return {
      valid: false,
      error: "Hmm, that doesn't look like a valid email. Try again?",
    };
  }
  if (s.maxLength && trimmed.length > s.maxLength) {
    return {
      valid: false,
      error: `Keep it under ${s.maxLength} characters, please!`,
    };
  }
  return { valid: true, value: trimmed };
}

export function generateSummary(answers) {
  const PENCIL =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>';

  const rows = [
    { label: "Name", field: "name", value: answers.name },
    { label: "Email", field: "email", value: answers.email },
    {
      label: "Project Type",
      field: "projectType",
      value: answers.projectType,
    },
    {
      label: "Features",
      field: "features",
      value: answers.features?.length ? answers.features.join(", ") : null,
    },
    { label: "Description", field: "message", value: answers.message },
    answers.inspirationLinks
      ? {
          label: "Inspiration",
          field: "inspirationLinks",
          value: answers.inspirationLinks,
        }
      : null,
    { label: "Budget", field: "budgetRange", value: answers.budgetRange },
    { label: "Timeline", field: "timeline", value: answers.timeline },
  ].filter(Boolean);

  const rowsHtml = rows
    .filter((r) => r.value)
    .map(
      (r) =>
        `<div class="chat-summary__row" data-field="${r.field}">` +
        `<span class="chat-summary__label">${r.label}</span>` +
        `<span class="chat-summary__value">${escapeHtml(r.value)}</span>` +
        `<button class="chat-summary__edit" type="button" data-field="${r.field}" aria-label="Edit ${r.label}">${PENCIL}</button>` +
        `</div>`
    )
    .join("");

  return (
    `<div class="chat-summary">` +
    `<h3 class="chat-summary__title">Here's what I've got:</h3>` +
    `${rowsHtml}` +
    `<p class="chat-summary__confirm">Look good?</p>` +
    `</div>`
  );
}

// ── Chat Controller ──

export function initIntakeChat() {
  const container = document.getElementById("intake-chat");
  if (!container) return;

  const messagesEl = container.querySelector(".chat__messages");
  const inputArea = container.querySelector(".chat__input-area");
  const progressBar = container
    .closest(".intake-panel")
    ?.querySelector(".chat__progress-fill");
  const progressText = container
    .closest(".intake-panel")
    ?.querySelector(".chat__progress-text");
  const announcer = document.getElementById("status-announcer");

  let currentStep = 0;
  const answers = {};

  const urlService = new URLSearchParams(window.location.search).get(
    "service"
  );
  const prefilledType = urlService ? SERVICE_MAP[urlService] : null;

  // ── Draft Resume ──
  const draft = loadDraft();
  if (draft && draft.answers?.name && draft.step > 0) {
    Object.assign(answers, draft.answers);
    currentStep = draft.step;
    (async () => {
      addBotMessage(`Welcome back, ${escapeHtml(answers.name)}! Let's pick up where we left off.`);
      renderStartOverButton();
      updateProgress();
      await delay(800);
      showNextQuestion();
    })();
  } else {
    showNextQuestion();
  }

  function renderStartOverButton() {
    const btn = document.createElement("button");
    btn.className = "chat__start-over";
    btn.type = "button";
    btn.textContent = "Start over";
    btn.addEventListener("click", () => {
      clearDraft();
      currentStep = 0;
      Object.keys(answers).forEach((k) => delete answers[k]);
      messagesEl.innerHTML = "";
      inputArea.innerHTML = "";
      updateProgress();
      showNextQuestion();
    });
    inputArea.appendChild(btn);
  }

  // ── Progress ──

  function updateProgress() {
    const contentIdx = Math.min(currentStep, CONTENT_STEPS.length);
    const pct = Math.round((contentIdx / TOTAL_VISIBLE_STEPS) * 100);
    if (progressBar) {
      progressBar.style.setProperty("--progress", pct + "%");
      // Color shift: hue 220 (blue) → 145 (green)
      const hue = Math.round(220 - (pct / 100) * 75);
      progressBar.style.setProperty("--progress-hue", hue);
    }
    if (progressText)
      progressText.textContent = `Step ${Math.min(contentIdx + 1, TOTAL_VISIBLE_STEPS)} of ${TOTAL_VISIBLE_STEPS}`;
  }

  // ── Question Flow ──

  async function showNextQuestion() {
    updateProgress();
    saveDraft(currentStep, answers);

    // Encouragement messages between steps
    const stepId = STEPS[currentStep]?.id;
    const encouragement = ENCOURAGEMENT[stepId];
    if (encouragement && currentStep > 0) {
      await showTypingThenMessage(encouragement);
      await delay(200);
    }

    if (STEPS[currentStep]?.id === "projectType" && prefilledType) {
      answers.projectType = prefilledType;
      addBotMessage(
        `Since you're looking for a ${prefilledType} - great choice!`
      );
      currentStep++;
      await delay(600);
      showNextQuestion();
      return;
    }

    const q = getNextQuestion(currentStep, answers);
    if (!q) return;

    if (q.type === "summary") {
      await showTypingThenMessage(q.html, true);
      renderSummaryActions();
      bindSummaryEditButtons();
      return;
    }

    if (q.type === "multiselect") {
      await showTypingThenMessage(q.text);
      renderMultiSelectChips(q);
      return;
    }

    await showTypingThenMessage(q.text);
    renderInput(q);
  }

  async function showTypingThenMessage(content, isHtml = false) {
    const typing = addTypingIndicator();
    await delay(randomDelay(200, 400));
    typing.remove();
    addBotMessage(content, isHtml);
  }

  // ── Messages ──

  function addBotMessage(content, isHtml = false) {
    const bubble = document.createElement("div");
    bubble.className = "chat__bubble chat__bubble--bot";
    bubble.setAttribute("role", "log");

    const avatar = document.createElement("div");
    avatar.className = "chat__avatar";
    avatar.textContent = "G";
    avatar.setAttribute("aria-hidden", "true");

    const msg = document.createElement("div");
    msg.className = "chat__message";
    if (isHtml) {
      msg.innerHTML = content;
    } else {
      msg.textContent = content;
    }

    bubble.appendChild(avatar);
    bubble.appendChild(msg);
    messagesEl.appendChild(bubble);
    scrollToBottom();

    if (announcer) announcer.textContent = isHtml ? "Summary ready" : content;
  }

  function addUserMessage(text) {
    const bubble = document.createElement("div");
    bubble.className = "chat__bubble chat__bubble--user";
    const msg = document.createElement("div");
    msg.className = "chat__message";
    msg.textContent = text;
    bubble.appendChild(msg);
    messagesEl.appendChild(bubble);
    scrollToBottom();
  }

  function addTypingIndicator() {
    const bubble = document.createElement("div");
    bubble.className = "chat__bubble chat__bubble--bot chat__bubble--typing";

    const avatar = document.createElement("div");
    avatar.className = "chat__avatar";
    avatar.textContent = "G";
    avatar.setAttribute("aria-hidden", "true");

    const dots = document.createElement("div");
    dots.className = "chat__typing";
    dots.setAttribute("aria-label", "GCOAT is typing");
    dots.innerHTML = "<span></span><span></span><span></span>";

    bubble.appendChild(avatar);
    bubble.appendChild(dots);
    messagesEl.appendChild(bubble);
    scrollToBottom();
    return bubble;
  }

  // ── Text / Email / URL Input ──

  function renderInput(question) {
    inputArea.innerHTML = "";

    if (question.type === "choice") {
      renderChoiceButtons(question);
      return;
    }

    const isTextarea = question.type === "textarea";
    const wrapper = document.createElement("div");
    wrapper.className = "chat__input-row";

    const input = document.createElement(isTextarea ? "textarea" : "input");
    input.className = "chat__input";
    input.placeholder = question.placeholder;
    input.setAttribute("aria-label", question.text);
    input.maxLength = STEPS[currentStep]?.maxLength || 500;

    if (!isTextarea) {
      input.type =
        question.type === "email"
          ? "email"
          : question.type === "tel"
            ? "tel"
            : "text";
      if (question.type === "email") input.autocomplete = "email";
      if (question.type === "tel") input.autocomplete = "tel";
      if (question.type === "text" && currentStep === 0)
        input.autocomplete = "name";
    } else {
      input.rows = 3;
    }

    const sendBtn = createSendButton();
    wrapper.appendChild(input);
    wrapper.appendChild(sendBtn);
    inputArea.appendChild(wrapper);

    // Enter hint
    const hint = document.createElement("span");
    hint.className = "chat__enter-hint";
    hint.textContent = "Enter ↵";
    wrapper.appendChild(hint);

    // Character count for textarea
    let charCounter = null;
    if (isTextarea) {
      const maxLen = STEPS[currentStep]?.maxLength || 2000;
      charCounter = document.createElement("div");
      charCounter.className = "chat__char-count";
      charCounter.textContent = `0 / ${maxLen}`;
      inputArea.appendChild(charCounter);
      input.addEventListener("input", () => {
        charCounter.textContent = `${input.value.length} / ${maxLen}`;
      });
    }

    // Rotating placeholder for description textarea
    let placeholderTimer = null;
    if (isTextarea && STEPS[currentStep]?.id === "message") {
      let idx = 0;
      input.placeholder = PLACEHOLDER_EXAMPLES[0];
      placeholderTimer = setInterval(() => {
        idx = (idx + 1) % PLACEHOLDER_EXAMPLES.length;
        input.placeholder = PLACEHOLDER_EXAMPLES[idx];
      }, 3000);
    }

    const errorEl = createErrorEl();
    inputArea.appendChild(errorEl);

    requestAnimationFrame(() => input.focus());

    const onSubmit = () => {
      const result = processAnswer(currentStep, input.value);
      if (!result.valid) {
        errorEl.textContent = result.error;
        errorEl.hidden = false;
        input.focus();
        return;
      }
      if (placeholderTimer) clearInterval(placeholderTimer);
      errorEl.hidden = true;
      const step = STEPS[currentStep];
      answers[step.field] = result.value;
      addUserMessage(result.value || "(skipped)");
      inputArea.innerHTML = "";
      currentStep++;
      showNextQuestion();
    };

    sendBtn.addEventListener("click", onSubmit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    });

    renderGoBack();
  }

  // ── Single Choice Buttons (with "Something Else" handling) ──

  function renderChoiceButtons(question) {
    const grid = document.createElement("div");
    grid.className = "chat__choices";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", question.text);

    let otherInput = null;
    let otherWrapper = null;

    question.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "chat__choice-btn";
      btn.type = "button";
      btn.textContent = opt;
      btn.setAttribute("aria-label", opt);
      btn.tabIndex = i === 0 ? 0 : -1;

      btn.addEventListener("click", () => {
        if (opt === "Something Else") {
          if (!otherWrapper) {
            otherWrapper = document.createElement("div");
            otherWrapper.className = "chat__other-wrapper";

            otherInput = document.createElement("input");
            otherInput.className = "chat__input chat__other-input";
            otherInput.type = "text";
            otherInput.placeholder = "Describe your project type…";
            otherInput.maxLength = 50;
            otherInput.setAttribute("aria-label", "Custom project type");

            const sendBtn = createSendButton();
            otherWrapper.appendChild(otherInput);
            otherWrapper.appendChild(sendBtn);
            inputArea.appendChild(otherWrapper);

            const onSend = () => {
              const val = otherInput.value.trim();
              if (!val) {
                otherInput.focus();
                return;
              }
              const step = STEPS[currentStep];
              answers[step.field] = val;
              addUserMessage(val);
              inputArea.innerHTML = "";
              currentStep++;
              showNextQuestion();
            };
            sendBtn.addEventListener("click", onSend);
            otherInput.addEventListener("keydown", (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSend();
              }
            });
            requestAnimationFrame(() => otherInput.focus());
          }
          return;
        }

        const step = STEPS[currentStep];
        answers[step.field] = opt;
        addUserMessage(opt);
        inputArea.innerHTML = "";
        currentStep++;
        showNextQuestion();
      });

      grid.appendChild(btn);
    });

    inputArea.appendChild(grid);
    addArrowKeyNav(grid, ".chat__choice-btn");
    renderGoBack();
    requestAnimationFrame(() => {
      const first = grid.querySelector(".chat__choice-btn");
      if (first) first.focus();
    });
  }

  // ── Multi-Select Chips ──

  function renderMultiSelectChips(question) {
    inputArea.innerHTML = "";
    // Pre-select smart defaults based on project type (if no features chosen yet)
    const defaults =
      !answers.features?.length && answers.projectType
        ? FEATURE_DEFAULTS[answers.projectType] || []
        : [];
    const selected = new Set(answers.features || defaults);
    let otherText = "";

    const grid = document.createElement("div");
    grid.className = "chat__choices chat__choices--multi";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", question.text);

    question.options.forEach((opt, i) => {
      const label = typeof opt === "string" ? opt : opt.label;
      const hint = typeof opt === "string" ? null : opt.hint;
      const btn = document.createElement("button");
      btn.className = "chat__choice-btn chat__choice-btn--with-hint";
      if (selected.has(label)) btn.classList.add("is-selected");
      btn.type = "button";
      btn.setAttribute("aria-pressed", selected.has(label) ? "true" : "false");
      btn.tabIndex = i === 0 ? 0 : -1;

      const labelSpan = document.createElement("span");
      labelSpan.className = "chat__choice-label";
      labelSpan.textContent = label;
      btn.appendChild(labelSpan);

      if (hint) {
        const hintSpan = document.createElement("span");
        hintSpan.className = "chat__choice-hint";
        hintSpan.textContent = hint;
        btn.appendChild(hintSpan);
      }

      btn.addEventListener("click", () => {
        const isOn = btn.classList.toggle("is-selected");
        btn.setAttribute("aria-pressed", isOn ? "true" : "false");
        if (isOn) selected.add(label);
        else selected.delete(label);
      });
      grid.appendChild(btn);
    });

    // "Other" chip
    const otherBtn = document.createElement("button");
    otherBtn.className = "chat__choice-btn chat__choice-btn--other";
    otherBtn.type = "button";
    otherBtn.textContent = "Other";
    otherBtn.tabIndex = -1;
    otherBtn.setAttribute("aria-pressed", "false");

    let otherRow = null;

    otherBtn.addEventListener("click", () => {
      const isOn = otherBtn.classList.toggle("is-selected");
      otherBtn.setAttribute("aria-pressed", isOn ? "true" : "false");

      if (isOn && !otherRow) {
        otherRow = document.createElement("div");
        otherRow.className = "chat__other-wrapper";
        const inp = document.createElement("input");
        inp.className = "chat__input chat__other-input";
        inp.type = "text";
        inp.placeholder = "e.g. Blog, Map, Login…";
        inp.maxLength = 50;
        inp.setAttribute("aria-label", "Custom feature");
        inp.addEventListener("input", () => {
          otherText = inp.value.trim();
        });
        otherRow.appendChild(inp);
        grid.parentNode.insertBefore(otherRow, doneBtn);
        requestAnimationFrame(() => inp.focus());
      } else if (!isOn && otherRow) {
        otherRow.remove();
        otherRow = null;
        otherText = "";
      }
    });
    grid.appendChild(otherBtn);
    inputArea.appendChild(grid);

    // Done button
    const doneBtn = document.createElement("button");
    doneBtn.className = "btn btn--primary chat__done-btn";
    doneBtn.type = "button";
    doneBtn.textContent = "Done";
    inputArea.appendChild(doneBtn);

    const errorEl = createErrorEl();
    inputArea.appendChild(errorEl);

    addArrowKeyNav(grid, ".chat__choice-btn");
    renderGoBack();

    doneBtn.addEventListener("click", () => {
      const feats = [...selected];
      if (otherText) feats.push(otherText);

      if (feats.length === 0) {
        errorEl.textContent = "Pick at least one feature!";
        errorEl.hidden = false;
        return;
      }
      errorEl.hidden = true;
      answers.features = feats;
      addUserMessage(feats.join(", "));
      inputArea.innerHTML = "";
      currentStep++;
      showNextQuestion();
    });
  }

  // ── Summary Actions + Inline Editing ──

  function renderSummaryActions() {
    const actions = document.createElement("div");
    actions.className = "chat__summary-actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "btn btn--primary chat__confirm-btn";
    confirmBtn.type = "button";
    confirmBtn.textContent = "Looks great - send it!";

    actions.appendChild(confirmBtn);
    inputArea.appendChild(actions);

    confirmBtn.addEventListener("click", () => handleSubmit());
    requestAnimationFrame(() => confirmBtn.focus());
  }

  function bindSummaryEditButtons() {
    const summaryEl = messagesEl.querySelector(".chat-summary");
    if (!summaryEl) return;

    summaryEl.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".chat-summary__edit");
      if (!editBtn) return;
      const field = editBtn.dataset.field;
      if (field) handleInlineEdit(field, summaryEl);
    });
  }

  function handleInlineEdit(field, summaryEl) {
    const row = summaryEl.querySelector(
      `.chat-summary__row[data-field="${field}"]`
    );
    if (!row || row.classList.contains("is-editing")) return;
    row.classList.add("is-editing");

    const valueEl = row.querySelector(".chat-summary__value");
    const editBtn = row.querySelector(".chat-summary__edit");
    const originalHtml = valueEl.innerHTML;
    if (editBtn) editBtn.hidden = true;

    const step = STEPS.find((s) => s.field === field);

    if (field === "features") {
      renderInlineMultiSelect(row, valueEl, editBtn, originalHtml);
      return;
    }

    const choiceStep = step?.type === "choice" ? step : null;
    if (choiceStep?.options) {
      renderInlineChoice(
        row,
        valueEl,
        editBtn,
        originalHtml,
        field,
        choiceStep.options
      );
      return;
    }

    renderInlineText(
      row,
      valueEl,
      editBtn,
      originalHtml,
      field,
      step?.type === "textarea" || field === "message"
    );
  }

  function renderInlineText(
    row,
    valueEl,
    editBtn,
    originalHtml,
    field,
    isTextarea
  ) {
    const current = answers[field] || "";
    const input = document.createElement(isTextarea ? "textarea" : "input");
    input.className = "chat-summary__inline-input";
    input.value = current;
    if (isTextarea) input.rows = 3;
    else input.type = field === "email" ? "email" : "text";

    const actions = document.createElement("div");
    actions.className = "chat-summary__inline-actions";

    const saveBtn = document.createElement("button");
    saveBtn.className = "chat-summary__save-btn";
    saveBtn.type = "button";
    saveBtn.textContent = "Save";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "chat-summary__cancel-btn";
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    valueEl.innerHTML = "";
    valueEl.appendChild(input);
    valueEl.appendChild(actions);
    requestAnimationFrame(() => input.focus());

    const restore = () => {
      valueEl.innerHTML = originalHtml;
      row.classList.remove("is-editing");
      if (editBtn) editBtn.hidden = false;
    };

    cancelBtn.addEventListener("click", restore);
    saveBtn.addEventListener("click", () => {
      const val = input.value.trim();
      if (field === "email" && !EMAIL_RE.test(val)) return;
      if ((field === "name" || field === "email") && !val) return;
      answers[field] = val;
      valueEl.textContent = val || "(skipped)";
      row.classList.remove("is-editing");
      if (editBtn) editBtn.hidden = false;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        saveBtn.click();
      }
      if (e.key === "Escape") restore();
    });
  }

  function renderInlineChoice(
    row,
    valueEl,
    editBtn,
    originalHtml,
    field,
    options
  ) {
    const grid = document.createElement("div");
    grid.className = "chat__choices chat__choices--inline";

    options.forEach((opt) => {
      if (opt === "Something Else") return;
      const btn = document.createElement("button");
      btn.className = "chat__choice-btn";
      if (answers[field] === opt) btn.classList.add("is-selected");
      btn.type = "button";
      btn.textContent = opt;
      btn.addEventListener("click", () => {
        answers[field] = opt;
        valueEl.textContent = opt;
        row.classList.remove("is-editing");
        if (editBtn) editBtn.hidden = false;
      });
      grid.appendChild(btn);
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "chat-summary__cancel-btn";
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      valueEl.innerHTML = originalHtml;
      row.classList.remove("is-editing");
      if (editBtn) editBtn.hidden = false;
    });

    valueEl.innerHTML = "";
    valueEl.appendChild(grid);
    valueEl.appendChild(cancelBtn);
  }

  function renderInlineMultiSelect(row, valueEl, editBtn, originalHtml) {
    const currentFeats = new Set(answers.features || []);
    const grid = document.createElement("div");
    grid.className = "chat__choices chat__choices--multi chat__choices--inline";

    FEATURE_LABELS.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "chat__choice-btn";
      if (currentFeats.has(opt)) btn.classList.add("is-selected");
      btn.type = "button";
      btn.textContent = opt;
      btn.setAttribute(
        "aria-pressed",
        currentFeats.has(opt) ? "true" : "false"
      );
      btn.addEventListener("click", () => {
        const isOn = btn.classList.toggle("is-selected");
        btn.setAttribute("aria-pressed", isOn ? "true" : "false");
        if (isOn) currentFeats.add(opt);
        else currentFeats.delete(opt);
      });
      grid.appendChild(btn);
    });

    const actions = document.createElement("div");
    actions.className = "chat-summary__inline-actions";
    const saveBtn = document.createElement("button");
    saveBtn.className = "chat-summary__save-btn";
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "chat-summary__cancel-btn";
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    valueEl.innerHTML = "";
    valueEl.appendChild(grid);
    valueEl.appendChild(actions);

    cancelBtn.addEventListener("click", () => {
      valueEl.innerHTML = originalHtml;
      row.classList.remove("is-editing");
      if (editBtn) editBtn.hidden = false;
    });
    saveBtn.addEventListener("click", () => {
      const feats = [...currentFeats];
      if (feats.length === 0) return;
      answers.features = feats;
      valueEl.textContent = feats.join(", ");
      row.classList.remove("is-editing");
      if (editBtn) editBtn.hidden = false;
    });
  }

  // ── Submit ──

  async function handleSubmit() {
    inputArea.innerHTML = "";

    const typing = addTypingIndicator();
    await delay(500);
    typing.remove();
    addBotMessage("Sending your project brief…");

    try {
      const data = { ...answers, source: "intake" };
      await submitLead(data);
      window.gtag?.("event", "form_submission", { form_type: "intake_chat" });
      clearDraft();

      messagesEl.innerHTML = "";
      inputArea.innerHTML = "";
      showSuccess();
    } catch {
      addBotMessage("Oops, something went wrong. Let me try again.");
      renderRetryAction();
    }
  }

  function renderRetryAction() {
    const actions = document.createElement("div");
    actions.className = "chat__summary-actions";

    const retryBtn = document.createElement("button");
    retryBtn.className = "btn btn--primary";
    retryBtn.type = "button";
    retryBtn.textContent = "Try again";
    retryBtn.addEventListener("click", () => handleSubmit());

    actions.appendChild(retryBtn);
    inputArea.appendChild(actions);
  }

  function showSuccess() {
    if (progressBar) {
      progressBar.style.setProperty("--progress", "100%");
      progressBar.style.setProperty("--progress-hue", "145");
    }
    if (progressText) progressText.textContent = "Done!";

    const success = document.createElement("div");
    success.className = "chat__success";
    success.innerHTML = `
      <div class="chat__success-icon" aria-hidden="true">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <h2 class="chat__success-title">You're all set, ${escapeHtml(answers.name)}!</h2>
      <p class="chat__success-text">We'll review your brief and get back to you within 24 hours. Check your email at <strong>${escapeHtml(answers.email)}</strong> for a confirmation.</p>
      <a href="./index.html" class="btn btn--secondary chat__success-link">Back to homepage</a>
    `;
    messagesEl.appendChild(success);
    launchConfetti(messagesEl);

    if (announcer) {
      announcer.textContent = "Project brief submitted successfully!";
    }
  }

  // ── Helpers ──

  function createSendButton() {
    const btn = document.createElement("button");
    btn.className = "chat__send-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Send");
    btn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
    return btn;
  }

  function createErrorEl() {
    const el = document.createElement("div");
    el.className = "chat__error";
    el.setAttribute("role", "alert");
    el.hidden = true;
    return el;
  }

  function addArrowKeyNav(container, selector) {
    container.addEventListener("keydown", (e) => {
      const btns = [...container.querySelectorAll(selector)];
      const idx = btns.indexOf(document.activeElement);
      if (idx < 0) return;

      let next = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        next = (idx + 1) % btns.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        next = (idx - 1 + btns.length) % btns.length;
      }

      if (next >= 0) {
        e.preventDefault();
        btns[idx].tabIndex = -1;
        btns[next].tabIndex = 0;
        btns[next].focus();
      }
    });
  }

  function renderGoBack() {
    if (currentStep <= 0) return;
    const link = document.createElement("button");
    link.className = "chat__go-back";
    link.type = "button";
    link.innerHTML = "&#8592; Go back";
    link.setAttribute("aria-label", "Go back to previous question");
    link.addEventListener("click", () => {
      // Remove the last bot message + user answer
      const bubbles = messagesEl.querySelectorAll(".chat__bubble");
      const toRemove = [];
      for (let i = bubbles.length - 1; i >= 0 && toRemove.length < 2; i--) {
        toRemove.push(bubbles[i]);
      }
      toRemove.forEach((el) => el.remove());

      // Clear the previous answer
      const prevStep = STEPS[currentStep - 1];
      if (prevStep?.field) delete answers[prevStep.field];

      currentStep--;
      inputArea.innerHTML = "";
      showNextQuestion();
    });
    inputArea.appendChild(link);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTo({
        top: messagesEl.scrollHeight,
        behavior: "smooth",
      });
    });
  }
}

// ── Utilities ──

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function delay(ms) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
