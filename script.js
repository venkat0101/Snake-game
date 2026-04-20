const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score-value');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const startBtn = document.getElementById('start-btn');

// Game Constants
const GRID_SIZE = 20;
let TILE_COUNT = 0;
let SPEED = 100; // ms per move

// Game State
let snake = [];
let food = { x: 5, y: 5 };
let dx = 0;
let dy = 0;
let nextDx = 1;
let nextDy = 0;
let score = 0;
let gameRunning = false;
let gameLoopTimeout;

// Sound Synthesis
let audioCtx;

function playEatSound() {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
    oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // A5

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
}

function playGameOverSound() {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); 
    oscillator.frequency.linearRampToValueAtTime(110, audioCtx.currentTime + 0.5);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
}

function initGame() {
    // Set canvas size based on CSS size
    const rect = canvas.getBoundingClientRect();
    canvas.width = 600; // Increased from 400
    canvas.height = 600;
    TILE_COUNT = canvas.width / GRID_SIZE;

    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    
    score = 0;
    updateScore();
    
    nextDx = 1;
    nextDy = 0;
    dx = 1;
    dy = 0;
    
    spawnFood();
}

function spawnFood() {
    food.x = Math.floor(Math.random() * TILE_COUNT);
    food.y = Math.floor(Math.random() * TILE_COUNT);
    
    // Don't spawn food on snake body
    for (let part of snake) {
        if (part.x === food.x && part.y === food.y) {
            spawnFood();
            break;
        }
    }
}

function updateScore() {
    scoreElement.textContent = score.toString().padStart(3, '0');
}

function gameLoop() {
    if (!gameRunning) return;

    // Update direction
    dx = nextDx;
    dy = nextDy;

    // Move head
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Check collisions
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT || 
        snake.some(part => part.x === head.x && part.y === head.y)) {
        gameOver();
        return;
    }

    snake.unshift(head);

    // Check food
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        updateScore();
        playEatSound();
        spawnFood();
        // Slightly increase speed
        if (SPEED > 50) SPEED -= 1;
    } else {
        snake.pop();
    }

    draw();
    gameLoopTimeout = setTimeout(gameLoop, SPEED);
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (Subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < TILE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(canvas.width, i * GRID_SIZE);
        ctx.stroke();
    }

    // Draw Food
    ctx.fillStyle = '#ff007b';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff007b';
    ctx.beginPath();
    ctx.arc(food.x * GRID_SIZE + GRID_SIZE/2, food.y * GRID_SIZE + GRID_SIZE/2, GRID_SIZE/2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Snake
    snake.forEach((part, index) => {
        const isHead = index === 0;
        ctx.fillStyle = isHead ? '#00f2ff' : '#0088ff';
        
        if (isHead) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00f2ff';
        }
        
        const padding = 2;
        ctx.fillRect(
            part.x * GRID_SIZE + padding, 
            part.y * GRID_SIZE + padding, 
            GRID_SIZE - padding * 2, 
            GRID_SIZE - padding * 2
        );
        ctx.shadowBlur = 0;
    });
}

function gameOver() {
    gameRunning = false;
    clearTimeout(gameLoopTimeout);
    playGameOverSound();
    
    overlayTitle.textContent = 'GAME OVER';
    overlayMsg.textContent = `Final Score: ${score}`;
    startBtn.textContent = 'TRY AGAIN';
    overlay.classList.add('active');
}

function startGame() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    overlay.classList.remove('active');
    initGame();
    gameRunning = true;
    SPEED = 100;
    gameLoop();
}

// Controls
window.addEventListener('keydown', e => {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (dy !== 1) { nextDx = 0; nextDy = -1; }
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (dy !== -1) { nextDx = 0; nextDy = 1; }
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (dx !== 1) { nextDx = -1; nextDy = 0; }
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (dx !== -1) { nextDx = 1; nextDy = 0; }
            break;
    }
});

// Mouse/Touch Controls
canvas.addEventListener('mousedown', handlePointer);
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    handlePointer(e.touches[0]);
}, { passive: false });

function handlePointer(e) {
    if (!gameRunning) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const headX = snake[0].x * GRID_SIZE + GRID_SIZE/2;
    const headY = snake[0].y * GRID_SIZE + GRID_SIZE/2;
    
    const diffX = x - headX;
    const diffY = y - headY;
    
    if (Math.abs(diffX) > Math.abs(diffY)) {
        // Horizontal move
        if (diffX > 0 && dx !== -1) { nextDx = 1; nextDy = 0; }
        else if (diffX < 0 && dx !== 1) { nextDx = -1; nextDy = 0; }
    } else {
        // Vertical move
        if (diffY > 0 && dy !== -1) { nextDx = 0; nextDy = 1; }
        else if (diffY < 0 && dy !== 1) { nextDx = 0; nextDy = -1; }
    }
}

startBtn.addEventListener('click', startGame);

// Initial Draw
initGame();
draw();
