const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score-value');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const startBtn = document.getElementById('start-btn');
const lbList = document.getElementById('lb-list');
const clearLbBtn = document.getElementById('clear-lb-btn');

// ── Game Constants ──
const GRID_SIZE = 22;
let TILE_COUNT = 0;
let SPEED = 100; // ms per move

// ── Game State ──
let snake = [];
let food = { x: 5, y: 5 };
let dx = 0, dy = 0;
let nextDx = 1, nextDy = 0;
let score = 0;
let gameRunning = false;
let gameLoopTimeout;

// ── Leaderboard (localStorage) ──
const LB_KEY = 'snakeLeaderboard_vishanth';
const MAX_LB  = 10;

function getLeaderboard() {
    try {
        return JSON.parse(localStorage.getItem(LB_KEY)) || [];
    } catch { return []; }
}

function saveLeaderboard(lb) {
    localStorage.setItem(LB_KEY, JSON.stringify(lb));
}

function addToLeaderboard(newScore) {
    const lb = getLeaderboard();
    const date = new Date();
    const dateStr = `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')}`;
    lb.push({ score: newScore, date: dateStr });
    lb.sort((a, b) => b.score - a.score);
    lb.splice(MAX_LB); // keep top 10
    saveLeaderboard(lb);
    return lb;
}

function isNewBest(newScore) {
    const lb = getLeaderboard();
    if (lb.length === 0) return true;
    return newScore >= lb[0].score;
}

function renderLeaderboard(highlightScore = null) {
    const lb = getLeaderboard();
    lbList.innerHTML = '';

    if (lb.length === 0) {
        lbList.innerHTML = `<li class="lb-empty">No scores yet.<br>Play your first game<br>to get on the board! 🐍</li>`;
        return;
    }

    lb.forEach((entry, i) => {
        const li = document.createElement('li');
        li.className = 'lb-entry';
        li.style.animationDelay = `${i * 40}ms`;

        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'other';
        const rankLabel = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        const medal = i < 3 ? rankLabel : '';
        const rankNum = i < 3 ? '' : `#${i + 1}`;

        const isHighlight = highlightScore !== null && entry.score === highlightScore && i === lb.findIndex(e => e.score === highlightScore);

        li.innerHTML = `
            <div class="lb-rank ${rankClass}">${rankNum || rankLabel}</div>
            <div class="lb-info">
                <div class="lb-name">${entry.date}</div>
                <div class="lb-score" style="${isHighlight ? 'color:#ffd700;text-shadow:0 0 12px rgba(255,215,0,0.8)' : ''}">${entry.score.toString().padStart(3, '0')}</div>
            </div>
            ${medal && i >= 0 ? `<div class="lb-medal" style="display:none"></div>` : ''}
        `;

        lbList.appendChild(li);
    });
}

// ── Audio ──
let audioCtx;

function playEatSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}

function playGameOverSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
}

// ── Init ──
function initGame() {
    // Fit canvas to its CSS rendered size
    const rect = canvas.getBoundingClientRect();
    const size = Math.round(rect.width);
    canvas.width  = size || 700;
    canvas.height = size || 700;
    TILE_COUNT = Math.floor(canvas.width / GRID_SIZE);

    snake = [
        { x: Math.floor(TILE_COUNT / 2),     y: Math.floor(TILE_COUNT / 2) },
        { x: Math.floor(TILE_COUNT / 2) - 1, y: Math.floor(TILE_COUNT / 2) },
        { x: Math.floor(TILE_COUNT / 2) - 2, y: Math.floor(TILE_COUNT / 2) }
    ];

    score = 0;
    updateScore();

    nextDx = 1; nextDy = 0;
    dx = 1;     dy = 0;

    spawnFood();
}

function spawnFood() {
    food.x = Math.floor(Math.random() * TILE_COUNT);
    food.y = Math.floor(Math.random() * TILE_COUNT);
    for (let part of snake) {
        if (part.x === food.x && part.y === food.y) {
            spawnFood();
            return;
        }
    }
}

function updateScore() {
    scoreElement.textContent = score.toString().padStart(3, '0');
}

// ── Game Loop ──
function gameLoop() {
    if (!gameRunning) return;

    dx = nextDx;
    dy = nextDy;

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (head.x < 0 || head.x >= TILE_COUNT ||
        head.y < 0 || head.y >= TILE_COUNT ||
        snake.some(p => p.x === head.x && p.y === head.y)) {
        gameOver();
        return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score += 10;
        updateScore();
        playEatSound();
        spawnFood();
        if (SPEED > 50) SPEED -= 1;
    } else {
        snake.pop();
    }

    draw();
    gameLoopTimeout = setTimeout(gameLoop, SPEED);
}

// ── Draw ──
function draw() {
    // Background
    ctx.fillStyle = '#090910';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= TILE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(canvas.width, i * GRID_SIZE);
        ctx.stroke();
    }

    // Food — pulsing glow
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    ctx.shadowBlur = 16 + pulse * 12;
    ctx.shadowColor = '#ff007b';
    ctx.fillStyle = '#ff007b';
    ctx.beginPath();
    ctx.arc(
        food.x * GRID_SIZE + GRID_SIZE / 2,
        food.y * GRID_SIZE + GRID_SIZE / 2,
        GRID_SIZE / 2 - 2, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake
    snake.forEach((part, index) => {
        const isHead = index === 0;
        const t = index / snake.length;

        // Gradient from head to tail: cyan → blue → dark blue
        const r = Math.round(0   + t * 0);
        const g = Math.round(242 * (1 - t) + 80 * t);
        const b = Math.round(255 * (1 - t) + 200 * t);
        ctx.fillStyle = isHead ? '#00f2ff' : `rgb(${r},${g},${b})`;

        if (isHead) {
            ctx.shadowBlur = 14;
            ctx.shadowColor = '#00f2ff';
        } else {
            ctx.shadowBlur = 0;
        }

        const pad = 2;
        const radius = 4;
        const x = part.x * GRID_SIZE + pad;
        const y = part.y * GRID_SIZE + pad;
        const w = GRID_SIZE - pad * 2;
        const h = GRID_SIZE - pad * 2;

        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

// ── Game Over ──
function gameOver() {
    gameRunning = false;
    clearTimeout(gameLoopTimeout);
    playGameOverSound();

    const wasBest = isNewBest(score);
    addToLeaderboard(score);
    renderLeaderboard(score);

    overlayTitle.textContent = 'GAME OVER';
    let msg = `Final Score: ${score}`;
    if (wasBest && score > 0) msg += ' 🏆 New Best!';
    overlayMsg.textContent = msg;
    startBtn.textContent = 'TRY AGAIN';
    overlay.classList.add('active');
}

// ── Start Game ──
function startGame() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    overlay.classList.remove('active');
    initGame();
    gameRunning = true;
    SPEED = 100;
    gameLoop();
}

// ── Clear Leaderboard ──
clearLbBtn.addEventListener('click', () => {
    if (confirm('Clear all scores from the leaderboard?')) {
        localStorage.removeItem(LB_KEY);
        renderLeaderboard();
    }
});

// ── Keyboard Controls ──
window.addEventListener('keydown', e => {
    switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W':
            if (dy !== 1)  { nextDx = 0;  nextDy = -1; } break;
        case 'ArrowDown':  case 's': case 'S':
            if (dy !== -1) { nextDx = 0;  nextDy =  1; } break;
        case 'ArrowLeft':  case 'a': case 'A':
            if (dx !== 1)  { nextDx = -1; nextDy =  0; } break;
        case 'ArrowRight': case 'd': case 'D':
            if (dx !== -1) { nextDx =  1; nextDy =  0; } break;
    }
});

// ── Mouse / Touch Controls ──
canvas.addEventListener('mousedown', handlePointer);
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    handlePointer(e.touches[0]);
}, { passive: false });

function handlePointer(e) {
    if (!gameRunning) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const y = (e.clientY - rect.top)  * (canvas.height / rect.height);
    const headX = snake[0].x * GRID_SIZE + GRID_SIZE / 2;
    const headY = snake[0].y * GRID_SIZE + GRID_SIZE / 2;
    const diffX = x - headX;
    const diffY = y - headY;
    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0 && dx !== -1) { nextDx =  1; nextDy = 0; }
        else if (diffX < 0 && dx !== 1) { nextDx = -1; nextDy = 0; }
    } else {
        if (diffY > 0 && dy !== -1) { nextDx = 0; nextDy =  1; }
        else if (diffY < 0 && dy !== 1) { nextDx = 0; nextDy = -1; }
    }
}

startBtn.addEventListener('click', startGame);

// ── Boot ──
initGame();
draw();
renderLeaderboard();
