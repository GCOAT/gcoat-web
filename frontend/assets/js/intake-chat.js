// intake-chat.js — Conversational intake chat engine (ES module)
// AI-ready architecture: swap getNextQuestion() for Claude API call in Phase 9

import { submitLead } from "./api.js";

// ── Chat Step Definitions ──
const SERVICE_MAP = {
  "landing-page": "Landing Page",
  "business-website": "Business Website",
  "portfolio": "Portfolio",
  "event-page": "Event Page",
  "waitlist": "Waitlist Page",
  "e-commerce": "E-Commerce",
};

const STEPS = [
  {
    id: "name",
    question: () => "Hey! What's your name?",
    type: "text",
    placeholder: "Your name",
    required: true,
    field: "name",
    maxLength: 100,
  },
  {
    id: "email",
    question: (a) => `Nice to meet you, ${a.name}! Best email to reach you?`,
    type: "email",
    placeholder: "you@example.com",
    required: true,
    field: "email",
    maxLength: 254,
  },
  {
    id: "phone",
    question: () => "Phone number? (optional — hit Send to skip)",
    type: "tel",
    placeholder: "e.g. (340) 555-1234",
    required: false,
    field: "phone",
    maxLength: 20,
  },
  {
    id: "company",
    question: () => "What's your business or project called? (optional)",
    type: "text",
    placeholder: "Business / project name",
    required: false,
    field: "companyName",
    maxLength: 100,
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
      "Waitlist Page",
      "E-Commerce",
      "Not Sure",
    ],
    required: true,
    field: "projectType",
  },
  {
    id: "budget",
    question: () => "What's your budget range? No pressure — helps us scope the right package.",
    type: "choice",
    options: ["$500–$1K", "$1K–$2K", "$2K–$3.5K", "$3.5K+", "Not sure yet"],
    required: true,
    field: "budgetRange",
  },
  {
    id: "timeline",
    question: () => "When do you need it done?",
    type: "choice",
    options: ["ASAP", "2 weeks", "1 month", "Flexible"],
    required: true,
    field: "timeline",
  },
  {
    id: "message",
    question: () =>
      "Tell me about what you need — pages, features, vibe, anything! The more detail, the better.",
    type: "textarea",
    placeholder: "Describe your project…",
    required: true,
    field: "message",
    maxLength: 2000,
  },
  {
    id: "summary",
    type: "summary",
  },
];

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
  const trimmed = typeof answer === "string" ? answer.trim() : answer;

  // Allow empty on optional fields
  if (!trimmed && !s.required) {
    return { valid: true, value: "" };
  }

  if (!trimmed && s.required) {
    return { valid: false, error: "This one's required — give it a go!" };
  }

  // Type-specific validation
  if (s.type === "email" && !EMAIL_RE.test(trimmed)) {
    return { valid: false, error: "Hmm, that doesn't look like a valid email. Try again?" };
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
  const rows = [
    { label: "Name", value: answers.name },
    { label: "Email", value: answers.email },
    answers.phone ? { label: "Phone", value: answers.phone } : null,
    answers.companyName
      ? { label: "Company", value: answers.companyName }
      : null,
    { label: "Project Type", value: answers.projectType },
    { label: "Budget", value: answers.budgetRange },
    { label: "Timeline", value: answers.timeline },
    { label: "Details", value: answers.message },
  ].filter(Boolean);

  const rowsHtml = rows
    .map(
      (r) =>
        `<div class="chat-summary__row"><span class="chat-summary__label">${r.label}</span><span class="chat-summary__value">${escapeHtml(r.value)}</span></div>`
    )
    .join("");

  return `<div class="chat-summary">
    <h3 class="chat-summary__title">Here's what I've got:</h3>
    ${rowsHtml}
    <p class="chat-summary__confirm">Look good?</p>
  </div>`;
}

// ── Chat Controller ──

export function initIntakeChat() {
  const container = document.getElementById("intake-chat");
  if (!container) return;

  const messagesEl = container.querySelector(".chat__messages");
  const inputArea = container.querySelector(".chat__input-area");
  const progressBar = container.querySelector(".chat__progress-fill");
  const progressText = container.querySelector(".chat__progress-text");
  const announcer = document.getElementById("status-announcer");

  let currentStep = 0;
  const answers = {};
  const totalSteps = STEPS.length;

  // Read URL service param (e.g., ?service=landing-page)
  const urlService = new URLSearchParams(window.location.search).get("service");
  const prefilledType = urlService ? SERVICE_MAP[urlService] : null;

  // Start the conversation
  showNextQuestion();

  function updateProgress() {
    const pct = Math.round((currentStep / (totalSteps - 1)) * 100);
    if (progressBar) progressBar.style.setProperty("--progress", pct + "%");
    if (progressText) progressText.textContent = `Step ${Math.min(currentStep + 1, totalSteps - 1)} of ${totalSteps - 1}`;
  }

  async function showNextQuestion() {
    updateProgress();

    // Skip projectType if prefilled from URL
    if (STEPS[currentStep]?.id === "projectType" && prefilledType) {
      answers.projectType = prefilledType;
      addBotMessage(`Since you're looking for a ${prefilledType} — great choice!`);
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
      return;
    }

    await showTypingThenMessage(q.text);
    renderInput(q);
  }

  async function showTypingThenMessage(content, isHtml = false) {
    const typing = addTypingIndicator();
    await delay(randomDelay(400, 900));
    typing.remove();
    addBotMessage(content, isHtml);
  }

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
    dots.innerHTML = '<span></span><span></span><span></span>';

    bubble.appendChild(avatar);
    bubble.appendChild(dots);
    messagesEl.appendChild(bubble);
    scrollToBottom();
    return bubble;
  }

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
      input.type = question.type === "email" ? "email" : question.type === "tel" ? "tel" : "text";
      if (question.type === "email") input.autocomplete = "email";
      if (question.type === "tel") input.autocomplete = "tel";
      if (question.type === "text" && currentStep === 0) input.autocomplete = "name";
    } else {
      input.rows = 3;
    }

    const sendBtn = document.createElement("button");
    sendBtn.className = "chat__send-btn";
    sendBtn.type = "button";
    sendBtn.setAttribute("aria-label", "Send");
    sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;

    wrapper.appendChild(input);
    wrapper.appendChild(sendBtn);
    inputArea.appendChild(wrapper);

    const errorEl = document.createElement("div");
    errorEl.className = "chat__error";
    errorEl.setAttribute("role", "alert");
    errorEl.hidden = true;
    inputArea.appendChild(errorEl);

    // Focus input
    requestAnimationFrame(() => input.focus());

    const handleSubmit = () => {
      const result = processAnswer(currentStep, input.value);
      if (!result.valid) {
        errorEl.textContent = result.error;
        errorEl.hidden = false;
        input.focus();
        return;
      }
      errorEl.hidden = true;

      const step = STEPS[currentStep];
      answers[step.field] = result.value;
      addUserMessage(result.value || "(skipped)");
      inputArea.innerHTML = "";
      currentStep++;
      showNextQuestion();
    };

    sendBtn.addEventListener("click", handleSubmit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    });
  }

  function renderChoiceButtons(question) {
    const grid = document.createElement("div");
    grid.className = "chat__choices";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", question.text);

    question.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "chat__choice-btn";
      btn.type = "button";
      btn.textContent = opt;
      btn.setAttribute("aria-label", opt);

      if (i === 0) btn.tabIndex = 0;
      else btn.tabIndex = -1;

      btn.addEventListener("click", () => {
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

    // Arrow key navigation within choice group
    grid.addEventListener("keydown", (e) => {
      const btns = [...grid.querySelectorAll(".chat__choice-btn")];
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

    // Focus first button
    requestAnimationFrame(() => {
      const first = grid.querySelector(".chat__choice-btn");
      if (first) first.focus();
    });
  }

  function renderSummaryActions() {
    const actions = document.createElement("div");
    actions.className = "chat__summary-actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "btn btn--primary chat__confirm-btn";
    confirmBtn.type = "button";
    confirmBtn.textContent = "Looks great — send it!";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn--secondary chat__edit-btn";
    editBtn.type = "button";
    editBtn.textContent = "Let me edit something";

    actions.appendChild(confirmBtn);
    actions.appendChild(editBtn);
    inputArea.appendChild(actions);

    confirmBtn.addEventListener("click", () => handleSubmit());
    editBtn.addEventListener("click", () => handleEdit());

    requestAnimationFrame(() => confirmBtn.focus());
  }

  async function handleSubmit() {
    inputArea.innerHTML = "";

    const typing = addTypingIndicator();
    await delay(500);
    typing.remove();
    addBotMessage("Sending your project brief…");

    try {
      const data = { ...answers, source: "intake" };
      // Include features if any (future: add feature selection step)
      await submitLead(data);

      // Success
      messagesEl.innerHTML = "";
      inputArea.innerHTML = "";
      showSuccess();
    } catch {
      addBotMessage("Oops — something went wrong. Let me try again…");
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
    if (progressBar) progressBar.style.setProperty("--progress", "100%");
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

    if (announcer) {
      announcer.textContent = "Project brief submitted successfully!";
    }
  }

  function handleEdit() {
    // Restart from step 0, keeping existing answers as defaults
    inputArea.innerHTML = "";
    currentStep = 0;
    messagesEl.innerHTML = "";
    showNextQuestion();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
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
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
