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

// [time]
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
    ? '[ ver em texto ]'
    : '[ ver em morse ]';
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

  if (goalTimer) {
    clearInterval(goalTimer);
  }

  renderGoalMessage();
  renderGoalDetails();
  renderGoalCountdown();
  goalTimer = window.setInterval(renderGoalCountdown, 1000);
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
  customCursorEnabled: window.matchMedia('(pointer: fine)').matches
};

function setupCursor() {
  if (!POINTER.customCursorEnabled) {
    return;
  }

  DOM.html.classList.add('has-custom-cursor');

  document.addEventListener('pointermove', (event) => {
    POINTER.x = event.clientX;
    POINTER.y = event.clientY;
    DOM.cursor.style.transform = `translate(${POINTER.x - 2.5}px, ${POINTER.y - 2.5}px)`;
  });

  (function animateCursor() {
    POINTER.easedX = lerp(POINTER.easedX, POINTER.x, 0.12);
    POINTER.easedY = lerp(POINTER.easedY, POINTER.y, 0.12);
    POINTER.parallaxX = (POINTER.easedX / window.innerWidth) - 0.5;
    POINTER.parallaxY = (POINTER.easedY / window.innerHeight) - 0.5;
    DOM.cursorRing.style.transform = `translate(${POINTER.easedX - 14}px, ${POINTER.easedY - 14}px)`;
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
  time: 0
};

const interactiveMarkers = [];

function resizeScene() {
  SCENE.width = DOM.canvas.width = window.innerWidth;
  SCENE.height = DOM.canvas.height = window.innerHeight;
  SCENE.centerX = SCENE.width / 2;
  SCENE.centerY = SCENE.height / 2;
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
    DOM.audioToggle.textContent = '[ trilha indisponivel ]';
    DOM.audioToggle.disabled = true;
    return;
  }

  DOM.audioToggle.disabled = false;

  if (!soundtrackReady) {
    DOM.audioToggle.textContent = '[ carregando trilha ]';
    return;
  }

  DOM.audioToggle.textContent = DOM.soundtrack.paused
    ? '[ tocar trilha ]'
    : '[ pausar trilha ]';
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

  return {
    x: x + (nx * radialPush) - (ny * swirl),
    y: y + (ny * radialPush) + (nx * swirl * 0.8)
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
    sparkle: Math.random() > 0.992
  }));
}

const STAR_LAYERS = [
  createStarLayer(760, 0.07, 0.18, 0.96, 0.08, 0.28),
  createStarLayer(360, 0.16, 0.28, 1.38, 0.12, 0.48),
  createStarLayer(180, 0.28, 0.54, 2.3, 0.18, 0.82)
];

const SPACE_DUST = Array.from({ length: 18 }, (_, index) => ({
  y: 0.08 + index * 0.045 + randomBetween(-0.01, 0.01),
  width: randomBetween(0.14, 0.28),
  opacity: randomBetween(0.018, 0.05),
  phase: Math.random() * TAU,
  speed: randomBetween(0.18, 0.42)
}));

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

const planetHitZones = [];
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
  drawNebulaBlob(0.16, 0.56, 0.5, ['rgba(214, 86, 116, 0.24)', 'rgba(78, 20, 46, 0.34)']);
  drawNebulaBlob(0.26, 0.34, 0.34, ['rgba(200, 84, 255, 0.14)', 'rgba(40, 16, 92, 0.22)']);
  drawNebulaVeil(0.19, 0.45, 0.24, 0.16, -0.82, ['rgba(255, 164, 176, 0.12)', 'rgba(112, 24, 54, 0.18)']);
  drawNebulaVeil(0.23, 0.5, 0.18, 0.1, -0.3, ['rgba(255, 112, 138, 0.14)', 'rgba(96, 20, 54, 0.18)']);

  drawNebulaBlob(0.77, 0.34, 0.44, ['rgba(96, 146, 224, 0.18)', 'rgba(18, 42, 88, 0.26)']);
  drawNebulaBlob(0.83, 0.31, 0.24, ['rgba(226, 238, 255, 0.2)', 'rgba(94, 136, 220, 0.14)']);
  drawNebulaVeil(0.82, 0.3, 0.12, 0.16, 0.54, ['rgba(226, 242, 255, 0.18)', 'rgba(54, 96, 182, 0.12)']);
  drawNebulaVeil(0.8, 0.35, 0.1, 0.12, -0.42, ['rgba(180, 216, 255, 0.12)', 'rgba(32, 70, 142, 0.1)']);

  const darkCloud = ctx.createRadialGradient(SCENE.width * 0.79, SCENE.height * 0.31, 0, SCENE.width * 0.79, SCENE.height * 0.31, Math.min(SCENE.width, SCENE.height) * 0.16);
  darkCloud.addColorStop(0, 'rgba(12, 18, 28, 0.46)');
  darkCloud.addColorStop(0.45, 'rgba(8, 10, 18, 0.22)');
  darkCloud.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = darkCloud;
  ctx.fillRect(0, 0, SCENE.width, SCENE.height);

  const brightRight = ctx.createRadialGradient(SCENE.width * 0.82, SCENE.height * 0.31, 0, SCENE.width * 0.82, SCENE.height * 0.31, Math.min(SCENE.width, SCENE.height) * 0.12);
  brightRight.addColorStop(0, 'rgba(236, 248, 255, 0.34)');
  brightRight.addColorStop(0.28, 'rgba(156, 202, 255, 0.18)');
  brightRight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = brightRight;
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

function drawStars() {
  STAR_LAYERS.forEach((layer) => {
    layer.forEach((star) => {
      const parallaxX = POINTER.parallaxX * star.depth * 44;
      const parallaxY = POINTER.parallaxY * star.depth * 44;
      const x = star.x * SCENE.width + parallaxX;
      const y = star.y * SCENE.height + parallaxY;
      const twinkle = 0.68 + 0.32 * Math.sin(star.phase + SCENE.time * star.speed);
      const lensed = lensPoint(x, y, 0.26 + star.depth * 0.76);
      const opacity = clamp(star.opacity * twinkle, 0, 1);

      ctx.beginPath();
      ctx.arc(lensed.x, lensed.y, star.radius, 0, TAU);
      ctx.fillStyle = star.warm
        ? `rgba(255, 232, 190, ${opacity})`
        : `rgba(236, 242, 255, ${opacity})`;
      ctx.fill();

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
  const radius = minDimension * planet.radius;
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
      radius
    });
  }

  drawSoftGlow(point.x, point.y, radius * 2.4, [
    [0, planet.glow || 'rgba(255,255,255,0.06)'],
    [1, 'rgba(0,0,0,0)']
  ]);

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
      const twinkle = 0.68 + 0.32 * Math.sin(star.phase + SCENE.time * star.speed);
      const lensed = lensPoint(x, y, 0.26 + star.depth * 0.76);
      const opacity = clamp(star.opacity * twinkle, 0, 1);

      ctx.beginPath();
      ctx.arc(lensed.x, lensed.y, star.radius, 0, TAU);
      ctx.fillStyle = star.warm
        ? `rgba(255, 232, 190, ${opacity})`
        : `rgba(236, 242, 255, ${opacity})`;
      ctx.fill();

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

function drawBackground() {
  const base = ctx.createLinearGradient(0, 0, 0, SCENE.height);
  base.addColorStop(0, '#02030a');
  base.addColorStop(0.44, '#070816');
  base.addColorStop(1, '#020209');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SCENE.width, SCENE.height);

  planetHitZones.length = 0;
  drawReferenceNebulae();
  drawDustBands();
  drawStars();
  drawDeepFieldHighlights();
  BACKGROUND_PLANETS.forEach(drawInteractivePlanet);
  drawAsteroids();

  const centerGlow = ctx.createRadialGradient(
    SCENE.centerX,
    SCENE.centerY,
    0,
    SCENE.centerX,
    SCENE.centerY,
    Math.min(SCENE.width, SCENE.height) * 0.55
  );
  centerGlow.addColorStop(0, 'rgba(255, 108, 24, 0.024)');
  centerGlow.addColorStop(0.38, 'rgba(255, 78, 14, 0.04)');
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
}

// [black-hole]
function drawAccretionUpperShell(cx, cy, horizonRadius, timeValue) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'screen';

  const capGlow = ctx.createRadialGradient(0, -horizonRadius * 0.28, horizonRadius * 0.42, 0, -horizonRadius * 0.18, horizonRadius * 4.5);
  capGlow.addColorStop(0, 'rgba(255, 226, 194, 0.16)');
  capGlow.addColorStop(0.32, 'rgba(255, 150, 62, 0.12)');
  capGlow.addColorStop(1, 'rgba(255, 72, 18, 0)');
  ctx.beginPath();
  ctx.ellipse(0, -horizonRadius * 0.04, horizonRadius * 4.4, horizonRadius * 2.55, 0, 0, Math.PI);
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
    ctx.ellipse(0, offsetY, rx, ry, 0, 0, Math.PI);
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
    ctx.ellipse(0, offsetY, rx, ry, 0, 0, Math.PI);
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
    ctx.ellipse(0, offsetY, rx, ry, 0, Math.PI, TAU);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = horizonRadius * lerp(0.024, 0.007, ratio);
    ctx.stroke();
  }

  ctx.save();
  ctx.filter = 'blur(6px)';
  ctx.beginPath();
  ctx.ellipse(0, horizonRadius * 0.9, horizonRadius * 1.42, horizonRadius * 0.88, 0, Math.PI, TAU);
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
  ctx.ellipse(0, 0, horizonRadius * 5.55, horizonRadius * 0.24, 0, 0, TAU);
  ctx.clip();

  for (let line = 0; line < 56; line += 1) {
    const progressY = line / 55;
    const bandY = lerp(-horizonRadius * 0.17, horizonRadius * 0.17, progressY);
    const centerBias = 1 - Math.abs((progressY - 0.5) * 2);
    const pathAlpha = 0.02 + centerBias * 0.085;
    const width = horizonRadius * 5.7;
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
        + Math.sin((progress * 8.6) + (timeValue * 1.12) + line * 0.21) * horizonRadius * 0.012
        + Math.cos((progress * 19.4) + line * 0.12) * horizonRadius * 0.0038;

      if (step === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 0.6 + centerBias * 0.9;
    ctx.stroke();
  }

  ctx.restore();

  for (let filament = 0; filament < 8; filament += 1) {
    const width = horizonRadius * lerp(4.9, 5.5, filament / 7);
    const y = Math.sin(timeValue * 0.54 + filament * 0.7) * horizonRadius * 0.01;
    const gradient = ctx.createLinearGradient(-width, y, width, y);
    gradient.addColorStop(0, 'rgba(255, 100, 24, 0)');
    gradient.addColorStop(0.16, 'rgba(255, 176, 98, 0.14)');
    gradient.addColorStop(0.5, 'rgba(255, 248, 236, 0.22)');
    gradient.addColorStop(0.84, 'rgba(255, 176, 98, 0.14)');
    gradient.addColorStop(1, 'rgba(255, 100, 24, 0)');

    ctx.beginPath();
    ctx.moveTo(-width, y);
    ctx.lineTo(width, y);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = horizonRadius * 0.012;
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
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'screen';

  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.beginPath();
  ctx.ellipse(0, horizonRadius * 0.06, horizonRadius * 4.2, horizonRadius * 2.32, 0, 0, Math.PI);
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
    ctx.ellipse(0, offsetY, rx, ry, 0, 0, Math.PI);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = horizonRadius * lerp(0.05, 0.01, ratio);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBlackHole(cx, cy, watchRadius, timeValue) {
  const horizonRadius = watchRadius * 1.6;

  drawSoftGlow(cx, cy, horizonRadius * 4.2, [
    [0, 'rgba(255, 118, 32, 0.035)'],
    [0.3, 'rgba(255, 78, 18, 0.06)'],
    [1, 'rgba(0, 0, 0, 0)']
  ]);
  drawAccretionUpperShell(cx, cy, horizonRadius, timeValue);
  drawAccretionLowerShell(cx, cy, horizonRadius, timeValue);
  drawAccretionDiskBand(cx, cy, horizonRadius, timeValue);
  drawEventHorizon(cx, cy, horizonRadius, timeValue);
  drawUpperShellOverlay(cx, cy, horizonRadius, timeValue);
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

  const accentX = caseRadius * 1.52;
  const accentY = -caseRadius * 1.18;
  const pulse = 0.72 + 0.28 * Math.sin(timeValue * 1.4);
  ctx.beginPath();
  ctx.arc(accentX, accentY, caseRadius * 0.18, 0, TAU);
  ctx.strokeStyle = `rgba(215, 175, 92, ${0.22 + pulse * 0.1})`;
  ctx.lineWidth = caseRadius * 0.02;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(accentX + caseRadius * 0.11, accentY - caseRadius * 0.13, caseRadius * 0.045, 0, TAU);
  ctx.fillStyle = `rgba(255, 208, 112, ${0.78 + pulse * 0.12})`;
  ctx.fill();

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
  if (beginPlanetInteraction(event)) {
    return;
  }

  const marker = getMarkerFromPointer(event.clientX, event.clientY);

  if (marker) {
    cycleMarkerGoals(marker.goals);
  }
}

// [frame]
function frame() {
  const brtNow = getBrasiliaParts();

  renderHudClock(brtNow);
  drawBackground();

  const watchRadius = Math.min(SCENE.width, SCENE.height) * (SCENE.width < 760 ? 0.184 : 0.16);
  drawBlackHole(SCENE.centerX, SCENE.centerY, watchRadius, SCENE.time);
  drawWatch(SCENE.centerX, SCENE.centerY, brtNow, SCENE.time);
  drawFrontDiskAccent(SCENE.centerX, SCENE.centerY, watchRadius, SCENE.time);
  drawForegroundHorizonEllipse(SCENE.centerX, SCENE.centerY, watchRadius, SCENE.time);

  SCENE.time += 0.012;
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