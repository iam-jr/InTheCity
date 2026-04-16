// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

if (!ctx) {
    alert('Canvas not supported on this device');
}

// HUD elements
const coinsCountEl = document.getElementById('coinsCount');
const hitsCountEl = document.getElementById('hitsCount');
const positionEl = document.getElementById('position');
const statusLabelEl = document.getElementById('statusLabel');
const pauseBtn = document.getElementById('pauseBtn');
const startBtn = document.getElementById('startBtn');
const startScreenEl = document.getElementById('startScreen');
const cityStripEl = document.getElementById('cityStrip');
const gameContainerEl = document.querySelector('.game-container');

// Game configuration
const TILE_SIZE = 40;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 32;

const DISTRICT_BLOCK = [
    [4, 4, 4, 4, 4, 4, 0, 0, 4, 2, 2, 2, 2, 4, 0, 0, 4, 4, 4, 4],
    [4, 0, 0, 0, 0, 4, 0, 0, 4, 2, 2, 2, 2, 4, 0, 0, 4, 0, 0, 4],
    [4, 0, 0, 0, 0, 4, 0, 0, 4, 2, 2, 2, 2, 4, 0, 0, 4, 0, 0, 4],
    [4, 0, 0, 0, 0, 4, 0, 0, 4, 2, 2, 2, 2, 4, 0, 0, 4, 0, 0, 4],
    [4, 4, 4, 4, 4, 4, 0, 0, 4, 4, 4, 4, 4, 4, 0, 0, 4, 4, 4, 4],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [4, 4, 4, 4, 4, 4, 0, 0, 4, 2, 2, 2, 2, 4, 0, 0, 4, 4, 4, 4]
];

function createCityMap(width, height) {
    const map = [];
    for (let y = 0; y < height; y++) {
        const sourceRow = DISTRICT_BLOCK[y % DISTRICT_BLOCK.length];
        const row = [];
        for (let x = 0; x < width; x++) {
            row.push(sourceRow[x % sourceRow.length]);
        }
        map.push(row);
    }
    return map;
}

const cityMap = createCityMap(MAP_WIDTH, MAP_HEIGHT);
const WORLD_WIDTH = MAP_WIDTH * TILE_SIZE;
const WORLD_HEIGHT = MAP_HEIGHT * TILE_SIZE;

const tileColors = {
    0: '#3f4c59',
    2: '#1e6b4a',
    4: '#adb8c5'
};

const player = {
    x: TILE_SIZE * 7,
    y: TILE_SIZE * 4,
    size: 126,
    color: '#2ea8ff',
    speed: 2.6
};

const PLAYER_SPAWN = {
    x: TILE_SIZE * 7,
    y: TILE_SIZE * 4
};

let hits = 0;
let gameState = 'ready'; // ready, playing, paused, won

function tileCenter(tx, ty) {
    return {
        x: tx * TILE_SIZE + TILE_SIZE / 2,
        y: ty * TILE_SIZE + TILE_SIZE / 2
    };
}

function generateCoins(map) {
    const generated = [];
    for (let ty = 2; ty < map.length - 1; ty++) {
        for (let tx = 1; tx < MAP_WIDTH - 1; tx++) {
            const tile = map[ty][tx];
            const isWalkableLane = tile === 0 || tile === 4;
            if (isWalkableLane && ty % 3 === 1 && tx % 4 === 2) {
                generated.push({ ...tileCenter(tx, ty), collected: false });
            }
            if (generated.length >= 42) {
                return generated;
            }
        }
    }
    return generated;
}

function generateObstacles(map) {
    const generated = [];
    for (let ty = 3; ty < map.length - 2; ty++) {
        for (let tx = 1; tx < MAP_WIDTH - 1; tx++) {
            const tile = map[ty][tx];
            if (tile === 0 && ty % 5 === 0 && tx % 5 === 3) {
                generated.push({ ...tileCenter(tx, ty), frame: 0 });
            }
            if (generated.length >= 24) {
                return generated;
            }
        }
    }
    return generated;
}

const coins = generateCoins(cityMap);
const obstacles = generateObstacles(cityMap);

const totalCoins = coins.length;
const keys = {};
const mouse = {
    x: player.x + player.size / 2,
    y: player.y + player.size / 2,
    insideCanvas: false
};

const touch = {
    active: false
};

const view = {
    scale: 1,
    offsetX: 0,
    offsetY: 0
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function updatePointerFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = ((clientX - rect.left) / rect.width) * canvas.width;
    const canvasY = ((clientY - rect.top) / rect.height) * canvas.height;
    const worldX = (canvasX - view.offsetX) / view.scale;
    const worldY = (canvasY - view.offsetY) / view.scale;

    mouse.x = clamp(worldX, 0, WORLD_WIDTH);
    mouse.y = clamp(worldY, 0, WORLD_HEIGHT);
}

function updateViewTransform() {
    const scaleX = canvas.width / WORLD_WIDTH;
    const scaleY = canvas.height / WORLD_HEIGHT;
    view.scale = Math.min(scaleX, scaleY);
    view.offsetX = (canvas.width - WORLD_WIDTH * view.scale) / 2;
    view.offsetY = (canvas.height - WORLD_HEIGHT * view.scale) / 2;
}

function getViewportSize() {
    const innerWidth = window.innerWidth || document.documentElement.clientWidth;
    const innerHeight = window.innerHeight || document.documentElement.clientHeight;
    let height = innerHeight;
    if (window.visualViewport) {
        height = Math.min(innerHeight, window.visualViewport.height);
    }

    return {
        width: innerWidth,
        height
    };
}

function resizeCanvas() {
    const viewport = getViewportSize();
    const headerHeight = document.querySelector('.game-header')?.offsetHeight || 0;
    const stripHeight = cityStripEl?.offsetHeight || 0;
    const styles = gameContainerEl ? getComputedStyle(gameContainerEl) : null;
    const paddingTop = styles ? parseFloat(styles.paddingTop) : 0;
    const paddingBottom = styles ? parseFloat(styles.paddingBottom) : 0;
    const availableHeight = Math.max(220, Math.floor(viewport.height - headerHeight - stripHeight - paddingTop - paddingBottom - 16));

    const maxWidth = Math.max(280, Math.min(viewport.width - 12, 1000));
    const maxHeight = Math.max(220, Math.min(700, availableHeight));

    canvas.width = Math.floor(maxWidth);
    canvas.height = Math.floor(maxHeight);
    updateViewTransform();

    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.size, player.x));
    player.y = Math.max(0, Math.min(WORLD_HEIGHT - player.size, player.y));
    mouse.x = clamp(mouse.x, 0, WORLD_WIDTH);
    mouse.y = clamp(mouse.y, 0, WORLD_HEIGHT);
}

function isWalkable(x, y) {
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);

    if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) {
        return false;
    }

    const tile = cityMap[tileY][tileX];
    return tile === 0 || tile === 4 || tile === 2;
}

function coinsCollectedCount() {
    return coins.filter((coin) => coin.collected).length;
}

function resetProgress() {
    coins.forEach((coin) => {
        coin.collected = false;
    });
}

function resetPlayer() {
    player.x = PLAYER_SPAWN.x;
    player.y = PLAYER_SPAWN.y;
    mouse.x = player.x + player.size / 2;
    mouse.y = player.y + player.size / 2;
}

function resetGame() {
    resetPlayer();
    resetProgress();
    hits = 0;
    gameState = 'playing';
    statusLabelEl.textContent = 'Running';
    pauseBtn.textContent = 'PAUSE';
}

function handleObstacleHit() {
    hits += 1;
    resetPlayer();
    resetProgress();
    statusLabelEl.textContent = 'Hit! Coins reset';
}

function updatePlayer() {
    if (gameState !== 'playing') {
        return;
    }

    let newX = player.x;
    let newY = player.y;

    if (mouse.insideCanvas) {
        newX = clamp(mouse.x - player.size / 2, 0, WORLD_WIDTH - player.size);
        newY = clamp(mouse.y - player.size / 2, 0, WORLD_HEIGHT - player.size);
    } else {
        if (keys['w'] || keys['arrowup']) newY -= player.speed;
        if (keys['s'] || keys['arrowdown']) newY += player.speed;
        if (keys['a'] || keys['arrowleft']) newX -= player.speed;
        if (keys['d'] || keys['arrowright']) newX += player.speed;
    }

    const centerX = newX + player.size / 2;
    const centerY = newY + player.size / 2;

    for (const obstacle of obstacles) {
        const dx = centerX - obstacle.x;
        const dy = centerY - obstacle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 20) {
            handleObstacleHit();
            return;
        }
    }

    if (isWalkable(centerX, centerY)) {
        player.x = newX;
        player.y = newY;
    }

    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.size, player.x));
    player.y = Math.max(0, Math.min(WORLD_HEIGHT - player.size, player.y));

    const px = player.x + player.size / 2;
    const py = player.y + player.size / 2;

    for (const coin of coins) {
        if (coin.collected) {
            continue;
        }

        const dx = px - coin.x;
        const dy = py - coin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 20) {
            coin.collected = true;
        }
    }

    if (coinsCollectedCount() === totalCoins) {
        gameState = 'won';
        statusLabelEl.textContent = 'Victory';
    }
}

function drawMap() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tile = cityMap[y][x];
            ctx.fillStyle = tileColors[tile];
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            if (tile === 2 && (x + y) % 2 === 0) {
                ctx.fillStyle = '#2a8f66';
                ctx.beginPath();
                ctx.arc(x * TILE_SIZE + 20, y * TILE_SIZE + 20, 8, 0, Math.PI * 2);
                ctx.fill();
            }

            if (tile === 0 && y % 2 === 1 && x % 2 === 0) {
                ctx.fillStyle = '#f4f7fc';
                ctx.fillRect(x * TILE_SIZE + 16, y * TILE_SIZE + 18, 8, 4);
            }
        }
    }
}

function drawPlayer() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(player.x + player.size / 2, player.y + player.size - 2, player.size / 2.5, player.size / 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x + player.size / 2, player.y + player.size / 2, player.size / 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ced8e6';
    ctx.beginPath();
    ctx.arc(player.x + player.size / 2, player.y + player.size / 3, player.size / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0c121e';
    ctx.fillRect(player.x + player.size / 2 - 4, player.y + player.size / 3 - 2, 2, 2);
    ctx.fillRect(player.x + player.size / 2 + 2, player.y + player.size / 3 - 2, 2, 2);
}

function drawCoins() {
    for (const coin of coins) {
        if (coin.collected) {
            continue;
        }

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e6edf8';
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#9ba8be';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', coin.x, coin.y);
    }
}

function drawObstacles() {
    for (const obstacle of obstacles) {
        obstacle.frame = (obstacle.frame + 0.05) % (Math.PI * 2);

        ctx.fillStyle = '#2a8f66';
        ctx.fillRect(obstacle.x - 3, obstacle.y, 6, 15);

        const petalCount = 5;
        const petalSize = 8;
        const centerRadius = 6;

        for (let i = 0; i < petalCount; i++) {
            const angle = (Math.PI * 2 / petalCount) * i + obstacle.frame;
            const petalX = obstacle.x + Math.cos(angle) * centerRadius;
            const petalY = obstacle.y + Math.sin(angle) * centerRadius;

            ctx.fillStyle = '#dde4f0';
            ctx.beginPath();
            ctx.arc(petalX, petalY, petalSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.fillRect(obstacle.x - 3, obstacle.y - 1, 2, 2);
        ctx.fillRect(obstacle.x + 1, obstacle.y - 1, 2, 2);
    }
}

function drawOverlay(text, subText) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 48px Arial';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 22);

    ctx.font = '20px Arial';
    ctx.fillText(subText, canvas.width / 2, canvas.height / 2 + 22);
}

function updateHUD() {
    const collected = coinsCollectedCount();
    coinsCountEl.textContent = `${collected}/${totalCoins}`;
    hitsCountEl.textContent = String(hits);

    const tileX = Math.floor(player.x / TILE_SIZE);
    const tileY = Math.floor(player.y / TILE_SIZE);
    positionEl.textContent = `X: ${tileX}, Y: ${tileY}`;

    if (gameState === 'ready') {
        statusLabelEl.textContent = 'Ready';
    } else if (gameState === 'paused') {
        statusLabelEl.textContent = 'Paused';
    } else if (gameState === 'playing' && collected < totalCoins) {
        statusLabelEl.textContent = 'Running';
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill letterbox areas when viewport ratio differs from world ratio.
    ctx.fillStyle = '#07111a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(view.offsetX, view.offsetY);
    ctx.scale(view.scale, view.scale);
    drawMap();
    drawCoins();
    drawObstacles();
    drawPlayer();
    ctx.restore();

    if (gameState === 'paused') {
        drawOverlay('PAUSED', 'Press PAUSE to continue');
    }

    if (gameState === 'won') {
        drawOverlay('YOU WIN', 'Press R to play again');
    }
}

function gameLoop() {
    updatePlayer();
    updateHUD();
    draw();
    requestAnimationFrame(gameLoop);
}

function togglePause() {
    if (gameState !== 'playing' && gameState !== 'paused') {
        return;
    }

    if (gameState === 'playing') {
        gameState = 'paused';
        pauseBtn.textContent = 'RESUME';
    } else {
        gameState = 'playing';
        pauseBtn.textContent = 'PAUSE';
    }
}

function startGame() {
    startScreenEl.classList.remove('active');
    resetGame();
}

function initCityStrip() {
    if (!cityStripEl) {
        return;
    }

    const slides = Array.from(cityStripEl.querySelectorAll('.city-slide'));
    if (slides.length <= 1) {
        return;
    }

    let activeIndex = 0;
    slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === 0);
    });

    window.setInterval(() => {
        activeIndex = (activeIndex + 1) % slides.length;
        slides.forEach((slide, index) => {
            slide.classList.toggle('active', index === activeIndex);
        });
    }, 6000);
}

document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    keys[key] = true;

    if (key === 'p') {
        togglePause();
    }

    if (key === 'r' && gameState === 'won') {
        resetGame();
    }
});

document.addEventListener('keyup', (event) => {
    keys[event.key.toLowerCase()] = false;
});

pauseBtn.addEventListener('click', togglePause);
startBtn.addEventListener('click', startGame);

canvas.addEventListener('mousemove', (event) => {
    updatePointerFromClient(event.clientX, event.clientY);
});

canvas.addEventListener('mouseenter', () => {
    mouse.insideCanvas = true;
});

canvas.addEventListener('mouseleave', () => {
    mouse.insideCanvas = false;
});

canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

canvas.addEventListener('touchstart', (event) => {
    if (event.cancelable) {
        event.preventDefault();
    }

    if (!event.touches || event.touches.length === 0) {
        return;
    }

    const touchObj = event.touches[0];
    touch.active = true;
    updatePointerFromClient(touchObj.clientX, touchObj.clientY);
    mouse.insideCanvas = true;
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
    if (event.cancelable) {
        event.preventDefault();
    }

    if (!event.touches || event.touches.length === 0) {
        return;
    }

    const touchObj = event.touches[0];
    updatePointerFromClient(touchObj.clientX, touchObj.clientY);
    mouse.insideCanvas = true;
}, { passive: false });

canvas.addEventListener('touchend', (event) => {
    if (event.cancelable) {
        event.preventDefault();
    }

    touch.active = false;
    if (!event.touches || event.touches.length === 0) {
        mouse.insideCanvas = false;
    }
}, { passive: false });

canvas.addEventListener('touchcancel', () => {
    touch.active = false;
    mouse.insideCanvas = false;
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100);
});

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        setTimeout(resizeCanvas, 50);
    });
}

resizeCanvas();
updateHUD();
initCityStrip();
gameLoop();
