'use strict';

// [dom]
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
  goalGalaxy: document.getElementById('goal-galaxy'),
  goalCard: document.getElementById('goal-card'),
  goalCardInner: document.querySelector('.gc-inner'),
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

// [time]
const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';
const GOAL_UTC_OFFSET_HOURS = 3;
const SOUNDTRACK_LOOP_START = 90;
const SOUNDTRACK_VOLUME = 0.48;
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const TAU = Math.PI * 2;
const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
let ambientAudio = null;

function pad(value, length = 2) {
  return String(Math.max(0, value)).padStart(length, '0');
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function easeOutCubic(value) {
  const safeValue = clamp(value, 0, 1);
  return 1 - ((1 - safeValue) ** 3);
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
  DOM.headerTime.textContent =
    `${pad(brtNow.hour)}:${pad(brtNow.minute)}:${pad(brtNow.second)}.${pad(brtNow.millisecond, 3)}`;
  DOM.headerDate.textContent =
    `${brtNow.weekday} | ${pad(brtNow.day)} ${MONTHS[brtNow.month - 1]} ${brtNow.year}`;
}

const MORSE_MAP = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  0: '-----',
  1: '.----',
  2: '..---',
  3: '...--',
  4: '....-',
  5: '.....',
  6: '-....',
  7: '--...',
  8: '---..',
  9: '----.',
  ',': '--..--',
  '.': '.-.-.-',
  '/': '-..-.',
  '?': '..--..',
  '-': '-....-'
};

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

// [goals]
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

const GOALS = [
  createGoal({
    id: 'fisico',
    n: '01/05',
    title: 'Campeonato de Fisiculturismo',
    sub: 'Mens Physique | Palco',
    year: 2025,
    monthIndex: 10,
    day: 30,
    hour: 12,
    desc: 'O palco sempre foi o destino. A categoria Mens Physique exige arquitetura corporal milimetrica, condicionamento seco, postura limpa e leitura de palco sem vacilo. O objetivo nao e apenas subir bem; e apresentar um conjunto coerente, com cintura controlada, dorsais abertas, ombros dominantes e presenca suficiente para que o jurado pare na sua linha.',
    details: [
      ['foco central', 'simetria, condicionamento e presenca de palco'],
      ['janela critica', 'ultima semana de ajustes, descanso e refinamento visual'],
      ['ritual de entrada', 'chegar leve, aquecido e mentalmente frio']
    ]
  }),
  createGoal({
    id: 'enem1',
    n: '02/05',
    title: 'ENEM - Primeiro Dia',
    sub: 'Linguagens | Humanas | Redacao',
    year: 2025,
    monthIndex: 10,
    day: 9,
    hour: 13,
    desc: 'O primeiro dia do ENEM pede organizacao mental e energia verbal. A redacao precisa sair com tese clara, repertorio util, proposta de intervencao completa e desenvolvimento sem quebra de coerencia. O restante da prova exige leitura limpa, administracao do tempo e zero ansiedade desperdicando atencao.',
    details: [
      ['foco central', 'redacao completa e leitura sem ruida'],
      ['janela critica', 'primeira hora define o ritmo do dia inteiro'],
      ['ritual de entrada', 'agua, respiracao, leitura do tema e estrutura rapida']
    ]
  }),
  createGoal({
    id: 'enem2',
    n: '03/05',
    title: 'ENEM - Segundo Dia',
    sub: 'Matematica | Ciencias da Natureza',
    year: 2025,
    monthIndex: 10,
    day: 16,
    hour: 13,
    desc: 'O segundo dia do ENEM nao perdoa desgaste. A prova cobra resistencia, selecao inteligente de questoes e sangue frio para manter precisao quando o cansaco pesa. O objetivo aqui e proteger pontos: acertar o que foi treinado, nao travar em itens longos e preservar tempo para a reta final.',
    details: [
      ['foco central', 'gestao de tempo e precisao sob fadiga'],
      ['janela critica', 'metade da prova, quando o corpo pede queda de ritmo'],
      ['ritual de entrada', 'varrer faceis, marcar duvidas e voltar com metodo']
    ]
  }),
  createGoal({
    id: 'casamento',
    n: '04/05',
    title: 'Casamento',
    sub: 'Cerimonia | Nova Coordenada',
    year: 2025,
    monthIndex: 11,
    day: 16,
    hour: 19,
    desc: 'Esse momento nao e so cerimonial. E a passagem formal para uma vida alinhada em outro nivel de responsabilidade, afeto e memoria. O objetivo nao e apenas fazer a agenda acontecer; e viver a noite com presenca real, sem ruido, sem distraicao e com a lucidez de quem sabe que nunca mais vai repetir esse instante.',
    details: [
      ['foco central', 'presenca total e memoria viva da noite'],
      ['janela critica', 'horas anteriores a cerimonia, quando tudo acelera'],
      ['ritual de entrada', 'respirar, desacelerar e chegar inteiro para o sim']
    ]
  }),
  createGoal({
    id: 'finlandia',
    n: '05/05',
    title: 'Viagem a Finlandia',
    sub: 'Helsinki | Partida Internacional',
    year: 2027,
    monthIndex: 3,
    day: 1,
    hour: 16,
    minute: 50,
    desc: 'A viagem para a Finlandia representa um horizonte maior: liberdade comprada com planejamento, silencio merecido e expansao de vida. O objetivo nao e apenas emitir passagem e embarcar; e construir condicao financeira, emocional e pratica para que a partida nao seja fuga, mas conquista.',
    details: [
      ['foco central', 'planejamento, reserva e execucao sem pressa'],
      ['janela critica', 'meses antes do embarque, quando tudo precisa convergir'],
      ['ritual de entrada', 'documentos, bagagem, mente limpa e saida sem caos']
    ]
  })
];

let activeGoal = null;
let goalTimer = null;
let goalCardAnimationTimer = null;
let goalGalaxyTimer = null;

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
  if (!activeGoal) {
    return;
  }

  const distance = getGoalDistance(activeGoal.date);

  DOM.goalStatus.textContent = distance.isFuture
    ? 'objetivo em contagem regressiva'
    : 'objetivo concluido';
  DOM.goalCountLabel.textContent = distance.isFuture
    ? 'tempo restante'
    : 'tempo desde o evento';

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

function renderGoalMessage() {
  if (!activeGoal) {
    return;
  }

  const isMorse = goalMessageMode === 'morse';
  DOM.goalDescription.textContent = isMorse
    ? toDigitalMorse(activeGoal.desc)
    : activeGoal.desc;
  DOM.goalDescription.classList.toggle('morse', isMorse);
  DOM.morseButton.textContent = isMorse
    ? 'Ver em texto'
    : 'Ver em morse';
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

function restartGoalCardAnimation() {
  if (goalCardAnimationTimer) {
    clearTimeout(goalCardAnimationTimer);
    goalCardAnimationTimer = null;
  }

  DOM.goalCard.classList.remove('is-animating');
  void DOM.goalCard.offsetWidth;
  DOM.goalCard.classList.add('is-animating');

  goalCardAnimationTimer = window.setTimeout(() => {
    DOM.goalCard.classList.remove('is-animating');
    goalCardAnimationTimer = null;
  }, 1400);
}

function restartGoalGalaxyReveal(callback) {
  if (goalGalaxyTimer) {
    clearTimeout(goalGalaxyTimer);
    goalGalaxyTimer = null;
  }

  DOM.goalCard.classList.remove('open', 'is-animating');
  DOM.html.classList.remove('goal-galaxy-active');
  void DOM.goalGalaxy.offsetWidth;
  DOM.html.classList.add('goal-galaxy-active');

  goalGalaxyTimer = window.setTimeout(() => {
    DOM.html.classList.remove('goal-galaxy-active');
    goalGalaxyTimer = null;
    callback();
  }, PREFERS_REDUCED_MOTION ? 0 : 820);
}

function openGoalCard(goal) {
  activeGoal = goal;
  goalMessageMode = 'text';
  DOM.goalNumber.textContent = goal.n;
  DOM.goalTitle.textContent = goal.title;
  DOM.goalWhen.textContent = `${goal.dateLabel} | ${goal.sub}`;
  DOM.hint.style.opacity = '0';
  DOM.html.classList.add('goal-card-open');

  if (goalTimer) {
    clearInterval(goalTimer);
  }

  renderGoalMessage();
  renderGoalDetails();
  renderGoalCountdown();
  goalTimer = window.setInterval(renderGoalCountdown, 1000);
  DOM.goalCardInner.scrollTop = 0;
  restartGoalGalaxyReveal(() => {
    if (activeGoal !== goal) {
      return;
    }

    DOM.goalCard.classList.add('open');
    restartGoalCardAnimation();
  });
}

function closeGoalCard() {
  activeGoal = null;
  goalMessageMode = 'text';
  DOM.goalDescription.classList.remove('morse');
  DOM.goalDetailGrid.innerHTML = '';
  DOM.goalCard.classList.remove('open', 'is-animating');
  DOM.html.classList.remove('goal-card-open', 'goal-galaxy-active');
  DOM.hint.style.opacity = '';

  if (goalTimer) {
    clearInterval(goalTimer);
    goalTimer = null;
  }

  if (goalCardAnimationTimer) {
    clearTimeout(goalCardAnimationTimer);
    goalCardAnimationTimer = null;
  }

  if (goalGalaxyTimer) {
    clearTimeout(goalGalaxyTimer);
    goalGalaxyTimer = null;
  }
}

function toggleGoalMessageMode() {
  if (!activeGoal) {
    return;
  }

  goalMessageMode = goalMessageMode === 'text' ? 'morse' : 'text';
  renderGoalMessage();
}

// [cursor]
const POINTER = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  easedX: window.innerWidth / 2,
  easedY: window.innerHeight / 2,
  parallaxX: 0,
  parallaxY: 0,
  previousX: window.innerWidth / 2,
  previousY: window.innerHeight / 2,
  velocity: 0,
  isDown: false,
  isHoveringTarget: false,
  trail: [],
  customCursorEnabled: window.matchMedia('(pointer: fine)').matches
};

function pushCursorTrail(x, y) {
  if (PREFERS_REDUCED_MOTION) {
    return;
  }

  const dx = x - POINTER.previousX;
  const dy = y - POINTER.previousY;
  const speed = Math.min(Math.hypot(dx, dy), 64);
  POINTER.velocity = lerp(POINTER.velocity, speed, 0.32);

  if (speed < 1.8 && POINTER.trail.length) {
    return;
  }

  POINTER.trail.push({
    x,
    y,
    vx: -dx * 0.012 + randomBetween(-0.08, 0.08),
    vy: -dy * 0.012 + randomBetween(-0.08, 0.08),
    life: 1,
    radius: randomBetween(2.6, 6.8) + speed * 0.035,
    warm: Math.random() > 0.42
  });

  while (POINTER.trail.length > 58) {
    POINTER.trail.shift();
  }

  POINTER.previousX = x;
  POINTER.previousY = y;
}

function updateCursorIntent(event) {
  const target = event.target instanceof Element
    ? event.target.closest('button, a, [role="button"], input, textarea, select')
    : null;
  const overWatch = Boolean(getWatchFromPointer(event.clientX, event.clientY));
  const hoveredPlanet = getPlanetFromPointer(event.clientX, event.clientY);
  const hoveredGalaxy = getGalaxyFromPointer(event.clientX, event.clientY);
  const overSpaceTarget = Boolean(overWatch || getMarkerFromPointer(event.clientX, event.clientY) || hoveredPlanet || hoveredGalaxy);

  SPACE_INTERACTION.planetHoverId = hoveredPlanet ? hoveredPlanet.id : null;
  SPACE_INTERACTION.galaxyHoverId = hoveredGalaxy ? hoveredGalaxy.id : null;
  POINTER.isHoveringTarget = Boolean(target || overSpaceTarget);
  WATCH_INTERACTION.targetHover = overWatch ? 1 : 0;
  DOM.html.classList.toggle('cursor-target', POINTER.isHoveringTarget);
}

function setupCursor() {
  if (!POINTER.customCursorEnabled) {
    return;
  }

  DOM.html.classList.add('has-custom-cursor');

  document.addEventListener('pointermove', (event) => {
    POINTER.x = event.clientX;
    POINTER.y = event.clientY;
    pushCursorTrail(POINTER.x, POINTER.y);
    updateCursorIntent(event);
    if (!PREFERS_REDUCED_MOTION && POINTER.velocity > 9 && Math.random() < 0.11) {
      createSpaceRipple(event.clientX, event.clientY, clamp(POINTER.velocity / 48, 0.12, 0.8));
    }
    DOM.cursor.style.transform = `translate(${POINTER.x}px, ${POINTER.y}px) translate(-50%, -50%) scale(var(--cursor-core-scale))`;
  });

  document.addEventListener('pointerdown', () => {
    POINTER.isDown = true;
    DOM.html.classList.add('cursor-pressing');
  });

  document.addEventListener('pointerup', () => {
    POINTER.isDown = false;
    DOM.html.classList.remove('cursor-pressing');
  });

  document.addEventListener('pointercancel', () => {
    POINTER.isDown = false;
    DOM.html.classList.remove('cursor-pressing');
  });

  (function animateCursor() {
    const easing = POINTER.isDown ? 0.22 : 0.14;
    POINTER.easedX = lerp(POINTER.easedX, POINTER.x, easing);
    POINTER.easedY = lerp(POINTER.easedY, POINTER.y, easing);
    POINTER.parallaxX = (POINTER.easedX / window.innerWidth) - 0.5;
    POINTER.parallaxY = (POINTER.easedY / window.innerHeight) - 0.5;
    requestAnimationFrame(animateCursor);
  }());
}

// [canvas]
const ctx = DOM.canvas.getContext('2d');

const SCENE = {
  width: 0,
  height: 0,
  centerX: 0,
  centerY: 0,
  pixelRatio: 1,
  time: 0,
  warp: 0,
  warpTarget: 0,
  scrollGravity: 0,
  audioEnergy: 0,
  intro: PREFERS_REDUCED_MOTION ? 1 : 0
};

const interactiveMarkers = [];

const WATCH_INTERACTION = {
  cx: 0,
  cy: 0,
  radius: 0,
  hover: 0,
  targetHover: 0,
  bursts: [],
  sparkles: []
};

const SPACE_INTERACTION = {
  planetHoverId: null,
  galaxyHoverId: null,
  orbitTrails: [],
  planetBursts: [],
  galaxyBursts: []
};

function resizeScene() {
  SCENE.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  SCENE.width = window.innerWidth;
  SCENE.height = window.innerHeight;
  SCENE.centerX = SCENE.width / 2;
  SCENE.centerY = SCENE.height / 2;
  DOM.canvas.width = Math.round(SCENE.width * SCENE.pixelRatio);
  DOM.canvas.height = Math.round(SCENE.height * SCENE.pixelRatio);
  DOM.canvas.style.width = `${SCENE.width}px`;
  DOM.canvas.style.height = `${SCENE.height}px`;
  ctx.setTransform(SCENE.pixelRatio, 0, 0, SCENE.pixelRatio, 0, 0);
}

resizeScene();
window.addEventListener('resize', resizeScene);

// [helpers]
function roundedRectPath(x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function drawSoftGlow(x, y, radius, colorStops) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

  colorStops.forEach(([offset, color]) => {
    gradient.addColorStop(offset, color);
  });

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

function getGravityFieldAt(x, y, radiusScale = 0.34) {
  const dx = x - SCENE.centerX;
  const dy = y - SCENE.centerY;
  const distance = Math.hypot(dx, dy) || 1;
  const influenceRadius = Math.min(SCENE.width, SCENE.height) * radiusScale;
  const field = clamp(1 - distance / influenceRadius, 0, 1);
  const horizon = Math.min(SCENE.width, SCENE.height) * 0.17;
  const nearHorizon = clamp(1 - Math.abs(distance - horizon) / (horizon * 0.5), 0, 1);

  return {
    dx,
    dy,
    distance,
    nx: dx / distance,
    ny: dy / distance,
    field,
    nearHorizon,
    timeScale: lerp(1, 0.42, field * field)
  };
}

function drawLensedEcho(x, y, radius, opacity, warm) {
  const gravity = getGravityFieldAt(x, y, 0.42);

  if (gravity.nearHorizon <= 0.02) {
    return;
  }

  const tangentX = -gravity.ny;
  const tangentY = gravity.nx;
  const offset = 7 + gravity.nearHorizon * 18;
  const alpha = opacity * gravity.nearHorizon * 0.22;

  [-1, 1].forEach((direction) => {
    ctx.beginPath();
    ctx.ellipse(
      x + tangentX * offset * direction,
      y + tangentY * offset * direction,
      radius * (1.2 + gravity.nearHorizon * 1.6),
      Math.max(0.5, radius * 0.44),
      Math.atan2(tangentY, tangentX),
      0,
      TAU
    );
    ctx.fillStyle = warm
      ? `rgba(255, 176, 104, ${alpha})`
      : `rgba(172, 214, 255, ${alpha})`;
    ctx.fill();
  });
}

function getGoalsForDisplayHour(displayHour) {
  const morningHour = displayHour === 12 ? 0 : displayHour;
  const eveningHour = displayHour === 12 ? 12 : displayHour + 12;

  return GOALS.filter((goal) =>
    goal.hour === displayHour ||
    goal.hour === morningHour ||
    goal.hour === eveningHour
  );
}

function updateAudioButton() {
  if (!soundtrackAvailable) {
    DOM.audioToggle.textContent = 'Trilha indisponivel';
    DOM.audioToggle.disabled = true;
    return;
  }

  DOM.audioToggle.disabled = false;

  if (!soundtrackReady) {
    DOM.audioToggle.textContent = 'Carregando trilha';
    return;
  }

  DOM.audioToggle.textContent = DOM.soundtrack.paused
    ? 'Tocar trilha'
    : 'Pausar trilha';
}

function seekSoundtrackToLoopStart(force = false) {
  if (!soundtrackReady || !soundtrackAvailable) {
    return;
  }

  if (force || DOM.soundtrack.currentTime < SOUNDTRACK_LOOP_START) {
    DOM.soundtrack.currentTime = SOUNDTRACK_LOOP_START;
  }
}

async function playSoundtrack(forceLoopStart = false) {
  if (!soundtrackAvailable || !soundtrackReady) {
    updateAudioButton();
    return;
  }

  seekSoundtrackToLoopStart(forceLoopStart);
  DOM.soundtrack.volume = SOUNDTRACK_VOLUME;

  try {
    await DOM.soundtrack.play();
    startAmbientAudio();
    soundtrackPausedByUser = false;
    soundtrackAutostartPending = false;
  } catch (error) {
    console.warn('Nao foi possivel iniciar a trilha local automaticamente.', error);
  }

  updateAudioButton();
}

function pauseSoundtrack() {
  if (!soundtrackAvailable) {
    return;
  }

  DOM.soundtrack.pause();
  soundtrackPausedByUser = true;
  soundtrackAutostartPending = false;

  if (ambientAudio) {
    const now = ambientAudio.audioContext.currentTime;
    ambientAudio.master.gain.cancelScheduledValues(now);
    ambientAudio.master.gain.linearRampToValueAtTime(0, now + 0.6);
  }

  updateAudioButton();
}

function toggleSoundtrack() {
  if (!soundtrackAvailable) {
    return;
  }

  if (DOM.soundtrack.paused) {
    const shouldReset = DOM.soundtrack.currentTime < SOUNDTRACK_LOOP_START || DOM.soundtrack.ended;
    playSoundtrack(shouldReset);
    return;
  }

  pauseSoundtrack();
}

function onSoundtrackReady() {
  soundtrackReady = true;
  DOM.soundtrack.volume = SOUNDTRACK_VOLUME;
  updateAudioButton();
}

function onSoundtrackError() {
  soundtrackAvailable = false;
  soundtrackReady = false;
  updateAudioButton();
  console.warn('Nao foi possivel carregar o arquivo msc.mp3.');
}

function onSoundtrackTimeUpdate() {
  if (!soundtrackReady || !soundtrackAvailable || DOM.soundtrack.paused || !Number.isFinite(DOM.soundtrack.duration)) {
    return;
  }

  if (DOM.soundtrack.currentTime >= DOM.soundtrack.duration - 0.12) {
    seekSoundtrackToLoopStart(true);
    DOM.soundtrack.play().catch(() => {});
  }
}

function maybeAutostartSoundtrack(event) {
  if (!soundtrackAutostartPending || !soundtrackAvailable || !soundtrackReady || !DOM.soundtrack.paused) {
    return;
  }

  if (event && event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  if (event && event.target === DOM.audioToggle) {
    return;
  }

  playSoundtrack(true);
}

function setupAmbientAudio() {
  if (ambientAudio || !window.AudioContext) {
    return ambientAudio;
  }

  const audioContext = new AudioContext();
  const master = audioContext.createGain();
  const hum = audioContext.createOscillator();
  const sub = audioContext.createOscillator();
  const humGain = audioContext.createGain();
  const subGain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  hum.type = 'sine';
  sub.type = 'triangle';
  hum.frequency.value = 72;
  sub.frequency.value = 36;
  humGain.gain.value = 0.018;
  subGain.gain.value = 0.008;
  filter.type = 'lowpass';
  filter.frequency.value = 460;
  master.gain.value = 0;

  hum.connect(humGain);
  sub.connect(subGain);
  humGain.connect(filter);
  subGain.connect(filter);
  filter.connect(master);
  master.connect(audioContext.destination);
  hum.start();
  sub.start();

  ambientAudio = { audioContext, master, hum, sub, humGain, subGain };
  return ambientAudio;
}

function startAmbientAudio() {
  const audio = setupAmbientAudio();

  if (!audio) {
    return;
  }

  audio.audioContext.resume().then(() => {
    const now = audio.audioContext.currentTime;
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.linearRampToValueAtTime(0.038, now + 1.2);
  }).catch(() => {});
}

function pulseAmbientAudio(amount = 0.4) {
  if (!ambientAudio) {
    return;
  }

  const now = ambientAudio.audioContext.currentTime;
  const gain = clamp(0.035 + amount * 0.035, 0.03, 0.08);
  ambientAudio.master.gain.cancelScheduledValues(now);
  ambientAudio.master.gain.linearRampToValueAtTime(gain, now + 0.08);
  ambientAudio.master.gain.linearRampToValueAtTime(0.038, now + 0.9);
  ambientAudio.hum.frequency.setTargetAtTime(72 + amount * 12, now, 0.14);
  ambientAudio.sub.frequency.setTargetAtTime(36 + amount * 5, now, 0.2);
}

// [background]
function lensPoint(x, y, strength = 1) {
  const dx = x - SCENE.centerX;
  const dy = y - SCENE.centerY;
  const distance = Math.hypot(dx, dy);
  const influenceRadius = Math.min(SCENE.width, SCENE.height) * 0.34;

  if (!distance || distance >= influenceRadius) {
    return { x, y };
  }

  const falloff = 1 - distance / influenceRadius;
  const radialPush = falloff * falloff * 20 * strength;
  const swirl = falloff * 7 * strength;
  const nx = dx / distance;
  const ny = dy / distance;

  const centerX = x + (nx * radialPush) - (ny * swirl);
  const centerY = y + (ny * radialPush) + (nx * swirl * 0.8);
  const pointerDx = centerX - POINTER.easedX;
  const pointerDy = centerY - POINTER.easedY;
  const pointerDistance = Math.hypot(pointerDx, pointerDy);
  const pointerRadius = Math.min(SCENE.width, SCENE.height) * 0.28;

  if (!POINTER.customCursorEnabled || !pointerDistance || pointerDistance >= pointerRadius) {
    return { x: centerX, y: centerY };
  }

  const pointerFalloff = 1 - pointerDistance / pointerRadius;
  const pull = pointerFalloff * pointerFalloff * 22 * strength;

  return {
    x: centerX - (pointerDx / pointerDistance) * pull + Math.sin(SCENE.time + pointerDistance * 0.012) * pointerFalloff * 2.2,
    y: centerY - (pointerDy / pointerDistance) * pull + Math.cos(SCENE.time + pointerDistance * 0.01) * pointerFalloff * 2.2
  };
}

function createStarLayer(count, depth, minRadius, maxRadius, minOpacity, maxOpacity) {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    depth,
    radius: randomBetween(minRadius, maxRadius),
    opacity: randomBetween(minOpacity, maxOpacity),
    phase: Math.random() * TAU,
    speed: randomBetween(0.18, 1.5),
    warm: Math.random() > 0.9,
    icy: Math.random() > 0.76,
    sparkle: Math.random() > 0.992
  }));
}

const STAR_LAYERS = [
  createStarLayer(840, 0.07, 0.18, 0.96, 0.08, 0.26),
  createStarLayer(420, 0.16, 0.28, 1.38, 0.1, 0.44),
  createStarLayer(220, 0.28, 0.54, 2.3, 0.16, 0.8)
];

const SPACE_DUST = Array.from({ length: 24 }, (_, index) => ({
  y: 0.08 + index * 0.045 + randomBetween(-0.01, 0.01),
  width: randomBetween(0.14, 0.28),
  opacity: randomBetween(0.012, 0.038),
  phase: Math.random() * TAU,
  speed: randomBetween(0.18, 0.42)
}));

const DISTANT_GALAXIES = [
  {
    id: 'andromeda-warm',
    anchorX: 0.115,
    anchorY: 0.78,
    radius: 0.036,
    depth: 0.026,
    rotation: -0.34,
    arms: 4,
    hue: 'warm',
    phase: Math.random() * TAU
  },
  {
    id: 'blue-spiral',
    anchorX: 0.88,
    anchorY: 0.73,
    radius: 0.026,
    depth: 0.032,
    rotation: 0.48,
    arms: 3,
    hue: 'cold',
    phase: Math.random() * TAU
  },
  {
    id: 'far-signal',
    anchorX: 0.58,
    anchorY: 0.12,
    radius: 0.018,
    depth: 0.022,
    rotation: -0.08,
    arms: 2,
    hue: 'neutral',
    phase: Math.random() * TAU
  }
];

const BACKGROUND_PLANETS = [
  {
    id: 'saturn',
    anchorX: 0.112,
    anchorY: 0.19,
    radius: 0.128,
    depth: 0.11,
    type: 'gas',
    palette: ['#efe6d6', '#d1c2aa', '#a98b67', '#6f5945'],
    atmosphere: 'rgba(255, 236, 210, 0.24)',
    glow: 'rgba(231, 202, 156, 0.14)',
    lightBoost: 0.1,
    rotationSpeed: 0.0022,
    rotationOffset: 1.2,
    userRotation: 0,
    userTilt: 0,
    tilt: -0.08,
    ring: {
      tilt: -0.27,
      inner: 1.18,
      outer: 1.96,
      flatten: 0.3,
      palette: ['rgba(214, 204, 188, 0.15)', 'rgba(244, 236, 220, 0.28)', 'rgba(162, 146, 128, 0.12)']
    },
    interactive: true
  },
  {
    id: 'terra',
    anchorX: 0.915,
    anchorY: 0.43,
    radius: 0.062,
    depth: 0.14,
    type: 'earth',
    ocean: '#274a78',
    land: '#7d8b72',
    cloud: 'rgba(236, 244, 255, 0.34)',
    atmosphere: 'rgba(138, 184, 255, 0.34)',
    glow: 'rgba(92, 140, 255, 0.13)',
    lightBoost: 0.04,
    rotationSpeed: 0.0022,
    rotationOffset: 0.6,
    userRotation: 0,
    userTilt: 0,
    tilt: 0.06,
    interactive: true
  },
  {
    id: 'lua-a',
    anchorX: 0.745,
    anchorY: 0.112,
    radius: 0.012,
    depth: 0.07,
    type: 'rock',
    palette: ['#978f8d', '#6d6768', '#413d40'],
    atmosphere: 'rgba(255,255,255,0)',
    glow: 'rgba(255, 255, 255, 0)',
    rotationSpeed: 0.0016,
    rotationOffset: 1.8,
    userRotation: 0,
    userTilt: 0,
    tilt: 0,
    interactive: true
  },
  {
    id: 'lua-b',
    anchorX: 0.782,
    anchorY: 0.094,
    radius: 0.01,
    depth: 0.08,
    type: 'rock',
    palette: ['#85756c', '#5a4d48', '#2e2624'],
    atmosphere: 'rgba(255,255,255,0)',
    glow: 'rgba(255,255,255,0)',
    rotationSpeed: 0.0013,
    rotationOffset: 2.4,
    userRotation: 0,
    userTilt: 0,
    tilt: 0,
    interactive: true
  },
  {
    id: 'lua-c',
    anchorX: 0.816,
    anchorY: 0.082,
    radius: 0.008,
    depth: 0.09,
    type: 'rock',
    palette: ['#b9b4ae', '#7e7a74', '#46423f'],
    atmosphere: 'rgba(255,255,255,0)',
    glow: 'rgba(255,255,255,0)',
    rotationSpeed: 0.0018,
    rotationOffset: 0.1,
    userRotation: 0,
    userTilt: 0,
    tilt: 0,
    interactive: true
  }
];

const ASTEROID_CLUSTER = Array.from({ length: 22 }, () => ({
  anchorX: 0.705 + Math.random() * 0.16,
  anchorY: 0.065 + Math.random() * 0.09,
  radius: randomBetween(0.0018, 0.0054),
  depth: 0.1 + Math.random() * 0.05,
  rotation: Math.random() * TAU,
  drift: Math.random() * TAU,
  speed: randomBetween(0.15, 0.42),
  opacity: randomBetween(0.18, 0.62)
}));

const METEOR_STREAMS = Array.from({ length: 8 }, (_, index) => ({
  anchorX: randomBetween(-0.18, 1.05),
  anchorY: randomBetween(0.04, 0.48),
  length: randomBetween(0.08, 0.2),
  speed: randomBetween(0.045, 0.09),
  phase: index / 8,
  angle: randomBetween(0.62, 0.82),
  opacity: randomBetween(0.18, 0.48),
  cool: Math.random() > 0.46
}));

const GRAVITY_DUST = Array.from({ length: 220 }, () => ({
  angle: Math.random() * TAU,
  orbit: randomBetween(1.25, 2.82),
  speed: randomBetween(0.11, 0.42),
  wobble: randomBetween(0.02, 0.12),
  size: randomBetween(0.45, 1.7),
  opacity: randomBetween(0.12, 0.52),
  phase: Math.random() * TAU,
  warm: Math.random() > 0.34
}));

const REACTIVE_DUST = Array.from({ length: 170 }, () => ({
  x: Math.random(),
  y: Math.random(),
  vx: randomBetween(-0.08, 0.08),
  vy: randomBetween(-0.08, 0.08),
  depth: randomBetween(0.18, 0.92),
  radius: randomBetween(0.45, 1.45),
  opacity: randomBetween(0.08, 0.34),
  phase: Math.random() * TAU,
  warm: Math.random() > 0.55
}));

const CONSTELLATION_STARS = Array.from({ length: 34 }, () => ({
  x: randomBetween(0.08, 0.92),
  y: randomBetween(0.1, 0.88),
  depth: randomBetween(0.04, 0.16),
  radius: randomBetween(0.8, 1.9),
  phase: Math.random() * TAU
}));

const MICRO_ORBIT_PLANETS = Array.from({ length: 9 }, () => ({
  anchorX: randomBetween(0.12, 0.88),
  anchorY: randomBetween(0.14, 0.82),
  orbitX: randomBetween(18, 76),
  orbitY: randomBetween(8, 32),
  radius: randomBetween(1.8, 4.6),
  speed: randomBetween(0.08, 0.24),
  phase: Math.random() * TAU,
  depth: randomBetween(0.02, 0.09),
  warm: Math.random() > 0.5
}));

const planetHitZones = [];
const galaxyHitZones = [];
const PLANET_INTERACTION = {
  activeId: null,
  lastX: 0,
  lastY: 0
};

function projectBackgroundPoint(anchorX, anchorY, depth, driftX = 0, driftY = 0) {
  return {
    x: (anchorX + POINTER.parallaxX * depth + driftX) * SCENE.width,
    y: (anchorY + POINTER.parallaxY * depth + driftY) * SCENE.height
  };
}

function drawNebulaBlob(anchorX, anchorY, radiusScale, colors) {
  const radius = Math.min(SCENE.width, SCENE.height) * radiusScale;
  const point = projectBackgroundPoint(
    anchorX,
    anchorY,
    0.02,
    Math.sin(SCENE.time * 0.05 + anchorX * 10) * 0.002,
    Math.cos(SCENE.time * 0.04 + anchorY * 12) * 0.002
  );
  const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.38, colors[1]);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SCENE.width, SCENE.height);
}

function drawNebulaVeil(anchorX, anchorY, radiusXScale, radiusYScale, rotation, colors) {
  const point = projectBackgroundPoint(
    anchorX,
    anchorY,
    0.018,
    Math.sin(SCENE.time * 0.03 + anchorX * 7) * 0.0018,
    Math.cos(SCENE.time * 0.025 + anchorY * 9) * 0.0016
  );
  const radiusX = SCENE.width * radiusXScale;
  const radiusY = SCENE.height * radiusYScale;

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(rotation);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(radiusX, radiusY));
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.36, colors[1]);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, TAU);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

function drawReferenceNebulae() {
  drawNebulaBlob(0.16, 0.58, 0.48, ['rgba(182, 86, 42, 0.14)', 'rgba(50, 18, 10, 0.28)']);
  drawNebulaBlob(0.26, 0.36, 0.32, ['rgba(120, 82, 42, 0.09)', 'rgba(24, 12, 8, 0.2)']);
  drawNebulaVeil(0.18, 0.46, 0.26, 0.16, -0.82, ['rgba(255, 170, 110, 0.08)', 'rgba(64, 24, 12, 0.16)']);
  drawNebulaVeil(0.23, 0.52, 0.18, 0.1, -0.3, ['rgba(210, 128, 82, 0.08)', 'rgba(52, 18, 12, 0.16)']);

  drawNebulaBlob(0.77, 0.34, 0.46, ['rgba(90, 132, 214, 0.16)', 'rgba(10, 24, 62, 0.26)']);
  drawNebulaBlob(0.84, 0.3, 0.22, ['rgba(226, 238, 255, 0.16)', 'rgba(72, 110, 188, 0.12)']);
  drawNebulaVeil(0.82, 0.3, 0.12, 0.16, 0.54, ['rgba(210, 232, 255, 0.14)', 'rgba(38, 72, 152, 0.1)']);
  drawNebulaVeil(0.8, 0.36, 0.1, 0.12, -0.42, ['rgba(160, 198, 255, 0.1)', 'rgba(20, 44, 102, 0.08)']);

  const darkCloud = ctx.createRadialGradient(SCENE.width * 0.79, SCENE.height * 0.31, 0, SCENE.width * 0.79, SCENE.height * 0.31, Math.min(SCENE.width, SCENE.height) * 0.16);
  darkCloud.addColorStop(0, 'rgba(8, 14, 26, 0.5)');
  darkCloud.addColorStop(0.45, 'rgba(4, 8, 18, 0.24)');
  darkCloud.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = darkCloud;
  ctx.fillRect(0, 0, SCENE.width, SCENE.height);

  const brightRight = ctx.createRadialGradient(SCENE.width * 0.82, SCENE.height * 0.31, 0, SCENE.width * 0.82, SCENE.height * 0.31, Math.min(SCENE.width, SCENE.height) * 0.12);
  brightRight.addColorStop(0, 'rgba(236, 248, 255, 0.28)');
  brightRight.addColorStop(0.28, 'rgba(156, 202, 255, 0.14)');
  brightRight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = brightRight;
  ctx.fillRect(0, 0, SCENE.width, SCENE.height);
}

function drawCinematicSpaceLight() {
  const shift = Math.sin(SCENE.time * 0.18 + POINTER.parallaxX * 2.2) * 0.5 + 0.5;
  const coldLight = ctx.createRadialGradient(
    SCENE.width * 0.84,
    SCENE.height * 0.32,
    0,
    SCENE.width * 0.84,
    SCENE.height * 0.32,
    Math.min(SCENE.width, SCENE.height) * 0.28
  );
  coldLight.addColorStop(0, `rgba(186, 214, 255, ${0.13 + shift * 0.05})`);
  coldLight.addColorStop(0.32, `rgba(98, 142, 232, ${0.06 + shift * 0.04})`);
  coldLight.addColorStop(1, 'rgba(10, 20, 40, 0)');
  ctx.fillStyle = coldLight;
  ctx.fillRect(0, 0, SCENE.width, SCENE.height);

  const warmDust = ctx.createRadialGradient(
    SCENE.width * 0.18,
    SCENE.height * 0.68,
    0,
    SCENE.width * 0.18,
    SCENE.height * 0.68,
    Math.min(SCENE.width, SCENE.height) * 0.34
  );
  warmDust.addColorStop(0, `rgba(255, 138, 72, ${0.06 + (1 - shift) * 0.05})`);
  warmDust.addColorStop(0.28, `rgba(134, 46, 18, ${0.06 + (1 - shift) * 0.04})`);
  warmDust.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = warmDust;
  ctx.fillRect(0, 0, SCENE.width, SCENE.height);
}

function drawDustBands() {
  SPACE_DUST.forEach((band) => {
    const y = band.y * SCENE.height + Math.sin(SCENE.time * band.speed + band.phase) * 8;
    const width = band.width * SCENE.width;
    const startX = (Math.sin(SCENE.time * band.speed * 0.6 + band.phase) * 0.2 + 0.4) * SCENE.width - width * 0.5;
    const gradient = ctx.createLinearGradient(startX, y, startX + width, y);

    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.5, `rgba(255, 232, 198, ${band.opacity})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + width, y);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

function drawReactiveDust() {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  REACTIVE_DUST.forEach((dust) => {
    const rawX = dust.x * SCENE.width;
    const rawY = dust.y * SCENE.height;
    const gravityField = getGravityFieldAt(rawX, rawY, 0.52);
    const targetX = rawX + POINTER.parallaxX * dust.depth * 52;
    const targetY = rawY + POINTER.parallaxY * dust.depth * 52;
    const dx = POINTER.easedX - targetX;
    const dy = POINTER.easedY - targetY;
    const distance = Math.hypot(dx, dy) || 1;
    const influence = clamp(1 - distance / 220, 0, 1);
    const gravity = influence * influence * (0.018 + dust.depth * 0.018);
    const flow = Math.sin(SCENE.time * 0.8 + dust.phase) * 0.02;
    const centerAccel = gravityField.field * gravityField.field * (0.026 + dust.depth * 0.02);

    dust.vx += (dx / distance) * gravity + flow;
    dust.vy += (dy / distance) * gravity + Math.cos(SCENE.time * 0.72 + dust.phase) * 0.018;
    dust.vx -= gravityField.nx * centerAccel;
    dust.vy -= gravityField.ny * centerAccel;
    dust.vx *= 0.965;
    dust.vy *= 0.965;
    dust.x = (dust.x + dust.vx / SCENE.width + 1) % 1;
    dust.y = (dust.y + dust.vy / SCENE.height + 1) % 1;

    if (gravityField.distance < Math.min(SCENE.width, SCENE.height) * 0.09) {
      dust.x = Math.random();
      dust.y = Math.random();
      dust.vx = randomBetween(-0.05, 0.05);
      dust.vy = randomBetween(-0.05, 0.05);
    }

    const point = lensPoint(dust.x * SCENE.width, dust.y * SCENE.height, 0.22 + dust.depth * 0.3);
    const alpha = dust.opacity + influence * 0.28 + gravityField.field * 0.14 + SCENE.audioEnergy * 0.12;

    ctx.beginPath();
    ctx.arc(point.x, point.y, dust.radius * (1 + influence * 1.8), 0, TAU);
    ctx.fillStyle = dust.warm
      ? `rgba(255, 202, 142, ${alpha})`
      : `rgba(172, 212, 255, ${alpha * 0.86})`;
    ctx.fill();
  });

  ctx.restore();
}

function drawConstellationLinks() {
  const pointerRadius = 190;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const points = CONSTELLATION_STARS.map((star) => {
    const driftX = Math.sin(SCENE.time * 0.16 + star.phase) * 0.002;
    const driftY = Math.cos(SCENE.time * 0.13 + star.phase) * 0.002;
    const point = projectBackgroundPoint(star.x, star.y, star.depth, driftX, driftY);
    const distance = Math.hypot(point.x - POINTER.easedX, point.y - POINTER.easedY);
    const active = clamp(1 - distance / pointerRadius, 0, 1);
    return { ...point, star, active };
  });

  points.forEach((point, index) => {
    for (let next = index + 1; next < points.length; next += 1) {
      const other = points[next];
      const distance = Math.hypot(point.x - other.x, point.y - other.y);
      const active = Math.max(point.active, other.active);

      if (distance > 145 || active <= 0.02) {
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(other.x, other.y);
      ctx.strokeStyle = `rgba(166, 214, 255, ${active * (1 - distance / 145) * 0.32})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  });

  points.forEach((point) => {
    const twinkle = 0.68 + 0.32 * Math.sin(SCENE.time * 1.1 + point.star.phase);
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.star.radius * (1 + point.active * 1.2), 0, TAU);
    ctx.fillStyle = `rgba(236, 244, 255, ${(0.22 + point.active * 0.52) * twinkle})`;
    ctx.fill();
  });

  ctx.restore();
}

function drawMicroOrbitPlanets() {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  MICRO_ORBIT_PLANETS.forEach((planet) => {
    const anchor = projectBackgroundPoint(planet.anchorX, planet.anchorY, planet.depth);
    const angle = planet.phase + SCENE.time * planet.speed;
    const x = anchor.x + Math.cos(angle) * planet.orbitX;
    const y = anchor.y + Math.sin(angle) * planet.orbitY;
    const alpha = 0.16 + 0.08 * Math.sin(SCENE.time + planet.phase);

    ctx.beginPath();
    ctx.ellipse(anchor.x, anchor.y, planet.orbitX, planet.orbitY, 0, 0, TAU);
    ctx.strokeStyle = `rgba(180, 214, 255, ${alpha * 0.42})`;
    ctx.lineWidth = 0.6;
    ctx.stroke();

    drawSoftGlow(x, y, planet.radius * 6, [
      [0, planet.warm ? 'rgba(255, 190, 112, 0.18)' : 'rgba(120, 190, 255, 0.16)'],
      [1, 'rgba(0,0,0,0)']
    ]);

    ctx.beginPath();
    ctx.arc(x, y, planet.radius, 0, TAU);
    ctx.fillStyle = planet.warm
      ? 'rgba(255, 204, 142, 0.72)'
      : 'rgba(176, 218, 255, 0.68)';
    ctx.fill();
  });

  ctx.restore();
}

function drawFifthDimensionGrid() {
  const spacing = Math.max(44, Math.min(SCENE.width, SCENE.height) * 0.065);
  const horizonY = SCENE.centerY + SCENE.height * 0.08;
  const shift = (SCENE.time * 18 + SCENE.scrollGravity * 0.08) % spacing;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let line = -8; line <= 8; line += 1) {
    const x = SCENE.centerX + line * spacing * 0.62 + POINTER.parallaxX * 26;

    ctx.beginPath();
    ctx.moveTo(lerp(x, SCENE.centerX, 0.1), horizonY - SCENE.height * 0.34);
    ctx.lineTo(SCENE.centerX + line * spacing * 2.7, SCENE.height + spacing);
    ctx.strokeStyle = 'rgba(110, 170, 255, 0.035)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  for (let row = 0; row < 12; row += 1) {
    const depth = row / 11;
    const y = horizonY + ((row * spacing + shift) ** 1.08) * 0.52;
    const width = SCENE.width * lerp(0.22, 1.18, depth);

    ctx.beginPath();
    ctx.moveTo(SCENE.centerX - width, y);
    ctx.lineTo(SCENE.centerX + width, y);
    ctx.strokeStyle = `rgba(255, 170, 98, ${0.045 * (1 - depth * 0.5)})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  ctx.restore();
}

function drawGravitationalWaves() {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let wave = 0; wave < 7; wave += 1) {
    const progress = wave / 6;
    const yBase = SCENE.height * lerp(0.24, 0.76, progress);
    const amp = lerp(8, 24, 1 - progress) * (1 + SCENE.warp * 0.7);

    ctx.beginPath();
    for (let step = 0; step <= 100; step += 1) {
      const t = step / 100;
      const x = t * SCENE.width;
      const pull = Math.max(0, 1 - Math.abs(x - POINTER.easedX) / 380);
      const y = yBase
        + Math.sin(t * TAU * 2.2 + SCENE.time * (0.72 + progress) + wave) * amp
        + Math.sin(t * TAU * 7 + SCENE.time * 0.4) * amp * 0.18
        - pull * 18 * Math.sin(SCENE.time + progress);

      if (step === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = `rgba(144, 202, 255, ${0.035 + progress * 0.018})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  ctx.restore();
}

function drawDeepFieldHighlights() {
  const highlights = [
    [0.35, 0.19, 0.004, 'rgba(255, 228, 194, 0.95)'],
    [0.67, 0.15, 0.005, 'rgba(255, 224, 178, 0.88)'],
    [0.77, 0.17, 0.006, 'rgba(202, 226, 255, 0.94)'],
    [0.805, 0.145, 0.0045, 'rgba(184, 214, 255, 0.9)']
  ];

  highlights.forEach(([anchorX, anchorY, size, color]) => {
    const point = projectBackgroundPoint(anchorX, anchorY, 0.04);
    const radius = Math.min(SCENE.width, SCENE.height) * size;

    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(point.x - radius * 5, point.y);
    ctx.lineTo(point.x + radius * 5, point.y);
    ctx.moveTo(point.x, point.y - radius * 5);
    ctx.lineTo(point.x, point.y + radius * 5);
    ctx.strokeStyle = color.replace(/0\.\d+\)/, '0.18)').replace('0.95)', '0.18)').replace('0.94)', '0.18)').replace('0.9)', '0.18)').replace('0.88)', '0.18)');
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

function drawAsteroids() {
  ASTEROID_CLUSTER.forEach((asteroid) => {
    const driftX = Math.sin(SCENE.time * asteroid.speed + asteroid.drift) * 0.002;
    const driftY = Math.cos(SCENE.time * asteroid.speed * 0.7 + asteroid.drift) * 0.0012;
    const point = projectBackgroundPoint(asteroid.anchorX, asteroid.anchorY, asteroid.depth, driftX, driftY);
    const radius = Math.min(SCENE.width, SCENE.height) * asteroid.radius;

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(asteroid.rotation + SCENE.time * asteroid.speed);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.2, radius * 0.84, 0, 0, TAU);
    ctx.fillStyle = `rgba(154, 148, 142, ${asteroid.opacity})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-radius * 0.18, -radius * 0.08, radius * 0.22, 0, TAU);
    ctx.fillStyle = `rgba(218, 210, 196, ${asteroid.opacity * 0.3})`;
    ctx.fill();
    ctx.restore();
  });
}

function drawPlanetSphereBase(x, y, radius, lightDirection, darkColor, lightColor, atmosphere) {
  const gradient = ctx.createRadialGradient(
    x - lightDirection.x * radius * 0.54,
    y - lightDirection.y * radius * 0.54,
    radius * 0.08,
    x,
    y,
    radius
  );
  gradient.addColorStop(0, lightColor);
  gradient.addColorStop(0.48, darkColor);
  gradient.addColorStop(1, '#050608');
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fillStyle = gradient;
  ctx.fill();

  if (atmosphere) {
    const rim = ctx.createRadialGradient(x, y, radius * 0.78, x, y, radius * 1.12);
    rim.addColorStop(0, 'rgba(255,255,255,0)');
    rim.addColorStop(0.88, atmosphere);
    rim.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.05, 0, TAU);
    ctx.strokeStyle = rim;
    ctx.lineWidth = radius * 0.1;
    ctx.stroke();
  }
}

function drawGasBands(planet, radius, rotation) {
  const palette = planet.palette;

  for (let band = 0; band < 24; band += 1) {
    const lat = lerp(-0.92, 0.92, band / 23);
    const y = lat * radius;
    const widthFactor = Math.sqrt(Math.max(0, 1 - lat * lat));
    const bandWidth = radius * (0.07 + Math.sin(band * 1.37 + rotation) * 0.012);
    const offsetX = Math.sin((lat * 8.6) + rotation * 1.8) * radius * 0.12;
    const color = palette[band % palette.length];

    ctx.beginPath();
    ctx.ellipse(offsetX, y, radius * widthFactor, bandWidth, 0, 0, TAU);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2 + widthFactor * 0.22;
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawEarthSurface(planet, radius, rotation) {
  for (let lat = 0; lat < 9; lat += 1) {
    const progress = lat / 8;
    const y = lerp(-radius * 0.82, radius * 0.82, progress);
    const widthFactor = Math.sqrt(Math.max(0, 1 - (y / radius) ** 2));

    ctx.beginPath();
    ctx.ellipse(0, y, radius * widthFactor, radius * 0.08, 0, 0, TAU);
    ctx.fillStyle = lat % 2 === 0 ? 'rgba(56, 92, 144, 0.18)' : 'rgba(22, 46, 88, 0.14)';
    ctx.fill();
  }

  const landSeeds = [
    [0.12, -0.16, 0.44, 0.18],
    [-0.24, 0.08, 0.34, 0.16],
    [0.3, 0.22, 0.22, 0.12],
    [-0.08, -0.28, 0.18, 0.09]
  ];

  landSeeds.forEach(([ox, oy, scaleX, scaleY], index) => {
    const offset = Math.sin(rotation + index * 1.4) * radius * 0.26;
    ctx.beginPath();
    for (let step = 0; step <= 28; step += 1) {
      const angle = (step / 28) * TAU;
      const irregular = 1 + Math.sin(angle * 3 + rotation + index) * 0.18 + Math.cos(angle * 5 - rotation * 0.6) * 0.09;
      const px = (ox * radius) + offset + Math.cos(angle) * radius * scaleX * irregular;
      const py = (oy * radius) + Math.sin(angle) * radius * scaleY * irregular;

      if (step === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(122, 138, 116, 0.8)';
    ctx.fill();
  });

  for (let cloud = 0; cloud < 12; cloud += 1) {
    const angle = cloud * 0.62 + rotation * 0.8;
    const x = Math.cos(angle) * radius * 0.42;
    const y = Math.sin(angle * 1.3) * radius * 0.38;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 0.18, radius * 0.06, angle * 0.3, 0, TAU);
    ctx.fillStyle = planet.cloud;
    ctx.fill();
  }
}

function drawRockSurface(planet, radius, rotation) {
  const colors = planet.palette;

  for (let ring = 0; ring < 5; ring += 1) {
    const cr = radius * (0.18 + ring * 0.14);
    ctx.beginPath();
    ctx.arc(Math.sin(rotation + ring) * radius * 0.16, Math.cos(rotation * 0.7 + ring) * radius * 0.14, cr, 0, TAU);
    ctx.fillStyle = colors[ring % colors.length];
    ctx.globalAlpha = 0.12 + ring * 0.04;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (let crater = 0; crater < 7; crater += 1) {
    const angle = crater * 0.84 + rotation;
    const x = Math.cos(angle) * radius * 0.42;
    const y = Math.sin(angle * 1.4) * radius * 0.34;
    ctx.beginPath();
    ctx.arc(x, y, radius * randomBetween(0.05, 0.11), 0, TAU);
    ctx.fillStyle = 'rgba(20, 20, 22, 0.16)';
    ctx.fill();
  }
}

function drawPlanetShadow(radius, lightDirection) {
  const gradient = ctx.createRadialGradient(
    lightDirection.x * radius * 0.1,
    lightDirection.y * radius * 0.1,
    radius * 0.34,
    -lightDirection.x * radius * 0.64,
    -lightDirection.y * radius * 0.64,
    radius * 1.12
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.68, 'rgba(0, 0, 0, 0.2)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.68)');
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fillStyle = gradient;
  ctx.fill();
}

function drawPlanetRingLayers(planet, radius, frontLayer) {
  if (!planet.ring) {
    return;
  }

  const rotation = planet.rotationOffset + planet.userRotation + SCENE.time * planet.rotationSpeed * 48;
  const ringTilt = planet.ring.tilt + planet.userTilt * 0.5;

  ctx.save();
  ctx.rotate(ringTilt);

  if (frontLayer) {
    ctx.beginPath();
    ctx.rect(-radius * 4, -radius * 4, radius * 8, radius * 8);
    ctx.arc(0, 0, radius * 1.01, 0, TAU, true);
    ctx.clip('evenodd');
  }

  for (let layer = 0; layer < 9; layer += 1) {
    const progress = layer / 8;
    const rx = radius * lerp(planet.ring.inner, planet.ring.outer, progress);
    const ry = rx * planet.ring.flatten;
    const gradient = ctx.createLinearGradient(-rx, 0, rx, 0);
    const color = planet.ring.palette[layer % planet.ring.palette.length];
    const alpha = frontLayer ? 0.18 + progress * 0.08 : 0.12 + progress * 0.05;

    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.16, color.replace(/0\.\d+\)/, `${alpha})`).replace(/0\)$/, `${alpha})`));
    gradient.addColorStop(0.5, `rgba(255, 244, 226, ${frontLayer ? 0.24 : 0.16})`);
    gradient.addColorStop(0.84, color.replace(/0\.\d+\)/, `${alpha})`).replace(/0\)$/, `${alpha})`));
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.beginPath();
    ctx.ellipse(0, Math.sin(rotation + layer * 0.6) * radius * 0.01, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = radius * 0.016;
    ctx.stroke();
  }

  ctx.restore();
}

function drawInteractivePlanet(planet) {
  const minDimension = Math.min(SCENE.width, SCENE.height);
  const driftX = Math.sin(SCENE.time * 0.04 + planet.rotationOffset) * 0.0015;
  const driftY = Math.cos(SCENE.time * 0.03 + planet.rotationOffset) * 0.0012;
  const point = projectBackgroundPoint(planet.anchorX, planet.anchorY, planet.depth, driftX, driftY);
  planet.hover = lerp(planet.hover || 0, SPACE_INTERACTION.planetHoverId === planet.id || PLANET_INTERACTION.activeId === planet.id ? 1 : 0, 0.1);

  const radius = minDimension * planet.radius * (1 + planet.hover * 0.08);
  const rotation = planet.rotationOffset + planet.userRotation + SCENE.time * planet.rotationSpeed * 48;
  const lightVectorRaw = {
    x: SCENE.centerX - point.x,
    y: SCENE.centerY - point.y
  };
  const lightLength = Math.hypot(lightVectorRaw.x, lightVectorRaw.y) || 1;
  const lightDirection = {
    x: lightVectorRaw.x / lightLength,
    y: lightVectorRaw.y / lightLength
  };

  if (planet.interactive) {
    planetHitZones.push({
      id: planet.id,
      x: point.x,
      y: point.y,
      radius: radius * 1.2
    });
  }

  drawSoftGlow(point.x, point.y, radius * (2.4 + planet.hover * 1.2), [
    [0, planet.hover > 0.02 ? 'rgba(255, 232, 190, 0.24)' : planet.glow || 'rgba(255,255,255,0.06)'],
    [1, 'rgba(0,0,0,0)']
  ]);

  if (planet.hover > 0.02) {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(SCENE.time * 0.48 + planet.rotationOffset);
    ctx.globalCompositeOperation = 'screen';

    for (let ring = 0; ring < 2; ring += 1) {
      const progress = ring / 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * lerp(1.42, 1.82, progress), radius * lerp(0.44, 0.62, progress), 0, 0, TAU);
      ctx.strokeStyle = `rgba(180, 218, 255, ${planet.hover * lerp(0.22, 0.1, progress)})`;
      ctx.lineWidth = Math.max(0.8, radius * 0.012);
      ctx.stroke();
    }

    ctx.restore();
  }

  if (planet.ring) {
    ctx.save();
    ctx.translate(point.x, point.y);
    drawPlanetRingLayers(planet, radius, false);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.clip();

  drawPlanetSphereBase(
    0,
    0,
    radius,
    lightDirection,
    planet.type === 'earth' ? '#173862' : planet.type === 'rock' ? planet.palette[1] : planet.palette[2],
    planet.type === 'earth' ? '#5384b5' : planet.type === 'rock' ? planet.palette[0] : planet.palette[0],
    planet.atmosphere
  );

  if (planet.type === 'gas') {
    drawGasBands(planet, radius, rotation);
  } else if (planet.type === 'earth') {
    drawEarthSurface(planet, radius, rotation);
  } else {
    drawRockSurface(planet, radius, rotation);
  }

  drawPlanetShadow(radius, lightDirection);
  ctx.restore();

  if (planet.ring) {
    ctx.save();
    ctx.translate(point.x, point.y);
    drawPlanetRingLayers(planet, radius, true);
    ctx.restore();
  }
}

function drawStars() {
  STAR_LAYERS.forEach((layer) => {
    layer.forEach((star) => {
      const parallaxX = POINTER.parallaxX * star.depth * 44;
      const parallaxY = POINTER.parallaxY * star.depth * 44;
      const x = star.x * SCENE.width + parallaxX;
      const y = star.y * SCENE.height + parallaxY;
      const gravity = getGravityFieldAt(x, y, 0.44);
      const localTime = SCENE.time * star.speed * gravity.timeScale;
      const twinkle = 0.62
        + 0.25 * Math.sin(star.phase + localTime)
        + 0.13 * Math.sin(star.phase * 1.7 + localTime * 0.37);
      const lensed = lensPoint(x, y, 0.26 + star.depth * 0.76);
      const opacity = clamp(star.opacity * twinkle, 0, 1);
      const warp = SCENE.warp * (0.7 + star.depth * 1.6);
      const dx = lensed.x - SCENE.centerX;
      const dy = lensed.y - SCENE.centerY;
      const distance = Math.hypot(dx, dy) || 1;

      ctx.beginPath();
      if (warp > 0.015) {
        const tail = Math.min(64, warp * 42);
        ctx.moveTo(lensed.x - (dx / distance) * tail, lensed.y - (dy / distance) * tail);
        ctx.lineTo(lensed.x + (dx / distance) * tail * 0.28, lensed.y + (dy / distance) * tail * 0.28);
        ctx.strokeStyle = star.warm
          ? `rgba(255, 218, 176, ${opacity * (0.45 + warp)})`
          : `rgba(202, 226, 255, ${opacity * (0.45 + warp)})`;
        ctx.lineWidth = Math.max(0.7, star.radius * (1 + warp));
        ctx.stroke();
      } else {
        ctx.arc(lensed.x, lensed.y, star.radius, 0, TAU);
        ctx.fillStyle = star.warm
          ? `rgba(255, 232, 190, ${opacity})`
          : star.icy
            ? `rgba(198, 220, 255, ${opacity})`
            : `rgba(236, 242, 255, ${opacity})`;
        ctx.fill();
        drawLensedEcho(lensed.x, lensed.y, star.radius, opacity, star.warm);
      }

      if (star.sparkle && opacity > 0.42) {
        ctx.beginPath();
        ctx.moveTo(lensed.x - star.radius * 3, lensed.y);
        ctx.lineTo(lensed.x + star.radius * 3, lensed.y);
        ctx.moveTo(lensed.x, lensed.y - star.radius * 3);
        ctx.lineTo(lensed.x, lensed.y + star.radius * 3);
        ctx.strokeStyle = `rgba(255, 248, 232, ${opacity * 0.2})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    });
  });
}

function drawDistantGalaxies() {
  DISTANT_GALAXIES.forEach((galaxy) => {
    galaxy.hover = lerp(galaxy.hover || 0, SPACE_INTERACTION.galaxyHoverId === galaxy.id ? 1 : 0, 0.09);

    const point = projectBackgroundPoint(
      galaxy.anchorX,
      galaxy.anchorY,
      galaxy.depth,
      Math.sin(SCENE.time * 0.018 + galaxy.phase) * 0.001,
      Math.cos(SCENE.time * 0.014 + galaxy.phase) * 0.001
    );
    const radius = Math.min(SCENE.width, SCENE.height) * galaxy.radius * (1 + galaxy.hover * 0.18);
    const hitRadius = radius * 3.1;
    const coreColor = galaxy.hue === 'cold'
      ? `rgba(204, 226, 255, ${0.34 + galaxy.hover * 0.26})`
      : galaxy.hue === 'warm'
        ? `rgba(255, 224, 188, ${0.32 + galaxy.hover * 0.26})`
        : `rgba(235, 238, 255, ${0.26 + galaxy.hover * 0.22})`;
    const armColor = galaxy.hue === 'cold'
      ? `rgba(94, 148, 255, ${0.16 + galaxy.hover * 0.2})`
      : galaxy.hue === 'warm'
        ? `rgba(255, 154, 84, ${0.14 + galaxy.hover * 0.2})`
        : `rgba(184, 198, 255, ${0.11 + galaxy.hover * 0.18})`;

    galaxyHitZones.push({
      id: galaxy.id,
      x: point.x,
      y: point.y,
      radius: hitRadius
    });

    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(galaxy.rotation + Math.sin(SCENE.time * 0.018 + galaxy.phase) * 0.04 + galaxy.hover * 0.08);
    ctx.globalCompositeOperation = 'screen';

    drawSoftGlow(0, 0, radius * 1.8, [
      [0, coreColor],
      [0.36, armColor],
      [1, 'rgba(0, 0, 0, 0)']
    ]);

    for (let arm = 0; arm < galaxy.arms; arm += 1) {
      ctx.beginPath();

      for (let step = 0; step <= 64; step += 1) {
        const progress = step / 64;
        const spiral = progress * 2.8 + arm * (TAU / galaxy.arms);
        const rx = progress * radius * 2.3;
        const ry = progress * radius * 0.72;
        const x = Math.cos(spiral) * rx;
        const y = Math.sin(spiral) * ry;

        if (step === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle = armColor;
      ctx.lineWidth = Math.max(0.55, radius * (0.045 + galaxy.hover * 0.018));
      ctx.stroke();
    }

    if (galaxy.hover > 0.02) {
      for (let orbit = 0; orbit < 3; orbit += 1) {
        const progress = orbit / 2;
        const rx = radius * lerp(1.8, 3.05, progress);
        const ry = radius * lerp(0.5, 0.88, progress);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, galaxy.hover * 0.24, SCENE.time * 0.7 + orbit, SCENE.time * 0.7 + orbit + Math.PI * lerp(0.55, 0.9, progress));
        ctx.strokeStyle = `rgba(255, 238, 206, ${galaxy.hover * lerp(0.22, 0.08, progress)})`;
        ctx.lineWidth = Math.max(0.7, radius * 0.026);
        ctx.stroke();
      }
    }

    ctx.restore();
  });
}

function createCelestialBurst(x, y, type) {
  if (PREFERS_REDUCED_MOTION) {
    return;
  }

  const target = type === 'galaxy'
    ? SPACE_INTERACTION.galaxyBursts
    : SPACE_INTERACTION.planetBursts;
  const count = type === 'galaxy' ? 72 : 36;

  target.push({
    type: 'ring',
    x,
    y,
    life: 1,
    radius: type === 'galaxy' ? 18 : 10,
    warm: type !== 'planet'
  });

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * TAU + randomBetween(-0.12, 0.12);
    const speed = type === 'galaxy' ? randomBetween(1.2, 4.8) : randomBetween(0.8, 3.2);
    const spread = type === 'galaxy' ? 1 : randomBetween(0.42, 0.76);

    target.push({
      type: 'spark',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * spread,
      life: randomBetween(0.55, 1),
      radius: type === 'galaxy' ? randomBetween(0.8, 2.7) : randomBetween(0.6, 1.9),
      phase: Math.random() * TAU,
      warm: Math.random() > (type === 'galaxy' ? 0.36 : 0.5)
    });
  }

  while (target.length > 180) {
    target.shift();
  }
}

function createSpaceRipple(x, y, strength = 1) {
  SPACE_INTERACTION.orbitTrails.push({
    x,
    y,
    life: 1,
    radius: 18 + strength * 18,
    tilt: randomBetween(-0.8, 0.8),
    warm: Math.random() > 0.45,
    ripple: true
  });

  while (SPACE_INTERACTION.orbitTrails.length > 16) {
    SPACE_INTERACTION.orbitTrails.shift();
  }
}

function drawCelestialBursts() {
  const groups = [
    SPACE_INTERACTION.galaxyBursts,
    SPACE_INTERACTION.planetBursts
  ];

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  groups.forEach((group) => {
    for (let index = group.length - 1; index >= 0; index -= 1) {
      const item = group[index];

      if (item.type === 'ring') {
        const alpha = item.life * item.life;
        ctx.beginPath();
        ctx.ellipse(item.x, item.y, item.radius * (2 - item.life), item.radius * (0.74 + (1 - item.life) * 1.2), item.phase || 0, 0, TAU);
        ctx.strokeStyle = item.warm
          ? `rgba(255, 214, 158, ${0.42 * alpha})`
          : `rgba(150, 210, 255, ${0.36 * alpha})`;
        ctx.lineWidth = Math.max(0.8, item.radius * 0.06 * item.life);
        ctx.stroke();
        item.radius += 3.6;
        item.life -= 0.032;
      } else {
        const alpha = item.life * item.life;
        item.vx += Math.sin(SCENE.time + item.phase) * 0.018;
        item.vy += Math.cos(SCENE.time * 0.7 + item.phase) * 0.014;
        item.vx *= 0.988;
        item.vy *= 0.988;
        item.x += item.vx;
        item.y += item.vy;
        item.life -= 0.018;

        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, TAU);
        ctx.fillStyle = item.warm
          ? `rgba(255, 228, 184, ${0.74 * alpha})`
          : `rgba(174, 218, 255, ${0.62 * alpha})`;
        ctx.fill();
      }

      if (item.life <= 0) {
        group.splice(index, 1);
      }
    }
  });

  for (let index = SPACE_INTERACTION.orbitTrails.length - 1; index >= 0; index -= 1) {
    const trail = SPACE_INTERACTION.orbitTrails[index];
    const alpha = trail.life * trail.life;

    ctx.save();
    ctx.translate(trail.x, trail.y);
    ctx.rotate(trail.tilt);
    ctx.beginPath();
    if (trail.ripple) {
      ctx.arc(0, 0, trail.radius * (2.5 - trail.life), 0, TAU);
    } else {
      ctx.ellipse(0, 0, trail.radius * (2 - trail.life), trail.radius * (0.34 + (1 - trail.life) * 0.82), 0, 0, TAU);
    }
    ctx.strokeStyle = trail.warm
      ? `rgba(255, 190, 112, ${0.32 * alpha})`
      : `rgba(144, 210, 255, ${0.3 * alpha})`;
    ctx.lineWidth = Math.max(0.8, trail.radius * 0.035 * trail.life);
    ctx.stroke();
    ctx.restore();

    trail.radius += 2.1;
    trail.life -= 0.022;

    if (trail.life <= 0) {
      SPACE_INTERACTION.orbitTrails.splice(index, 1);
    }
  }

  ctx.restore();
}

function drawMeteorStreams() {
  if (PREFERS_REDUCED_MOTION) {
    return;
  }

  METEOR_STREAMS.forEach((meteor) => {
    const cycle = (SCENE.time * meteor.speed + meteor.phase) % 1;
    const travel = cycle * 1.32;
    const x = (meteor.anchorX + travel) * SCENE.width;
    const y = (meteor.anchorY + travel * meteor.angle * 0.34) * SCENE.height;
    const length = meteor.length * Math.min(SCENE.width, SCENE.height);
    const tailX = x - Math.cos(meteor.angle) * length;
    const tailY = y - Math.sin(meteor.angle) * length;
    const fade = Math.sin(cycle * Math.PI);
    const gradient = ctx.createLinearGradient(tailX, tailY, x, y);

    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.72, meteor.cool
      ? `rgba(166, 214, 255, ${meteor.opacity * fade})`
      : `rgba(255, 186, 118, ${meteor.opacity * fade})`);
    gradient.addColorStop(1, `rgba(255, 248, 226, ${Math.min(0.84, meteor.opacity * 1.8 * fade)})`);

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  });
}

function drawRareVisitors() {
  const cycle = (SCENE.time * 0.018) % 1;

  if (cycle > 0.34) {
    return;
  }

  const fade = Math.sin((cycle / 0.34) * Math.PI);
  const x = lerp(-SCENE.width * 0.08, SCENE.width * 1.08, cycle / 0.34);
  const y = SCENE.height * (0.22 + 0.08 * Math.sin(SCENE.time * 0.37));
  const trail = 82;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.beginPath();
  ctx.moveTo(x - trail, y + trail * 0.16);
  ctx.lineTo(x, y);
  ctx.strokeStyle = `rgba(188, 224, 255, ${0.16 * fade})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(x - 2, y - 1, 4, 2);
  ctx.fillStyle = `rgba(255, 238, 204, ${0.42 * fade})`;
  ctx.fill();
  ctx.restore();
}

function drawCursorCometTrail() {
  if (!POINTER.customCursorEnabled || !POINTER.trail.length) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let index = POINTER.trail.length - 1; index >= 0; index -= 1) {
    const particle = POINTER.trail[index];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= 0.024;
    particle.radius *= 0.986;

    if (particle.life <= 0) {
      POINTER.trail.splice(index, 1);
      continue;
    }

    const alpha = particle.life * particle.life;
    const glow = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.radius * 4.2);
    glow.addColorStop(0, particle.warm
      ? `rgba(255, 228, 190, ${0.16 * alpha})`
      : `rgba(166, 210, 255, ${0.13 * alpha})`);
    glow.addColorStop(0.34, particle.warm
      ? `rgba(255, 150, 74, ${0.1 * alpha})`
      : `rgba(104, 154, 255, ${0.08 * alpha})`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * 4.2, 0, TAU);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, Math.max(0.4, particle.radius * 0.34), 0, TAU);
    ctx.fillStyle = particle.warm
      ? `rgba(255, 238, 210, ${0.5 * alpha})`
      : `rgba(206, 228, 255, ${0.44 * alpha})`;
    ctx.fill();
  }

  ctx.restore();
}

function drawBackground() {
  const base = ctx.createLinearGradient(0, 0, 0, SCENE.height);
  base.addColorStop(0, '#010208');
  base.addColorStop(0.38, '#030713');
  base.addColorStop(1, '#010207');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SCENE.width, SCENE.height);

  planetHitZones.length = 0;
  galaxyHitZones.length = 0;
  drawReferenceNebulae();
  drawCinematicSpaceLight();
  drawFifthDimensionGrid();
  drawGravitationalWaves();
  drawDustBands();
  drawReactiveDust();
  drawDistantGalaxies();
  drawStars();
  drawConstellationLinks();
  drawDeepFieldHighlights();
  drawMicroOrbitPlanets();
  BACKGROUND_PLANETS.forEach(drawInteractivePlanet);
  drawAsteroids();
  drawMeteorStreams();
  drawRareVisitors();
  drawCelestialBursts();
  drawCursorCometTrail();

  const centerGlow = ctx.createRadialGradient(
    SCENE.centerX,
    SCENE.centerY,
    0,
    SCENE.centerX,
    SCENE.centerY,
    Math.min(SCENE.width, SCENE.height) * 0.55
  );
  centerGlow.addColorStop(0, 'rgba(255, 120, 38, 0.03)');
  centerGlow.addColorStop(0.38, 'rgba(255, 90, 20, 0.045)');
  centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, SCENE.width, SCENE.height);

  const vignette = ctx.createRadialGradient(
    SCENE.centerX,
    SCENE.centerY,
    Math.min(SCENE.width, SCENE.height) * 0.18,
    SCENE.centerX,
    SCENE.centerY,
    Math.min(SCENE.width, SCENE.height) * 0.8
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, SCENE.width, SCENE.height);

  const redBlue = ctx.createLinearGradient(0, 0, SCENE.width, 0);
  const shift = Math.sin(SCENE.time * 0.16 + POINTER.parallaxX * 2) * 0.5 + 0.5;
  redBlue.addColorStop(0, `rgba(255, 82, 36, ${0.018 + (1 - shift) * 0.018})`);
  redBlue.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  redBlue.addColorStop(1, `rgba(72, 156, 255, ${0.018 + shift * 0.018})`);
  ctx.fillStyle = redBlue;
  ctx.fillRect(0, 0, SCENE.width, SCENE.height);
}

function drawSpacetimeLattice(cx, cy, watchRadius, timeValue) {
  const intro = easeOutCubic(SCENE.intro);
  const latticeRadius = watchRadius * 3.7;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = intro;
  ctx.globalCompositeOperation = 'screen';

  for (let ring = 0; ring < 9; ring += 1) {
    const progress = ring / 8;
    const distanceSpeed = lerp(1.55, 0.38, progress);
    const rx = latticeRadius * lerp(0.38, 1.26, progress);
    const ry = rx * lerp(0.16, 0.34, progress);
    const alpha = lerp(0.16, 0.024, progress);
    const wobble = Math.sin(timeValue * (0.45 + distanceSpeed * 0.18) + ring * 1.7) * watchRadius * lerp(0.028, 0.01, progress);

    ctx.beginPath();
    ctx.ellipse(0, wobble, rx * (1 + Math.sin(ring * 2.1) * 0.018), ry * (1 + Math.cos(ring * 1.3) * 0.026), Math.sin(ring) * 0.018, 0, TAU);
    ctx.strokeStyle = `rgba(144, 192, 255, ${alpha * (0.82 + 0.18 * Math.sin(timeValue * distanceSpeed + ring))})`;
    ctx.lineWidth = Math.max(0.7, watchRadius * lerp(0.006, 0.002, progress));
    ctx.stroke();
  }

  for (let spoke = 0; spoke < 28; spoke += 1) {
    const angle = (spoke / 28) * TAU + Math.sin(timeValue * 0.06 + spoke * 0.17) * 0.026;

    ctx.beginPath();
    for (let step = 0; step <= 44; step += 1) {
      const progress = step / 44;
      const gravityBend = Math.sin(progress * Math.PI) * 0.2;
      const radius = latticeRadius * lerp(0.24, 1.16, progress);
      const x = Math.cos(angle + gravityBend * (1 - progress)) * radius;
      const y = Math.sin(angle + gravityBend * (1 - progress)) * radius * 0.27;

      if (step === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = 'rgba(255, 224, 176, 0.035)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  ctx.restore();
}

function drawGravityDust(cx, cy, watchRadius, timeValue) {
  if (PREFERS_REDUCED_MOTION) {
    return;
  }

  const horizonRadius = watchRadius * 1.6;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'screen';

  GRAVITY_DUST.forEach((dust) => {
    const distanceScale = clamp((dust.orbit - 1.1) / 1.8, 0, 1);
    const orbitalSpeed = dust.speed * lerp(1.75, 0.46, distanceScale);
    const localTime = timeValue * lerp(0.62, 1, distanceScale);
    const angle = dust.angle + timeValue * orbitalSpeed;
    const pulse = Math.sin(localTime * 0.8 + dust.phase) * dust.wobble;
    const radius = horizonRadius * (dust.orbit + pulse);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.115;
    const front = Math.sin(angle) > 0 ? 1 : 0.46;
    const alpha = dust.opacity * front * (0.62 + 0.38 * Math.sin(localTime * 0.5 + dust.phase));

    ctx.beginPath();
    ctx.arc(x, y, dust.size, 0, TAU);
    ctx.fillStyle = dust.warm
      ? `rgba(255, 196, 124, ${alpha})`
      : `rgba(172, 212, 255, ${alpha * 0.72})`;
    ctx.fill();
  });

  ctx.restore();
}

function createWatchMagicBurst(point) {
  if (PREFERS_REDUCED_MOTION) {
    return;
  }

  WATCH_INTERACTION.bursts.push({
    x: point.x,
    y: point.y,
    life: 1,
    radius: WATCH_INTERACTION.radius * randomBetween(0.34, 0.52),
    phase: Math.random() * TAU
  });

  while (WATCH_INTERACTION.bursts.length > 6) {
    WATCH_INTERACTION.bursts.shift();
  }

  const originAngle = Math.atan2(point.y - WATCH_INTERACTION.cy, point.x - WATCH_INTERACTION.cx);

  for (let index = 0; index < 46; index += 1) {
    const angle = originAngle + randomBetween(-1.3, 1.3) + (index / 46) * TAU * 0.18;
    const speed = randomBetween(1.4, 5.8);

    WATCH_INTERACTION.sparkles.push({
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * speed + randomBetween(-0.45, 0.45),
      vy: Math.sin(angle) * speed + randomBetween(-0.45, 0.45),
      life: randomBetween(0.62, 1),
      radius: randomBetween(0.8, 2.8),
      phase: Math.random() * TAU,
      warm: Math.random() > 0.28
    });
  }

  while (WATCH_INTERACTION.sparkles.length > 180) {
    WATCH_INTERACTION.sparkles.shift();
  }
}

function drawWatchMagic(cx, cy, watchRadius, timeValue) {
  WATCH_INTERACTION.hover = lerp(WATCH_INTERACTION.hover, WATCH_INTERACTION.targetHover, 0.11);

  const hover = WATCH_INTERACTION.hover;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  if (hover > 0.01) {
    const pointerAngle = Math.atan2(POINTER.y - cy, POINTER.x - cx);
    const hoverPulse = 0.5 + 0.5 * Math.sin(timeValue * 3.4);

    for (let ring = 0; ring < 3; ring += 1) {
      const progress = ring / 2;
      const radius = watchRadius * lerp(0.86, 1.28, progress) * (1 + hoverPulse * 0.015);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, pointerAngle - 0.72 - progress * 0.16, pointerAngle + 0.72 + progress * 0.16);
      ctx.strokeStyle = `rgba(255, 220, 160, ${hover * lerp(0.34, 0.1, progress)})`;
      ctx.lineWidth = watchRadius * lerp(0.013, 0.005, progress);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.98, pointerAngle + Math.PI - 0.42, pointerAngle + Math.PI + 0.42);
      ctx.strokeStyle = `rgba(146, 208, 255, ${hover * lerp(0.2, 0.06, progress)})`;
      ctx.lineWidth = watchRadius * lerp(0.007, 0.003, progress);
      ctx.stroke();
    }

    for (let rune = 0; rune < 18; rune += 1) {
      const angle = (rune / 18) * TAU + timeValue * 0.22;
      const radius = watchRadius * (1.05 + Math.sin(timeValue * 1.5 + rune) * 0.018);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const tickLength = watchRadius * (0.028 + (rune % 3) * 0.008);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-tickLength, 0);
      ctx.lineTo(tickLength, 0);
      ctx.strokeStyle = `rgba(255, 238, 198, ${hover * (0.18 + (rune % 4) * 0.025)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    const beam = ctx.createRadialGradient(POINTER.x, POINTER.y, 0, POINTER.x, POINTER.y, watchRadius * 0.55);
    beam.addColorStop(0, `rgba(255, 236, 196, ${hover * 0.12})`);
    beam.addColorStop(0.36, `rgba(112, 178, 255, ${hover * 0.055})`);
    beam.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(POINTER.x, POINTER.y, watchRadius * 0.55, 0, TAU);
    ctx.fillStyle = beam;
    ctx.fill();
  }

  for (let index = WATCH_INTERACTION.bursts.length - 1; index >= 0; index -= 1) {
    const burst = WATCH_INTERACTION.bursts[index];
    const age = 1 - burst.life;
    const radius = burst.radius * (0.45 + age * 1.9);
    const alpha = burst.life * burst.life;

    ctx.beginPath();
    ctx.arc(burst.x, burst.y, radius, 0, TAU);
    ctx.strokeStyle = `rgba(255, 228, 184, ${0.46 * alpha})`;
    ctx.lineWidth = watchRadius * 0.01 * burst.life;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(burst.x, burst.y, radius * 0.62, burst.phase + timeValue, burst.phase + timeValue + Math.PI * 1.32);
    ctx.strokeStyle = `rgba(126, 198, 255, ${0.28 * alpha})`;
    ctx.lineWidth = watchRadius * 0.006 * burst.life;
    ctx.stroke();

    burst.life -= 0.028;

    if (burst.life <= 0) {
      WATCH_INTERACTION.bursts.splice(index, 1);
    }
  }

  for (let index = WATCH_INTERACTION.sparkles.length - 1; index >= 0; index -= 1) {
    const sparkle = WATCH_INTERACTION.sparkles[index];
    const dx = sparkle.x - cx;
    const dy = sparkle.y - cy;
    const swirl = 0.018;

    sparkle.vx += -dy * swirl * 0.01;
    sparkle.vy += dx * swirl * 0.01;
    sparkle.vx *= 0.982;
    sparkle.vy *= 0.982;
    sparkle.x += sparkle.vx;
    sparkle.y += sparkle.vy;
    sparkle.life -= 0.018;

    if (sparkle.life <= 0) {
      WATCH_INTERACTION.sparkles.splice(index, 1);
      continue;
    }

    const alpha = sparkle.life * sparkle.life;
    ctx.beginPath();
    ctx.arc(sparkle.x, sparkle.y, sparkle.radius, 0, TAU);
    ctx.fillStyle = sparkle.warm
      ? `rgba(255, 224, 176, ${0.78 * alpha})`
      : `rgba(174, 218, 255, ${0.6 * alpha})`;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(sparkle.x - sparkle.radius * 3.2, sparkle.y);
    ctx.lineTo(sparkle.x + sparkle.radius * 3.2, sparkle.y);
    ctx.strokeStyle = `rgba(255, 246, 220, ${0.12 * alpha})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  ctx.restore();
}

function drawChronoHalo(cx, cy, watchRadius, timeValue) {
  const orbitRadius = watchRadius * 2.58;
  const intro = easeOutCubic(SCENE.intro);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(lerp(0.96, 1, intro), lerp(0.96, 1, intro));
  ctx.globalAlpha = intro;
  ctx.globalCompositeOperation = 'screen';

  for (let ring = 0; ring < 3; ring += 1) {
    const ringProgress = ring / 2;
    const rx = orbitRadius * lerp(0.86, 1.26, ringProgress);
    const ry = orbitRadius * lerp(0.25, 0.39, ringProgress);
    const speed = lerp(0.082, 0.026, ringProgress);
    const rotation = timeValue * speed + ring * 0.72 + Math.sin(timeValue * 0.05 + ring) * 0.012;
    const alpha = 0.075 - ring * 0.014;

    ctx.save();
    ctx.rotate(rotation);

    for (let arc = 0; arc < 3; arc += 1) {
      const start = (arc / 3) * TAU + timeValue * speed * (1.8 + arc * 0.2);
      const length = lerp(0.34, 0.54, ringProgress) + Math.sin(timeValue * 0.22 + arc + ring) * 0.025;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, start, start + length);
      ctx.strokeStyle = arc % 2 === 0
        ? `rgba(255, 226, 178, ${alpha})`
        : `rgba(118, 218, 232, ${alpha * 0.8})`;
      ctx.lineWidth = Math.max(0.7, watchRadius * (0.007 - ring * 0.001));
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.save();
  ctx.rotate(-timeValue * 0.06);
  const sweep = ctx.createLinearGradient(-orbitRadius, 0, orbitRadius, 0);
  sweep.addColorStop(0, 'rgba(118, 218, 232, 0)');
  sweep.addColorStop(0.48, 'rgba(255, 246, 228, 0.12)');
  sweep.addColorStop(1, 'rgba(255, 154, 82, 0)');
  ctx.beginPath();
  ctx.ellipse(0, 0, orbitRadius * 1.18, orbitRadius * 0.34, 0, -0.12, 0.3);
  ctx.strokeStyle = sweep;
  ctx.lineWidth = Math.max(1, watchRadius * 0.01);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

// [black-hole]
function clipUpperAccretionLocal(horizonRadius) {
  ctx.beginPath();
  ctx.rect(-horizonRadius * 6.4, -horizonRadius * 4.8, horizonRadius * 12.8, horizonRadius * 4.9);
  ctx.clip();
}

function clipLowerAccretionLocal(horizonRadius) {
  ctx.beginPath();
  ctx.rect(-horizonRadius * 6.4, -horizonRadius * 0.12, horizonRadius * 12.8, horizonRadius * 4.9);
  ctx.clip();
}

function drawAccretionUpperShell(cx, cy, horizonRadius, timeValue) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'screen';
  clipUpperAccretionLocal(horizonRadius);

  const capGlow = ctx.createRadialGradient(0, -horizonRadius * 0.28, horizonRadius * 0.42, 0, -horizonRadius * 0.18, horizonRadius * 4.5);
  capGlow.addColorStop(0, 'rgba(255, 226, 194, 0.16)');
  capGlow.addColorStop(0.32, 'rgba(255, 150, 62, 0.12)');
  capGlow.addColorStop(1, 'rgba(255, 72, 18, 0)');
  ctx.beginPath();
  ctx.ellipse(0, -horizonRadius * 0.04, horizonRadius * 4.4, horizonRadius * 2.55, 0, 0, TAU);
  ctx.fillStyle = capGlow;
  ctx.fill();

  for (let layer = 0; layer < 32; layer += 1) {
    const ratio = layer / 31;
    const rx = horizonRadius * lerp(1.78, 4.3, ratio);
    const ry = horizonRadius * lerp(1.26, 2.42, ratio);
    const offsetY = -horizonRadius * (0.02 + ratio * 0.06) + Math.sin(timeValue * 0.24 + layer * 0.32) * horizonRadius * 0.008;
    const gradient = ctx.createLinearGradient(0, offsetY - ry, 0, offsetY + ry);
    const alpha = lerp(0.26, 0.04, ratio);

    gradient.addColorStop(0, 'rgba(255, 66, 12, 0)');
    gradient.addColorStop(0.16, `rgba(255, 98, 26, ${alpha * 0.86})`);
    gradient.addColorStop(0.48, `rgba(255, 242, 226, ${alpha + 0.12})`);
    gradient.addColorStop(0.76, `rgba(255, 146, 48, ${alpha})`);
    gradient.addColorStop(1, 'rgba(255, 78, 22, 0)');

    ctx.beginPath();
    ctx.ellipse(0, offsetY, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = horizonRadius * lerp(0.056, 0.012, ratio);
    ctx.stroke();
  }

  ctx.save();
  ctx.filter = 'blur(10px)';

  for (let glow = 0; glow < 7; glow += 1) {
    const ratio = glow / 6;
    const rx = horizonRadius * lerp(1.64, 3.8, ratio);
    const ry = horizonRadius * lerp(1.06, 1.94, ratio);
    const offsetY = -horizonRadius * (0.07 + ratio * 0.05);
    ctx.beginPath();
    ctx.ellipse(0, offsetY, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = `rgba(255, 162, 94, ${0.08 - ratio * 0.04})`;
    ctx.lineWidth = horizonRadius * 0.034;
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

function drawAccretionLowerShell(cx, cy, horizonRadius, timeValue) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'screen';
  clipLowerAccretionLocal(horizonRadius);

  for (let layer = 0; layer < 10; layer += 1) {
    const ratio = layer / 9;
    const rx = horizonRadius * lerp(1.02, 1.9, ratio);
    const ry = horizonRadius * lerp(0.62, 0.98, ratio);
    const offsetY = horizonRadius * (0.88 + ratio * 0.03) + Math.cos(timeValue * 0.2 + layer * 0.26) * horizonRadius * 0.005;
    const gradient = ctx.createLinearGradient(0, offsetY - ry, 0, offsetY + ry);
    const alpha = lerp(0.1, 0.022, ratio);

    gradient.addColorStop(0, 'rgba(255, 88, 22, 0)');
    gradient.addColorStop(0.22, `rgba(255, 116, 34, ${alpha})`);
    gradient.addColorStop(0.5, `rgba(255, 236, 214, ${alpha + 0.05})`);
    gradient.addColorStop(0.8, `rgba(255, 134, 42, ${alpha * 0.84})`);
    gradient.addColorStop(1, 'rgba(255, 88, 22, 0)');

    ctx.beginPath();
    ctx.ellipse(0, offsetY, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = horizonRadius * lerp(0.024, 0.007, ratio);
    ctx.stroke();
  }

  ctx.save();
  ctx.filter = 'blur(6px)';
  ctx.beginPath();
  ctx.ellipse(0, horizonRadius * 0.9, horizonRadius * 1.42, horizonRadius * 0.88, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(255, 150, 74, 0.05)';
  ctx.lineWidth = horizonRadius * 0.05;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawAccretionDiskBand(cx, cy, horizonRadius, timeValue) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'screen';

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, horizonRadius * 5.2, horizonRadius * 0.18, 0, 0, TAU);
  ctx.clip();

  for (let line = 0; line < 34; line += 1) {
    const progressY = line / 33;
    const bandY = lerp(-horizonRadius * 0.12, horizonRadius * 0.12, progressY);
    const centerBias = 1 - Math.abs((progressY - 0.5) * 2);
    const pathAlpha = 0.012 + centerBias * 0.05;
    const width = horizonRadius * 5.3;
    const gradient = ctx.createLinearGradient(-width, bandY, width, bandY);
    gradient.addColorStop(0, 'rgba(255, 88, 20, 0)');
    gradient.addColorStop(0.14, `rgba(255, 118, 30, ${pathAlpha * 0.86})`);
    gradient.addColorStop(0.5, `rgba(255, 245, 228, ${pathAlpha + 0.06})`);
    gradient.addColorStop(0.86, `rgba(255, 118, 30, ${pathAlpha * 0.86})`);
    gradient.addColorStop(1, 'rgba(255, 88, 20, 0)');

    ctx.beginPath();
    for (let step = 0; step <= 100; step += 1) {
      const progress = step / 100;
      const x = lerp(-width, width, progress);
      const y = bandY
        + Math.sin((progress * 8.6) + (timeValue * 1.12) + line * 0.21) * horizonRadius * 0.008
        + Math.cos((progress * 19.4) + line * 0.12) * horizonRadius * 0.0028;

      if (step === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 0.5 + centerBias * 0.55;
    ctx.stroke();
  }

  ctx.restore();

  for (let filament = 0; filament < 5; filament += 1) {
    const width = horizonRadius * lerp(4.5, 5.1, filament / 4);
    const y = Math.sin(timeValue * 0.54 + filament * 0.7) * horizonRadius * 0.008;
    const gradient = ctx.createLinearGradient(-width, y, width, y);
    gradient.addColorStop(0, 'rgba(255, 100, 24, 0)');
    gradient.addColorStop(0.16, 'rgba(255, 176, 98, 0.08)');
    gradient.addColorStop(0.5, 'rgba(255, 248, 236, 0.12)');
    gradient.addColorStop(0.84, 'rgba(255, 176, 98, 0.08)');
    gradient.addColorStop(1, 'rgba(255, 100, 24, 0)');

    ctx.beginPath();
    ctx.moveTo(-width, y);
    ctx.lineTo(width, y);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = horizonRadius * 0.008;
    ctx.stroke();
  }

  ctx.restore();
}

function drawEventHorizon(cx, cy, horizonRadius, timeValue) {
  drawSoftGlow(cx, cy, horizonRadius * 2.2, [
    [0, 'rgba(255, 136, 58, 0.025)'],
    [0.28, 'rgba(255, 84, 18, 0.045)'],
    [1, 'rgba(0, 0, 0, 0)']
  ]);

  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius * 1.028, 0, TAU);
  ctx.fillStyle = 'rgba(1, 1, 4, 0.98)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius, 0, TAU);
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius * 1.018, 0, TAU);
  ctx.strokeStyle = `rgba(255, 236, 214, ${0.11 + Math.sin(timeValue * 0.4) * 0.01})`;
  ctx.lineWidth = horizonRadius * 0.012;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius * 1.08, 0, TAU);
  ctx.strokeStyle = 'rgba(255, 118, 34, 0.06)';
  ctx.lineWidth = horizonRadius * 0.01;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, horizonRadius * 1.045, horizonRadius * 1.12, 0, 0, TAU);
  ctx.strokeStyle = `rgba(255, 218, 184, ${0.08 + Math.sin(timeValue * 0.28) * 0.01})`;
  ctx.lineWidth = horizonRadius * 0.012;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, horizonRadius * 1.11, horizonRadius * 1.19, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(255, 136, 44, 0.045)';
  ctx.lineWidth = horizonRadius * 0.009;
  ctx.stroke();
}

function drawUpperShellOverlay(cx, cy, horizonRadius, timeValue) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, SCENE.width, SCENE.height);
  ctx.arc(cx, cy, horizonRadius * 1.006, 0, TAU, true);
  ctx.clip('evenodd');
  ctx.beginPath();
  ctx.rect(0, 0, SCENE.width, cy + horizonRadius * 0.2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'screen';

  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.beginPath();
  ctx.ellipse(0, horizonRadius * 0.06, horizonRadius * 4.2, horizonRadius * 2.32, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(255, 214, 162, 0.16)';
  ctx.lineWidth = horizonRadius * 0.18;
  ctx.stroke();
  ctx.restore();

  for (let layer = 0; layer < 18; layer += 1) {
    const ratio = layer / 17;
    const rx = horizonRadius * lerp(1.92, 4.18, ratio);
    const ry = horizonRadius * lerp(1.3, 2.28, ratio);
    const offsetY = horizonRadius * (0.08 + ratio * 0.02) + Math.sin(timeValue * 0.22 + layer * 0.24) * horizonRadius * 0.004;
    const gradient = ctx.createLinearGradient(0, offsetY - ry, 0, offsetY + ry);
    const alpha = lerp(0.28, 0.04, ratio);

    gradient.addColorStop(0, 'rgba(255, 82, 18, 0)');
    gradient.addColorStop(0.14, `rgba(255, 126, 40, ${alpha})`);
    gradient.addColorStop(0.48, `rgba(255, 242, 224, ${alpha + 0.1})`);
    gradient.addColorStop(0.82, `rgba(255, 146, 52, ${alpha})`);
    gradient.addColorStop(1, 'rgba(255, 82, 18, 0)');

    ctx.beginPath();
    ctx.ellipse(0, offsetY, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = horizonRadius * lerp(0.05, 0.01, ratio);
    ctx.stroke();
  }

  ctx.restore();
}

function clipOutsideBlackHoleLocal(horizonRadius) {
  ctx.beginPath();
  ctx.rect(-horizonRadius * 6, -horizonRadius * 4.5, horizonRadius * 12, horizonRadius * 9);
  ctx.arc(0, 0, horizonRadius * 1.035, 0, TAU, true);
  ctx.clip('evenodd');
}

function drawBlackHoleEnvelope(cx, cy, horizonRadius, timeValue) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'screen';
  clipOutsideBlackHoleLocal(horizonRadius);

  ctx.save();
  ctx.filter = 'blur(14px)';
  for (let ring = 0; ring < 4; ring += 1) {
    const ratio = ring / 3;
    const rx = horizonRadius * lerp(2.72, 3.82, ratio);
    const ry = horizonRadius * lerp(1.34, 1.92, ratio);
    const y = -horizonRadius * 0.16 + Math.sin(timeValue * 0.14 + ring * 0.48) * horizonRadius * 0.01;

    ctx.beginPath();
    ctx.ellipse(0, y, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = `rgba(255, 182, 108, ${lerp(0.1, 0.03, ratio)})`;
    ctx.lineWidth = horizonRadius * 0.028;
    ctx.stroke();
  }
  ctx.restore();

  for (let layer = 0; layer < 14; layer += 1) {
    const ratio = layer / 13;
    const rx = horizonRadius * lerp(1.42, 3.08, ratio);
    const ry = horizonRadius * lerp(0.96, 1.74, ratio);
    const y = -horizonRadius * lerp(0.16, 0.56, ratio) + Math.sin(timeValue * 0.22 + layer * 0.34) * horizonRadius * 0.006;
    const gradient = ctx.createLinearGradient(0, y - ry, 0, y + ry);
    const alpha = lerp(0.28, 0.045, ratio);

    gradient.addColorStop(0, 'rgba(255, 84, 20, 0)');
    gradient.addColorStop(0.18, `rgba(255, 122, 38, ${alpha})`);
    gradient.addColorStop(0.5, `rgba(255, 244, 226, ${alpha + 0.08})`);
    gradient.addColorStop(0.82, `rgba(255, 150, 54, ${alpha})`);
    gradient.addColorStop(1, 'rgba(255, 84, 20, 0)');

    ctx.beginPath();
    ctx.ellipse(0, y, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = horizonRadius * lerp(0.042, 0.01, ratio);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBlackHoleDisk(cx, cy, horizonRadius, timeValue) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'screen';

  const diskRx = horizonRadius * 1.76;
  const diskRy = horizonRadius * 0.07;
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, diskRx);
  glow.addColorStop(0, 'rgba(255, 244, 226, 0.1)');
  glow.addColorStop(0.32, 'rgba(255, 148, 60, 0.07)');
  glow.addColorStop(1, 'rgba(255, 96, 28, 0)');
  ctx.beginPath();
  ctx.ellipse(0, 0, diskRx, diskRy, 0, 0, TAU);
  ctx.fillStyle = glow;
  ctx.fill();

  for (let ring = 0; ring < 2; ring += 1) {
    const ratio = ring;
    const rx = horizonRadius * lerp(1.48, 1.82, ratio);
    const ry = horizonRadius * lerp(0.042, 0.072, ratio);
    const y = Math.sin(timeValue * 0.5 + ring * 0.6) * horizonRadius * 0.004;
    const gradient = ctx.createLinearGradient(-rx, y, rx, y);
    const alpha = lerp(0.1, 0.045, ratio);

    gradient.addColorStop(0, 'rgba(255, 88, 20, 0)');
    gradient.addColorStop(0.2, `rgba(255, 136, 48, ${alpha})`);
    gradient.addColorStop(0.5, `rgba(255, 246, 228, ${alpha + 0.025})`);
    gradient.addColorStop(0.8, `rgba(255, 136, 48, ${alpha})`);
    gradient.addColorStop(1, 'rgba(255, 88, 20, 0)');

    ctx.beginPath();
    ctx.ellipse(0, y, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = horizonRadius * lerp(0.008, 0.005, ratio);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEventHorizonCore(cx, cy, horizonRadius, timeValue) {
  drawSoftGlow(cx, cy, horizonRadius * 2.5, [
    [0, 'rgba(255, 140, 52, 0.03)'],
    [0.32, 'rgba(255, 84, 18, 0.05)'],
    [1, 'rgba(0, 0, 0, 0)']
  ]);

  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius * 1.022, 0, TAU);
  ctx.fillStyle = 'rgba(2, 2, 6, 0.98)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius, 0, TAU);
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx, cy, horizonRadius * 1.04, horizonRadius * 1.1, 0, 0, TAU);
  ctx.strokeStyle = `rgba(255, 236, 214, ${0.09 + Math.sin(timeValue * 0.28) * 0.01})`;
  ctx.lineWidth = horizonRadius * 0.014;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, horizonRadius * 1.1, horizonRadius * 1.18, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(255, 132, 40, 0.045)';
  ctx.lineWidth = horizonRadius * 0.01;
  ctx.stroke();
}

function drawBlackHole(cx, cy, watchRadius, timeValue) {
  const horizonRadius = watchRadius * 1.6;

  drawBlackHoleEnvelope(cx, cy, horizonRadius, timeValue);
  drawAccretionDiskBand(cx, cy, horizonRadius, timeValue);
  drawEventHorizon(cx, cy, horizonRadius, timeValue);
  drawBlackHoleDisk(cx, cy, horizonRadius, timeValue);
  drawEventHorizonCore(cx, cy, horizonRadius, timeValue);
}

function drawFrontDiskAccent(cx, cy, watchRadius, timeValue) {
  const horizonRadius = watchRadius * 1.6;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, SCENE.width, SCENE.height);
  ctx.arc(cx, cy, watchRadius * 1.04, 0, TAU, true);
  ctx.clip('evenodd');
  ctx.translate(cx, cy);

  for (let layer = 0; layer < 3; layer += 1) {
    const rx = horizonRadius * (2.48 + layer * 0.24);
    const ry = horizonRadius * (0.03 + layer * 0.008);
    const gradient = ctx.createLinearGradient(-rx, 0, rx, 0);
    const alpha = 0.055 - layer * 0.012;

    gradient.addColorStop(0, 'rgba(255, 88, 24, 0)');
    gradient.addColorStop(0.22, `rgba(255, 138, 54, ${alpha})`);
    gradient.addColorStop(0.5, `rgba(255, 242, 224, ${alpha + 0.04})`);
    gradient.addColorStop(0.78, `rgba(255, 138, 54, ${alpha})`);
    gradient.addColorStop(1, 'rgba(255, 88, 24, 0)');

    ctx.beginPath();
    ctx.ellipse(0, Math.sin(timeValue * 0.4 + layer * 0.3) * horizonRadius * 0.008, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = horizonRadius * (0.012 + layer * 0.003);
    ctx.stroke();
  }

  ctx.restore();
}

function drawForegroundHorizonEllipse(cx, cy, watchRadius, timeValue) {
  const horizonRadius = watchRadius * 1.6;
  const innerRx = horizonRadius * 1.034;
  const innerRy = horizonRadius * 1.108;
  const outerRx = horizonRadius * 1.086;
  const outerRy = horizonRadius * 1.176;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  // Clip to exclude the watch face area so the ellipse rings only show outside the watch
  ctx.beginPath();
  ctx.rect(0, 0, SCENE.width, SCENE.height);
  ctx.arc(cx, cy, watchRadius * 1.04, 0, TAU, true);
  ctx.clip('evenodd');

  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, innerRx, innerRy, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.lineWidth = horizonRadius * 0.05;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.filter = 'blur(8px)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, innerRx, innerRy, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(255, 224, 186, 0.2)';
  ctx.lineWidth = horizonRadius * 0.038;
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.ellipse(cx, cy, innerRx, innerRy, 0, 0, TAU);
  ctx.strokeStyle = `rgba(255, 240, 220, ${0.34 + Math.sin(timeValue * 0.32) * 0.02})`;
  ctx.lineWidth = horizonRadius * 0.014;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, outerRx, outerRy, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(255, 146, 58, 0.11)';
  ctx.lineWidth = horizonRadius * 0.011;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, horizonRadius * 1.13, horizonRadius * 1.22, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(255, 104, 34, 0.055)';
  ctx.lineWidth = horizonRadius * 0.008;
  ctx.stroke();

  ctx.restore();
}

// [watch]
function drawWatchCase(cx, cy, caseRadius, timeValue) {
  drawSoftGlow(cx, cy, caseRadius * 1.9, [
    [0, 'rgba(34, 78, 194, 0.1)'],
    [0.44, 'rgba(18, 34, 108, 0.08)'],
    [1, 'rgba(0, 0, 0, 0)']
  ]);

  ctx.save();
  ctx.translate(cx, cy);

  [-1, 1].forEach((direction) => {
    const gradient = ctx.createLinearGradient(direction * caseRadius * 1.62, 0, direction * caseRadius * 0.84, 0);
    gradient.addColorStop(0, 'rgba(255, 174, 84, 0)');
    gradient.addColorStop(0.36, 'rgba(255, 190, 106, 0.12)');
    gradient.addColorStop(0.7, 'rgba(255, 202, 122, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 214, 148, 0)');

    ctx.beginPath();
    ctx.moveTo(direction * caseRadius * 0.92, -caseRadius * 0.54);
    ctx.lineTo(direction * caseRadius * 1.42, -caseRadius * 0.28);
    ctx.lineTo(direction * caseRadius * 1.48, caseRadius * 0.28);
    ctx.lineTo(direction * caseRadius * 0.92, caseRadius * 0.54);
    ctx.quadraticCurveTo(direction * caseRadius * 1.1, 0, direction * caseRadius * 0.92, -caseRadius * 0.54);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  });

  ctx.beginPath();
  ctx.arc(0, 0, caseRadius * 1.19, 0, TAU);
  ctx.strokeStyle = 'rgba(164, 142, 108, 0.08)';
  ctx.lineWidth = caseRadius * 0.015;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, caseRadius * 1.05, 0, TAU);
  ctx.strokeStyle = 'rgba(84, 114, 212, 0.14)';
  ctx.lineWidth = caseRadius * 0.05;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, caseRadius * 1.01, 0, TAU);
  ctx.strokeStyle = 'rgba(242, 216, 152, 0.18)';
  ctx.lineWidth = caseRadius * 0.01;
  ctx.stroke();

  ctx.restore();
}

function drawWatchDial(cx, cy, caseRadius, brtNow, timeValue) {
  const dialRadius = caseRadius * 0.94;
  const dialGradient = ctx.createRadialGradient(
    cx - dialRadius * 0.18,
    cy - dialRadius * 0.24,
    dialRadius * 0.02,
    cx,
    cy,
    dialRadius
  );
  dialGradient.addColorStop(0, 'rgba(4, 8, 20, 0.96)');
  dialGradient.addColorStop(0.58, 'rgba(3, 5, 12, 1)');
  dialGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');

  ctx.beginPath();
  ctx.arc(cx, cy, dialRadius, 0, TAU);
  ctx.fillStyle = dialGradient;
  ctx.fill();

  const blueRing = ctx.createRadialGradient(cx, cy, dialRadius * 0.76, cx, cy, dialRadius * 1.04);
  blueRing.addColorStop(0, 'rgba(66, 110, 255, 0)');
  blueRing.addColorStop(0.74, 'rgba(44, 76, 196, 0.34)');
  blueRing.addColorStop(1, 'rgba(70, 112, 255, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, dialRadius * 0.98, 0, TAU);
  ctx.strokeStyle = blueRing;
  ctx.lineWidth = caseRadius * 0.034;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, dialRadius * 1.16, 0, TAU);
  ctx.strokeStyle = 'rgba(74, 84, 150, 0.08)';
  ctx.lineWidth = caseRadius * 0.012;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, dialRadius * 0.99, 0, TAU);
  ctx.strokeStyle = 'rgba(218, 192, 122, 0.18)';
  ctx.lineWidth = caseRadius * 0.012;
  ctx.stroke();

  for (let tick = 0; tick < 60; tick += 1) {
    const angle = tick * (TAU / 60) - Math.PI / 2;
    const isHourTick = tick % 5 === 0;
    const outerRadius = dialRadius * 0.94;
    const innerRadius = isHourTick ? dialRadius * 0.8 : dialRadius * 0.87;
    const x1 = cx + Math.cos(angle) * innerRadius;
    const y1 = cy + Math.sin(angle) * innerRadius;
    const x2 = cx + Math.cos(angle) * outerRadius;
    const y2 = cy + Math.sin(angle) * outerRadius;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = isHourTick ? 'rgba(214, 188, 114, 0.48)' : 'rgba(168, 150, 104, 0.14)';
    ctx.lineWidth = isHourTick ? 1.2 : 0.7;
    ctx.stroke();
  }

  interactiveMarkers.length = 0;

  for (let hour = 1; hour <= 12; hour += 1) {
    const angle = hour * (TAU / 12) - Math.PI / 2;
    const goalsAtHour = getGoalsForDisplayHour(hour);
    const numeralRadius = dialRadius * 1.08;
    const markerRadius = dialRadius * 0.71;
    const numeralX = cx + Math.cos(angle) * numeralRadius;
    const numeralY = cy + Math.sin(angle) * numeralRadius;
    const markerX = cx + Math.cos(angle) * markerRadius;
    const markerY = cy + Math.sin(angle) * markerRadius;
    const markerActive = activeGoal && goalsAtHour.some((goal) => goal.id === activeGoal.id);
    const pulse = 0.55 + 0.45 * Math.sin(timeValue * 1.7 + hour * 0.62);

    if (goalsAtHour.length) {
      ctx.beginPath();
      ctx.moveTo(
        cx + Math.cos(angle) * dialRadius * 0.34,
        cy + Math.sin(angle) * dialRadius * 0.34
      );
      ctx.lineTo(
        cx + Math.cos(angle) * dialRadius * 0.62,
        cy + Math.sin(angle) * dialRadius * 0.62
      );
      ctx.strokeStyle = `rgba(220, 178, 84, ${0.28 + pulse * 0.22})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      drawSoftGlow(markerX, markerY, caseRadius * 0.09, [
        [0, `rgba(255, 238, 196, ${markerActive ? 0.26 : 0.16})`],
        [0.36, `rgba(255, 178, 74, ${markerActive ? 0.22 : 0.12})`],
        [1, 'rgba(255, 114, 26, 0)']
      ]);

      ctx.beginPath();
      ctx.arc(markerX, markerY, caseRadius * 0.018, 0, TAU);
      ctx.fillStyle = `rgba(255, 222, 138, ${0.68 + pulse * 0.2})`;
      ctx.fill();

      interactiveMarkers.push({
        x: markerX,
        y: markerY,
        radius: caseRadius * 0.09,
        goals: goalsAtHour
      });
    }

    const numeralSize = dialRadius * 0.075;
    ctx.font = `500 ${numeralSize}px "Oxanium", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = goalsAtHour.length
      ? `rgba(216, 190, 118, ${0.48 + pulse * 0.08})`
      : 'rgba(164, 152, 118, 0.16)';
    ctx.fillText(String(hour), numeralX, numeralY);
  }

  ctx.beginPath();
  ctx.arc(cx, cy, dialRadius * 0.13, 0, TAU);
  ctx.strokeStyle = 'rgba(210, 170, 88, 0.16)';
  ctx.lineWidth = caseRadius * 0.01;
  ctx.stroke();

  return dialRadius;
}

function drawHand(cx, cy, angle, length, width, strokeColor, glowColor, tail = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.lineCap = 'round';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = width * 4.5;

  ctx.beginPath();
  ctx.moveTo(-tail, 0);
  ctx.lineTo(length, 0);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = width;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(length * 0.78, 0);
  ctx.lineTo(length, 0);
  ctx.strokeStyle = 'rgba(255, 238, 196, 0.9)';
  ctx.lineWidth = Math.max(1, width * 0.46);
  ctx.stroke();
  ctx.restore();
}

function drawHands(cx, cy, dialRadius, brtNow) {
  const seconds = brtNow.second + brtNow.millisecond / 1000;
  const minutes = brtNow.minute + seconds / 60;
  const hours = (brtNow.hour % 12) + minutes / 60;

  drawHand(
    cx,
    cy,
    hours * (TAU / 12) - Math.PI / 2,
    dialRadius * 0.48,
    dialRadius * 0.04,
    'rgba(236, 238, 244, 0.96)',
    'rgba(255, 226, 164, 0.14)',
    dialRadius * 0.1
  );

  drawHand(
    cx,
    cy,
    minutes * (TAU / 60) - Math.PI / 2,
    dialRadius * 0.7,
    dialRadius * 0.026,
    'rgba(242, 244, 248, 0.98)',
    'rgba(255, 236, 190, 0.12)',
    dialRadius * 0.18
  );

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(seconds * (TAU / 60) - Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(-dialRadius * 0.1, 0);
  ctx.lineTo(dialRadius * 0.8, 0);
  ctx.strokeStyle = 'rgba(214, 170, 84, 0.92)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-dialRadius * 0.12, 0, dialRadius * 0.032, 0, TAU);
  ctx.fillStyle = 'rgba(230, 188, 98, 0.94)';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, dialRadius * 0.048, 0, TAU);
  ctx.fillStyle = 'rgba(244, 246, 250, 0.96)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, dialRadius * 0.022, 0, TAU);
  ctx.fillStyle = 'rgba(214, 170, 84, 0.96)';
  ctx.fill();
}

function drawCrystalReflections(cx, cy, dialRadius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, dialRadius * 1.02, 0, TAU);
  ctx.clip();

  ctx.beginPath();
  ctx.ellipse(cx, cy - dialRadius * 0.72, dialRadius * 0.42, dialRadius * 0.08, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx + dialRadius * 0.16, cy - dialRadius * 0.36, dialRadius * 0.12, dialRadius * 0.34, -0.4, 0, TAU);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();
  ctx.restore();
}

function drawWatch(cx, cy, brtNow, timeValue) {
  const caseRadius = Math.min(SCENE.width, SCENE.height) * (SCENE.width < 760 ? 0.17 : 0.146);

  drawWatchCase(cx, cy, caseRadius, timeValue);
  const dialRadius = drawWatchDial(cx, cy, caseRadius, brtNow, timeValue);
  drawHands(cx, cy, dialRadius, brtNow);
  drawCrystalReflections(cx, cy, dialRadius);

  return caseRadius;
}

// [interaction]
function getCanvasPointerPosition(clientX, clientY) {
  const rect = DOM.canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function setWatchInteractionPose(cx, cy, radius) {
  WATCH_INTERACTION.cx = cx;
  WATCH_INTERACTION.cy = cy;
  WATCH_INTERACTION.radius = radius;
}

function getWatchFromPointer(clientX, clientY) {
  if (!WATCH_INTERACTION.radius) {
    return null;
  }

  const point = getCanvasPointerPosition(clientX, clientY);
  const dx = point.x - WATCH_INTERACTION.cx;
  const dy = point.y - WATCH_INTERACTION.cy;
  const radius = WATCH_INTERACTION.radius * 1.08;

  if ((dx * dx) + (dy * dy) > radius * radius) {
    return null;
  }

  return {
    x: point.x,
    y: point.y,
    dx,
    dy,
    distance: Math.hypot(dx, dy)
  };
}

function getPlanetFromPointer(clientX, clientY) {
  const point = getCanvasPointerPosition(clientX, clientY);

  for (let index = planetHitZones.length - 1; index >= 0; index -= 1) {
    const zone = planetHitZones[index];
    const dx = point.x - zone.x;
    const dy = point.y - zone.y;

    if ((dx * dx) + (dy * dy) <= zone.radius * zone.radius) {
      return BACKGROUND_PLANETS.find((planet) => planet.id === zone.id) || null;
    }
  }

  return null;
}

function getGalaxyFromPointer(clientX, clientY) {
  const point = getCanvasPointerPosition(clientX, clientY);

  for (let index = galaxyHitZones.length - 1; index >= 0; index -= 1) {
    const zone = galaxyHitZones[index];
    const dx = point.x - zone.x;
    const dy = point.y - zone.y;

    if ((dx * dx) + (dy * dy) <= zone.radius * zone.radius) {
      return DISTANT_GALAXIES.find((galaxy) => galaxy.id === zone.id) || null;
    }
  }

  return null;
}

function getMarkerFromPointer(clientX, clientY) {
  const point = getCanvasPointerPosition(clientX, clientY);
  const x = point.x;
  const y = point.y;

  for (const marker of interactiveMarkers) {
    const deltaX = x - marker.x;
    const deltaY = y - marker.y;

    if ((deltaX * deltaX) + (deltaY * deltaY) <= marker.radius * marker.radius) {
      return marker;
    }
  }

  return null;
}

function beginPlanetInteraction(event) {
  const planet = getPlanetFromPointer(event.clientX, event.clientY);

  if (!planet) {
    return false;
  }

  const point = getCanvasPointerPosition(event.clientX, event.clientY);
  createCelestialBurst(point.x, point.y, 'planet');
  SPACE_INTERACTION.orbitTrails.push({
    x: point.x,
    y: point.y,
    life: 1,
    radius: 22,
    tilt: randomBetween(-0.6, 0.6),
    warm: false
  });
  pulseAmbientAudio(0.45);
  PLANET_INTERACTION.activeId = planet.id;
  PLANET_INTERACTION.lastX = event.clientX;
  PLANET_INTERACTION.lastY = event.clientY;
  return true;
}

function updatePlanetInteraction(event) {
  if (!PLANET_INTERACTION.activeId) {
    return;
  }

  const planet = BACKGROUND_PLANETS.find((item) => item.id === PLANET_INTERACTION.activeId);

  if (!planet) {
    return;
  }

  const deltaX = event.clientX - PLANET_INTERACTION.lastX;
  const deltaY = event.clientY - PLANET_INTERACTION.lastY;

  planet.userRotation += deltaX * 0.012;
  planet.userTilt = clamp(planet.userTilt + deltaY * 0.003, -0.45, 0.45);
  PLANET_INTERACTION.lastX = event.clientX;
  PLANET_INTERACTION.lastY = event.clientY;
}

function endPlanetInteraction() {
  PLANET_INTERACTION.activeId = null;
}

function cycleMarkerGoals(goals) {
  if (!goals.length) {
    return;
  }

  if (!activeGoal || !goals.some((goal) => goal.id === activeGoal.id)) {
    openGoalCard(goals[0]);
    return;
  }

  const currentIndex = goals.findIndex((goal) => goal.id === activeGoal.id);
  openGoalCard(goals[(currentIndex + 1) % goals.length]);
}

function handleCanvasPointer(event) {
  startAmbientAudio();

  if (beginPlanetInteraction(event)) {
    return;
  }

  const watchPoint = getWatchFromPointer(event.clientX, event.clientY);
  const galaxy = getGalaxyFromPointer(event.clientX, event.clientY);
  const marker = getMarkerFromPointer(event.clientX, event.clientY);

  if (galaxy) {
    const point = getCanvasPointerPosition(event.clientX, event.clientY);
    galaxy.rotation += 0.28;
    createCelestialBurst(point.x, point.y, 'galaxy');
    SPACE_INTERACTION.orbitTrails.push({
      x: point.x,
      y: point.y,
      life: 1,
      radius: 34,
      tilt: randomBetween(-0.8, 0.8),
      warm: true
    });
    pulseAmbientAudio(0.65);
    return;
  }

  const point = getCanvasPointerPosition(event.clientX, event.clientY);
  createSpaceRipple(point.x, point.y, 0.7);

  if (marker) {
    if (watchPoint) {
      createWatchMagicBurst(watchPoint);
    }

    cycleMarkerGoals(marker.goals);
    return;
  }

  if (watchPoint) {
    createWatchMagicBurst(watchPoint);
  }
}

// [frame]
function frame() {
  const brtNow = getBrasiliaParts();
  const verticalOffset = Math.min(SCENE.width, SCENE.height) * 0.045;
  const intro = easeOutCubic(SCENE.intro);
  const objectCenterY = SCENE.centerY + verticalOffset + ((1 - intro) * Math.min(SCENE.height * 0.04, 34));

  renderHudClock(brtNow);
  drawBackground();

  const watchRadius = Math.min(SCENE.width, SCENE.height) * (SCENE.width < 760 ? 0.184 : 0.16);
  setWatchInteractionPose(SCENE.centerX, objectCenterY, watchRadius);
  ctx.save();
  ctx.globalAlpha = lerp(0.2, 1, intro);
  drawChronoHalo(SCENE.centerX, objectCenterY, watchRadius, SCENE.time);
  drawSpacetimeLattice(SCENE.centerX, objectCenterY, watchRadius, SCENE.time);
  drawBlackHole(SCENE.centerX, objectCenterY, watchRadius, SCENE.time);
  drawGravityDust(SCENE.centerX, objectCenterY, watchRadius, SCENE.time);
  drawWatch(SCENE.centerX, objectCenterY, brtNow, SCENE.time);
  drawWatchMagic(SCENE.centerX, objectCenterY, watchRadius, SCENE.time);
  drawFrontDiskAccent(SCENE.centerX, objectCenterY, watchRadius, SCENE.time);
  drawForegroundHorizonEllipse(SCENE.centerX, objectCenterY, watchRadius, SCENE.time);
  ctx.restore();

  SCENE.warp = lerp(SCENE.warp, SCENE.warpTarget, 0.08);
  SCENE.warpTarget *= 0.94;
  SCENE.scrollGravity = lerp(SCENE.scrollGravity, 0, 0.035);
  SCENE.audioEnergy = lerp(SCENE.audioEnergy, ambientAudio ? ambientAudio.master.gain.value * 14 : 0, 0.08);
  if (ambientAudio) {
    const centerDistance = Math.hypot(POINTER.easedX - SCENE.centerX, POINTER.easedY - SCENE.centerY);
    const centerPull = clamp(1 - centerDistance / (Math.min(SCENE.width, SCENE.height) * 0.38), 0, 1);
    const now = ambientAudio.audioContext.currentTime;
    ambientAudio.master.gain.setTargetAtTime(0.026 + centerPull * 0.036 + SCENE.warp * 0.012, now, 0.35);
    ambientAudio.hum.frequency.setTargetAtTime(68 + centerPull * 16 + SCENE.warp * 8, now, 0.45);
  }
  POINTER.velocity = lerp(POINTER.velocity, 0, 0.05);
  SCENE.time += PREFERS_REDUCED_MOTION ? 0.004 : 0.012 + SCENE.warp * 0.016;
  SCENE.intro = clamp(SCENE.intro + (PREFERS_REDUCED_MOTION ? 1 : 0.018), 0, 1);
  requestAnimationFrame(frame);
}

// [boot]
DOM.backButton.addEventListener('click', closeGoalCard);
DOM.morseButton.addEventListener('click', toggleGoalMessageMode);
DOM.audioToggle.addEventListener('click', toggleSoundtrack);
DOM.canvas.addEventListener('pointerdown', handleCanvasPointer);
document.addEventListener('pointermove', updatePlanetInteraction);
document.addEventListener('pointerup', endPlanetInteraction);
document.addEventListener('pointercancel', endPlanetInteraction);
document.addEventListener('pointerdown', maybeAutostartSoundtrack);
document.addEventListener('keydown', maybeAutostartSoundtrack);
document.addEventListener('wheel', (event) => {
  const impulse = clamp(Math.abs(event.deltaY) / 900, 0.08, 0.9);
  SCENE.warpTarget = clamp(SCENE.warpTarget + impulse, 0, 1.3);
  SCENE.scrollGravity += event.deltaY * 0.18;
  pulseAmbientAudio(impulse);
}, { passive: true });

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeGoalCard();
  }
});

if (DOM.soundtrack) {
  DOM.soundtrack.addEventListener('loadedmetadata', onSoundtrackReady);
  DOM.soundtrack.addEventListener('canplay', onSoundtrackReady);
  DOM.soundtrack.addEventListener('timeupdate', onSoundtrackTimeUpdate);
  DOM.soundtrack.addEventListener('ended', () => {
    seekSoundtrackToLoopStart(true);
    DOM.soundtrack.play().catch(() => {});
  });
  DOM.soundtrack.addEventListener('error', onSoundtrackError);

  if (DOM.soundtrack.readyState >= 1) {
    onSoundtrackReady();
  }
}

setupCursor();
updateAudioButton();
frame();
