'use strict';

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

// --- CONFIGURAÇÕES E CONSTANTES ---
const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const TAU = Math.PI * 2;
let activeGoal = null;
let goalTimer = null;
let goalMessageMode = 'text';

const pad = (v, l = 2) => String(Math.max(0, v)).padStart(l, '0');
const lerp = (s, e, a) => s + (e - s) * a;

// --- DADOS DAS METAS ---
const GOALS = [
    { id: 'fisico', n: '01/05', title: 'Campeonato de Fisiculturismo', sub: 'Mens Physique', year: 2025, month: 10, day: 30, hour: 12, desc: 'O palco exige simetria e condicionamento seco.' },
    { id: 'enem1', n: '02/05', title: 'ENEM - Dia 1', sub: 'Redação e Humanas', year: 2025, month: 10, day: 9, hour: 13, desc: 'Foco total na estrutura da redação.' },
    { id: 'enem2', n: '03/05', title: 'ENEM - Dia 2', sub: 'Exatas', year: 2025, month: 10, day: 16, hour: 13, desc: 'Gestão de tempo e precisão sob fadiga.' },
    { id: 'casamento', n: '04/05', title: 'Casamento', sub: 'Cerimônia', year: 2025, month: 11, day: 16, hour: 19, desc: 'Passagem formal para uma vida alinhada.' },
    { id: 'finlandia', n: '05/05', title: 'Viagem Finlândia', sub: 'Helsinki', year: 2027, month: 2, day: 1, hour: 16, desc: 'Expansão de vida e conquista de liberdade.' }
];

// --- LÓGICA DE TEMPO ---
function getBrasiliaParts() {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: BRASILIA_TIME_ZONE, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(now);
    const p = {};
    fmt.forEach(part => { if (part.type !== 'literal') p[part.type] = part.value; });
    return { ...p, ms: now.getMilliseconds(), weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: BRASILIA_TIME_ZONE }).format(now).toUpperCase() };
}

// --- CANVAS ENGINE ---
const ctx = DOM.canvas.getContext('2d');
let scene = { w: 0, h: 0, time: 0 };

function resize() {
    scene.w = DOM.canvas.width = window.innerWidth;
    scene.h = DOM.canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Desenho do Buraco Negro (Simp.)
function drawBlackHole(cx, cy, radius) {
    const time = scene.time;
    // Disco de acreção
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 2.5);
    grad.addColorStop(0, '#ffccaa');
    grad.addColorStop(0.2, '#ff6600');
    grad.addColorStop(1, 'transparent');
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.2);
    ctx.scale(1, 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 2.5, 0, TAU);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.restore();

    // Horizonte de eventos
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.fillStyle = '#000';
    ctx.fill();
}

// --- INTERATIVIDADE ---
function openGoal(goal) {
    activeGoal = goal;
    DOM.goalNumber.textContent = goal.n;
    DOM.goalTitle.textContent = goal.title;
    DOM.goalDescription.textContent = goal.desc;
    DOM.goalCard.classList.add('open');
}

DOM.backButton.onclick = () => DOM.goalCard.classList.remove('open');

// --- LOOP DE ANIMAÇÃO ---
function frame() {
    ctx.clearRect(0, 0, scene.w, scene.h);
    
    const p = getBrasiliaParts();
    DOM.headerTime.textContent = `${p.hour}:${p.minute}:${p.second}.${pad(p.ms, 3)}`;
    DOM.headerDate.textContent = `${p.weekday} | ${p.day} ${MONTHS[parseInt(p.month)-1]} ${p.year}`;

    const cx = scene.w / 2;
    const cy = scene.h / 2;
    const r = Math.min(scene.w, scene.h) * 0.15;

    drawBlackHole(cx, cy, r);
    
    // Desenho simplificado do relógio no centro
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.9, 0, TAU);
    ctx.stroke();

    scene.time += 0.01;
    requestAnimationFrame(frame);
}

// Cursor
document.addEventListener('mousemove', e => {
    DOM.cursor.style.left = e.clientX + 'px';
    DOM.cursor.style.top = e.clientY + 'px';
    DOM.cursorRing.style.left = e.clientX + 'px';
    DOM.cursorRing.style.top = e.clientY + 'px';
});

// Clique no Canvas para abrir metas (exemplo na primeira meta)
DOM.canvas.onclick = () => openGoal(GOALS[0]);

frame();