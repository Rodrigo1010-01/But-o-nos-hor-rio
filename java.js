'use strict';

// ==================== DOM ====================
const DOM = {
  html: document.documentElement,
  cursor: document.getElementById('cur'),
  cursorRing: document.getElementById('cur2'),
  canvas: document.getElementById('cv'),
  headerTime: document.getElementById('htime'),
  headerDate: document.getElementById('hdate'),
  audioToggle: document.getElementById('audio-toggle'),
  soundtrack: document.getElementById('soundtrack'),
  hint: document.getElementById('hint'),
  goalCard: document.getElementById('goal-card'),
  backButton: document.getElementById('gc-back'),
  goalNumber: document.getElementById('gc-n'),
  goalTitle: document.getElementById('gc-title'),
  goalWhen: document.getElementById('gc-when'),
  goalStatus: document.getElementById('gc-status'),
  morseButton: document.getElementById('gc-morse'),
  goalDescription: document.getElementById('gc-desc'),
  goalDetailGrid: document.getElementById('gc-detail-grid'),
  goalCountLabel: document.getElementById('gc-count-label'),
  goalCountdown: document.getElementById('gc-cd')
};

// ==================== CONSTANTES ====================
const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';
const GOAL_UTC_OFFSET_HOURS = 3;
const SOUNDTRACK_LOOP_START = 0;
const SOUNDTRACK_VOLUME = 0.48;
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const TAU = Math.PI * 2;

const BRASILIA_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US-u-nu-latn', {
  timeZone: BRASILIA_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

const BRASILIA_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BRASILIA_TIME_ZONE,
  weekday: 'short'
});

let soundtrackAvailable = Boolean(DOM.soundtrack);
let soundtrackReady = false;
let soundtrackAutostartPending = true;
let soundtrackPausedByUser = false;
let goalMessageMode = 'text';

// ==================== FUNÇÕES AUXILIARES ====================
function pad(value, length = 2) {
  return String(Math.max(0, value)).padStart(length, '0');
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function getBrasiliaParts(date = new Date()) {
  const mappedParts = {};
  BRASILIA_PARTS_FORMATTER.formatToParts(date).forEach((part) => {
    if (part.type !== 'literal') {
      mappedParts[part.type] = part.value;
    }
  });

  return {
    rawDate: date,
    year: Number(mappedParts.year),
    month: Number(mappedParts.month),
    day: Number(mappedParts.day),
    hour: Number(mappedParts.hour),
    minute: Number(mappedParts.minute),
    second: Number(mappedParts.second),
    millisecond: date.getMilliseconds(),
    weekday: BRASILIA_WEEKDAY_FORMATTER
      .format(date)
      .replace(/\./g, '')
      .slice(0, 3)
      .toUpperCase()
  };
}

function makeBrasiliaDate(year, monthIndex, day, hour, minute = 0, second = 0) {
  return new Date(Date.UTC(year, monthIndex, day, hour + GOAL_UTC_OFFSET_HOURS, minute, second));
}

function formatBrasiliaDate(date) {
  const brt = getBrasiliaParts(date);
  return `${pad(brt.day)} ${MONTHS[brt.month - 1]} ${brt.year} | ${pad(brt.hour)}:${pad(brt.minute)}`;
}

function renderHudClock(brtNow) {
  DOM.headerTime.textContent = `${pad(brtNow.hour)}:${pad(brtNow.minute)}:${pad(brtNow.second)}.${pad(brtNow.millisecond, 3)}`;
  DOM.headerDate.textContent = `${brtNow.weekday} | ${pad(brtNow.day)} ${MONTHS[brtNow.month - 1]} ${brtNow.year}`;
}

// ==================== MORSE ====================
const MORSE_MAP = { /* ... seu MORSE_MAP completo ... */ };

function toDigitalMorse(text) {
  return text
    .toUpperCase()
    .split(' ')
    .map((word) =>
      word
        .split('')
        .map((char) => MORSE_MAP[char] ?? '')
        .filter(Boolean)
        .join(' ')
    )
    .join(' / ');
}

// ==================== GOALS ====================
function createGoal(config) {
  const date = makeBrasiliaDate(config.year, config.monthIndex, config.day, config.hour, config.minute ?? 0);

  return {
    id: config.id,
    n: config.n,
    title: config.title,
    sub: config.sub,
    desc: config.desc,
    details: config.details,
    hour: config.hour,
    date,
    dateLabel: formatBrasiliaDate(date)
  };
}

const GOALS = [ /* ... seus 5 goals completos ... */ ];

let activeGoal = null;
let goalTimer = null;

// ==================== CONTAGEM REGRESSIVA ====================
function getGoalDistance(targetDate) {
  const difference = targetDate.getTime() - Date.now();
  const absoluteDifference = Math.abs(difference);

  return {
    isFuture: difference >= 0,
    totalMs: absoluteDifference,
    days: Math.floor(absoluteDifference / 864e5),
    hours: Math.floor((absoluteDifference % 864e5) / 36e5),
    minutes: Math.floor((absoluteDifference % 36e5) / 6e4),
    seconds: Math.floor((absoluteDifference % 6e4) / 1e3)
  };
}

function renderGoalCountdown() {
  if (!activeGoal) return;

  const distance = getGoalDistance(activeGoal.date);

  DOM.goalStatus.textContent = distance.isFuture ? 'objetivo em contagem regressiva' : 'objetivo concluido';
  DOM.goalCountLabel.textContent = distance.isFuture ? 'tempo restante' : 'tempo desde o evento';

  DOM.goalCountdown.innerHTML = `
    <div class="cd-u"><span class="cd-n">${pad(distance.days, 3)}</span><span class="cd-l">dias</span></div>
    <span class="cd-sep">|</span>
    <div class="cd-u"><span class="cd-n">${pad(distance.hours)}</span><span class="cd-l">horas</span></div>
    <span class="cd-sep">|</span>
    <div class="cd-u"><span class="cd-n">${pad(distance.minutes)}</span><span class="cd-l">min</span></div>
    <span class="cd-sep">|</span>
    <div class="cd-u"><span class="cd-n">${pad(distance.seconds)}</span><span class="cd-l">seg</span></div>
  `;
}

// ==================== RENDER GOAL ====================
function renderGoalMessage() {
  if (!activeGoal) return;
  const isMorse = goalMessageMode === 'morse';
  DOM.goalDescription.textContent = isMorse ? toDigitalMorse(activeGoal.desc) : activeGoal.desc;
  DOM.goalDescription.classList.toggle('morse', isMorse);
  DOM.morseButton.textContent = isMorse ? '[ ver em texto ]' : '[ ver em morse ]';
}

function renderGoalDetails() {
  if (!activeGoal) {
    DOM.goalDetailGrid.innerHTML = '';
    return;
  }
  DOM.goalDetailGrid.innerHTML = activeGoal.details
    .map(([label, value]) => `
      <div class="gc-detail">
        <div class="gc-detail-k">${label}</div>
        <div class="gc-detail-v">${value}</div>
      </div>
    `)
    .join('');
}

function openGoalCard(goal) {
  activeGoal = goal;
  goalMessageMode = 'text';
  DOM.goalNumber.textContent = goal.n;
  DOM.goalTitle.textContent = goal.title;
  DOM.goalWhen.textContent = `${goal.dateLabel} | ${goal.sub}`;
  DOM.hint.style.opacity = '0';

  if (goalTimer) clearInterval(goalTimer);

  renderGoalMessage();
  renderGoalDetails();
  renderGoalCountdown();
  goalTimer = setInterval(renderGoalCountdown, 1000);
  DOM.goalCard.classList.add('open');
}

function closeGoalCard() {
  activeGoal = null;
  goalMessageMode = 'text';
  DOM.goalDescription.classList.remove('morse');
  DOM.goalDetailGrid.innerHTML = '';
  DOM.goalCard.classList.remove('open');
  DOM.hint.style.opacity = '';

  if (goalTimer) {
    clearInterval(goalTimer);
    goalTimer = null;
  }
}

function toggleGoalMessageMode() {
  if (!activeGoal) return;
  goalMessageMode = goalMessageMode === 'text' ? 'morse' : 'text';
  renderGoalMessage();
}

// ==================== CURSOR ====================
const POINTER = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  easedX: window.innerWidth / 2,
  easedY: window.innerHeight / 2,
  parallaxX: 0,
  parallaxY: 0,
  customCursorEnabled: window.matchMedia('(pointer: fine)').matches
};

function setupCursor() {
  if (!POINTER.customCursorEnabled) return;

  DOM.html.classList.add('has-custom-cursor');

  document.addEventListener('pointermove', (e) => {
    POINTER.x = e.clientX;
    POINTER.y = e.clientY;
    DOM.cursor.style.transform = `translate(${POINTER.x - 2.5}px, ${POINTER.y - 2.5}px)`;
  });

  (function animateCursor() {
    POINTER.easedX = lerp(POINTER.easedX, POINTER.x, 0.12);
    POINTER.easedY = lerp(POINTER.easedY, POINTER.y, 0.12);
    POINTER.parallaxX = (POINTER.easedX / window.innerWidth) - 0.5;
    POINTER.parallaxY = (POINTER.easedY / window.innerHeight) - 0.5;
    DOM.cursorRing.style.transform = `translate(${POINTER.easedX - 14}px, ${POINTER.easedY - 14}px)`;
    requestAnimationFrame(animateCursor);
  })();
}

// ==================== CANVAS & BACKGROUND ====================
const ctx = DOM.canvas.getContext('2d');

const SCENE = {
  width: 0,
  height: 0,
  centerX: 0,
  centerY: 0,
  time: 0
};

function resizeScene() {
  SCENE.width = DOM.canvas.width = window.innerWidth;
  SCENE.height = DOM.canvas.height = window.innerHeight;
  SCENE.centerX = SCENE.width / 2;
  SCENE.centerY = SCENE.height / 2;
}

resizeScene();
window.addEventListener('resize', resizeScene);

// ==================== AUDIO ====================
function updateAudioButton() {
  if (!soundtrackAvailable) {
    DOM.audioToggle.textContent = '[ trilha indisponivel ]';
    DOM.audioToggle.disabled = true;
    return;
  }
  DOM.audioToggle.disabled = false;
  DOM.audioToggle.textContent = DOM.soundtrack.paused ? '[ tocar trilha ]' : '[ pausar trilha ]';
}

async function playSoundtrack(forceLoopStart = false) {
  if (!soundtrackAvailable || !soundtrackReady) return;
  if (forceLoopStart || DOM.soundtrack.currentTime < SOUNDTRACK_LOOP_START) {
    DOM.soundtrack.currentTime = SOUNDTRACK_LOOP_START;
  }
  DOM.soundtrack.volume = SOUNDTRACK_VOLUME;
  try {
    await DOM.soundtrack.play();
    soundtrackPausedByUser = false;
    soundtrackAutostartPending = false;
  } catch (e) {}
  updateAudioButton();
}

function pauseSoundtrack() {
  if (!soundtrackAvailable) return;
  DOM.soundtrack.pause();
  soundtrackPausedByUser = true;
  soundtrackAutostartPending = false;
  updateAudioButton();
}

function toggleSoundtrack() {
  if (!soundtrackAvailable) return;
  if (DOM.soundtrack.paused) playSoundtrack(true);
  else pauseSoundtrack();
}

// Eventos de áudio
DOM.soundtrack.addEventListener('canplaythrough', () => {
  soundtrackReady = true;
  updateAudioButton();
});

DOM.soundtrack.addEventListener('error', () => {
  soundtrackAvailable = false;
  updateAudioButton();
});

DOM.soundtrack.addEventListener('timeupdate', () => {
  if (DOM.soundtrack.paused || !Number.isFinite(DOM.soundtrack.duration)) return;
  if (DOM.soundtrack.currentTime >= DOM.soundtrack.duration - 0.12) {
    DOM.soundtrack.currentTime = SOUNDTRACK_LOOP_START;
    DOM.soundtrack.play().catch(() => {});
  }
});

document.addEventListener('keydown', (e) => {
  if (['Enter', ' '].includes(e.key)) maybeAutostartSoundtrack(e);
});

DOM.audioToggle.addEventListener('click', toggleSoundtrack);

// ==================== INICIALIZAÇÃO ====================
function init() {
  setupCursor();
  updateAudioButton();

  // Clique nos planetas (você precisa completar a lógica de clique no canvas)
  // Exemplo básico:
  DOM.canvas.addEventListener('click', (e) => {
    // Aqui você pode adicionar a detecção de clique nos planetas interativos
    console.log('Canvas clicado em:', e.clientX, e.clientY);
    // openGoalCard(GOALS[0]); // exemplo
  });

  // Fechar card
  DOM.backButton.addEventListener('click', closeGoalCard);
  DOM.morseButton.addEventListener('click', toggleGoalMessageMode);

  // Atualizar relógio
  setInterval(() => {
    const now = getBrasiliaParts();
    renderHudClock(now);
    SCENE.time += 0.016; // para animações do canvas
    // drawBackground(); // descomente quando terminar a função drawBackground
  }, 16);

  // Autostart da trilha ao interagir
  document.addEventListener('click', () => {
    if (soundtrackAutostartPending) playSoundtrack(true);
  }, { once: true });
}

window.onload = init;