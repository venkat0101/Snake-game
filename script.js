const canvas      = document.getElementById('gameCanvas');
const ctx          = canvas.getContext('2d');
const scoreElement = document.getElementById('score-value');

// Name modal elements
const nameModal       = document.getElementById('name-modal');
const playerNameInput = document.getElementById('player-name-input');
const existingWrap    = document.getElementById('existing-players-wrap');
const existingList    = document.getElementById('existing-players');
const startBtn        = document.getElementById('start-btn');

// Game-over overlay elements
const overlay       = document.getElementById('overlay');
const gameoverTitle = document.getElementById('gameover-title');
const gameoverMsg   = document.getElementById('gameover-msg');
const tryAgainBtn   = document.getElementById('try-again-btn');

// Header player badge
const playerBadge      = document.getElementById('player-badge');
const currentPlayerSpan = document.getElementById('current-player-name');

// Leaderboard elements
const lbList    = document.getElementById('lb-list');
const clearLbBtn = document.getElementById('clear-lb-btn');

// ── Device Detection ──
const isMobile = () => window.innerWidth <= 768 || ('ontouchstart' in window);

// ── Game Constants ──
const GRID_SIZE = 20;     // tile size in canvas pixels
let TILE_COUNT  = 0;
let SPEED       = 100;    // ms per move (overridden at game start)

// ── Speed settings per device ──
const SPEED_PC_START    = 100;   // ms — PC starting speed
const SPEED_MOBILE_START = 160;  // ms — mobile starting speed (slower = easier to control)
const SPEED_MIN_PC      = 50;    // fastest on PC
const SPEED_MIN_MOBILE  = 100;   // fastest on mobile
const SPEED_STEP_PC     = 1;     // ms decrease per food eaten on PC
const SPEED_STEP_MOBILE = 0;     // no speed increase on mobile (stays constant)

// ── Game State ──
let snake = [];
let food  = { x: 5, y: 5 };
let dx = 0, dy = 0;
let nextDx = 1, nextDy = 0;
let score       = 0;
let gameRunning = false;
let gameLoopTimeout;

// ── Current Player ──
let currentPlayer = '';

// ════════════════════════════════
// LEADERBOARD — localStorage
// ════════════════════════════════
const LB_KEY = 'snakeLeaderboard_v2';
const MAX_LB  = 10;

function getLeaderboard() {
    try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; }
    catch { return []; }
}

function saveLeaderboard(lb) {
    localStorage.setItem(LB_KEY, JSON.stringify(lb));
}

/** Returns sorted array of unique player names (most recent first) */
function getKnownPlayers() {
    const lb = getLeaderboard();
    const seen = new Set();
    const names = [];
    lb.forEach(e => {
        if (e.name && !seen.has(e.name)) {
            seen.add(e.name);
            names.push(e.name);
        }
    });
    return names;
}

function addToLeaderboard(playerName, newScore) {
    const lb = getLeaderboard();
    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}`;

    // ── One entry per player: keep personal best only ──
    const existingIdx = lb.findIndex(e => e.name.toLowerCase() === playerName.toLowerCase());
    if (existingIdx !== -1) {
        // Update only if the new score beats their existing best
        if (newScore > lb[existingIdx].score) {
            lb[existingIdx].score = newScore;
            lb[existingIdx].date  = dateStr;
        }
        // If equal or lower — keep the existing record untouched
    } else {
        // Brand-new player → add entry
        lb.push({ name: playerName, score: newScore, date: dateStr });
    }

    lb.sort((a, b) => b.score - a.score);
    lb.splice(MAX_LB);
    saveLeaderboard(lb);
    return lb;
}

function isNewBest(playerName, newScore) {
    const lb = getLeaderboard();
    // Check against this specific player's existing best
    const existing = lb.find(e => e.name.toLowerCase() === playerName.toLowerCase());
    if (!existing) return newScore > 0; // New player — any positive score is a best
    return newScore > existing.score;
}

function renderLeaderboard(highlightEntry = null) {
    const lb = getLeaderboard();
    lbList.innerHTML = '';

    if (lb.length === 0) {
        lbList.innerHTML = `<li class="lb-empty">No scores yet.<br>Enter your name<br>and play to get on<br>the board! 🐍</li>`;
        return;
    }

    lb.forEach((entry, i) => {
        const li = document.createElement('li');
        li.className = 'lb-entry';
        li.style.animationDelay = `${i * 40}ms`;

        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'other';
        const rankLabel = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;

        const isHighlight = highlightEntry &&
            entry.name === highlightEntry.name &&
            entry.score === highlightEntry.score &&
            i === lb.findIndex(e => e.name === highlightEntry.name && e.score === highlightEntry.score);

        li.innerHTML = `
            <div class="lb-rank ${rankClass}">${rankLabel}</div>
            <div class="lb-info">
                <div class="lb-name">${escapeHtml(entry.name || 'Anonymous')}</div>
                <div class="lb-date">${entry.date || ''}</div>
            </div>
            <div class="lb-score ${isHighlight ? 'highlight' : ''}">${entry.score.toString().padStart(3, '0')}</div>
        `;
        lbList.appendChild(li);
    });
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ════════════════════════════════
// NAME ENTRY MODAL
// ════════════════════════════════
function showNameModal(isRetry = false) {
    // Populate known players as chips
    const known = getKnownPlayers();
    if (known.length > 0) {
        existingWrap.style.display = 'block';
        existingList.innerHTML = '';
        known.forEach(name => {
            const chip = document.createElement('button');
            chip.className = 'player-chip';
            chip.textContent = name;
            chip.addEventListener('click', () => {
                playerNameInput.value = name;
                // Highlight selected chip
                document.querySelectorAll('.player-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
            });
            existingList.appendChild(chip);
        });
    } else {
        existingWrap.style.display = 'none';
    }

    if (isRetry && currentPlayer) {
        playerNameInput.value = currentPlayer;
    }

    // Update modal text for retry vs fresh start
    document.getElementById('overlay-title').textContent = isRetry ? 'PLAY AGAIN?' : 'SNAKE GAME';
    document.getElementById('overlay-msg').textContent   = isRetry ? `Good game, ${currentPlayer}!` : "Who's playing?";
    startBtn.textContent = isRetry ? 'PLAY AGAIN' : 'START GAME';

    nameModal.classList.add('active');
    setTimeout(() => playerNameInput.focus(), 400);
}

function confirmName() {
    const raw = playerNameInput.value.trim();
    currentPlayer = raw || 'Anonymous';
    // Update header badge
    currentPlayerSpan.textContent = currentPlayer;
    playerBadge.style.display = 'flex';
    nameModal.classList.remove('active');
    beginGame();
}

// ════════════════════════════════
// AUDIO
// ════════════════════════════════
let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playEatSound() {
    if (!audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}

function playGameOverSound() {
    if (!audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.6);
}

// ════════════════════════════════
// GAME INIT & LOOP
// ════════════════════════════════
function initGame() {
    // Recalculate canvas size from its CSS-rendered dimensions
    const rect = canvas.getBoundingClientRect();
    const size = Math.round(Math.min(rect.width, rect.height));
    canvas.width  = size > 0 ? size : 500;
    canvas.height = canvas.width;
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
    for (let p of snake) {
        if (p.x === food.x && p.y === food.y) { spawnFood(); return; }
    }
}

function updateScore() {
    scoreElement.textContent = score.toString().padStart(3, '0');
}

function gameLoop() {
    if (!gameRunning) return;
    dx = nextDx; dy = nextDy;

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (head.x < 0 || head.x >= TILE_COUNT ||
        head.y < 0 || head.y >= TILE_COUNT ||
        snake.some(p => p.x === head.x && p.y === head.y)) {
        gameOver(); return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score += 10;
        updateScore();
        playEatSound();
        spawnFood();
        // Speed up — but only on PC; mobile stays constant for playability
        const minSpeed = isMobile() ? SPEED_MIN_MOBILE : SPEED_MIN_PC;
        const step     = isMobile() ? SPEED_STEP_MOBILE : SPEED_STEP_PC;
        if (SPEED > minSpeed) SPEED -= step;
    } else {
        snake.pop();
    }

    draw();
    gameLoopTimeout = setTimeout(gameLoop, SPEED);
}

// ── Draw ──
function draw() {
    ctx.fillStyle = '#090910';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= TILE_COUNT; i++) {
        ctx.beginPath(); ctx.moveTo(i * GRID_SIZE, 0); ctx.lineTo(i * GRID_SIZE, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * GRID_SIZE); ctx.lineTo(canvas.width, i * GRID_SIZE); ctx.stroke();
    }

    // Food — pulsing glow
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    ctx.shadowBlur  = 16 + pulse * 12;
    ctx.shadowColor = '#ff007b';
    ctx.fillStyle   = '#ff007b';
    ctx.beginPath();
    ctx.arc(food.x * GRID_SIZE + GRID_SIZE/2, food.y * GRID_SIZE + GRID_SIZE/2, GRID_SIZE/2 - 2, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake — cyan head, gradient body
    snake.forEach((part, index) => {
        const isHead = index === 0;
        const t = index / Math.max(snake.length, 1);
        const g = Math.round(242 * (1 - t) + 80 * t);
        const b = Math.round(255 * (1 - t) + 200 * t);
        ctx.fillStyle = isHead ? '#00f2ff' : `rgb(0,${g},${b})`;

        ctx.shadowBlur  = isHead ? 14 : 0;
        ctx.shadowColor = '#00f2ff';

        const pad = 2, r = 4;
        const x = part.x * GRID_SIZE + pad;
        const y = part.y * GRID_SIZE + pad;
        const w = GRID_SIZE - pad * 2;
        const h = GRID_SIZE - pad * 2;

        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);    ctx.quadraticCurveTo(x+w, y,   x+w, y+r);
        ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
        ctx.lineTo(x + r, y + h);    ctx.quadraticCurveTo(x,   y+h, x, y+h-r);
        ctx.lineTo(x, y + r);        ctx.quadraticCurveTo(x,   y,   x+r, y);
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

    const wasBest = isNewBest(currentPlayer, score);
    addToLeaderboard(currentPlayer, score);
    renderLeaderboard({ name: currentPlayer, score });

    gameoverTitle.textContent = 'GAME OVER';
    let msg = `${currentPlayer} scored ${score} pts`;
    if (wasBest && score > 0) msg += '\n🏆 New High Score!';
    gameoverMsg.textContent = msg;
    overlay.classList.add('active');
}

// ── Begin Game (after name confirmed) ──
function beginGame() {
    overlay.classList.remove('active');
    initGame();
    gameRunning = true;
    // Set speed based on device
    SPEED = isMobile() ? SPEED_MOBILE_START : SPEED_PC_START;
    gameLoop();
}

// ════════════════════════════════
// EVENT LISTENERS
// ════════════════════════════════

// START GAME button (name modal)
startBtn.addEventListener('click', () => {
    initAudio();
    confirmName();
});

// Allow Enter key to confirm name
playerNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { initAudio(); confirmName(); }
});

// TRY AGAIN button (game over overlay) — re-opens name modal
tryAgainBtn.addEventListener('click', () => {
    overlay.classList.remove('active');
    showNameModal(true); // isRetry = true
});

// Clear leaderboard — single click, immediate
clearLbBtn.addEventListener('click', () => {
    localStorage.removeItem(LB_KEY);
    renderLeaderboard();
});

// Keyboard controls
window.addEventListener('keydown', e => {
    switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W': if (dy !== 1)  { nextDx=0;  nextDy=-1; } break;
        case 'ArrowDown':  case 's': case 'S': if (dy !== -1) { nextDx=0;  nextDy=1;  } break;
        case 'ArrowLeft':  case 'a': case 'A': if (dx !== 1)  { nextDx=-1; nextDy=0;  } break;
        case 'ArrowRight': case 'd': case 'D': if (dx !== -1) { nextDx=1;  nextDy=0;  } break;
    }
});

// Mouse / Touch controls
canvas.addEventListener('mousedown', handlePointer);
canvas.addEventListener('touchstart', e => { e.preventDefault(); handlePointer(e.touches[0]); }, { passive: false });

function handlePointer(e) {
    if (!gameRunning) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left)  * (canvas.width  / rect.width);
    const y = (e.clientY - rect.top)   * (canvas.height / rect.height);
    const hx = snake[0].x * GRID_SIZE + GRID_SIZE/2;
    const hy = snake[0].y * GRID_SIZE + GRID_SIZE/2;
    const diffX = x - hx, diffY = y - hy;
    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0 && dx !== -1) { nextDx=1;  nextDy=0; }
        else if (diffX < 0 && dx !== 1) { nextDx=-1; nextDy=0; }
    } else {
        if (diffY > 0 && dy !== -1) { nextDx=0; nextDy=1;  }
        else if (diffY < 0 && dy !== 1) { nextDx=0; nextDy=-1; }
    }
}

// ════════════════════════════════
// BOOT
// ════════════════════════════════
initGame();
draw();
renderLeaderboard();
showNameModal(false); // Show name modal on page load

// Re-init canvas size on orientation change / window resize
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (!gameRunning) {
            initGame();
            draw();
        }
    }, 200);
});
