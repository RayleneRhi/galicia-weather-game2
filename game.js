// Galicia Farm Chaos - Game Logic

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const startBtn = document.getElementById('start-btn');
const endBtn = document.getElementById('end-btn');
const volumeSlider = document.getElementById('volume-slider');
const rewardPanel = document.getElementById('rewards-list');
const messageOverlay = document.getElementById('message-overlay');

// Game state
let gameRunning = false;
let score = 0;
let characters = [];
let waitingCharacters = { european: [], moroccan: [] };
let rewards = {};
let weather = 'sun'; // 'sun' or 'rain'
let weatherTimer = null;
let lastTime = 0;
let clouds = [];
let rainDrops = [];
let birds = [];
let hpUpdateAccumulator = 0;

// Audio context
let audioContext = null;
let masterGain = null;

// Character types and names
const europeanNames = [
    'Xosé', 'María', 'Antón', 'Carmen', 'Piotr', 'Anna', 'Andriy', 'Olena',
    'Mikael', 'Liisa', 'János', 'Eszter', 'Dmitri', 'Natasha', 'Viktor', 'Iryna',
    'Manuel', 'Lucía', 'Breixo', 'Sabela', 'Kacper', 'Zofia', 'Oleksandr', 'Kateryna'
];

const moroccanNames = [
    'Mohammed', 'Fatima', 'Ahmed', 'Aisha', 'Hassan', 'Khadija', 'Youssef', 'Zahra',
    'Omar', 'Mariam', 'Rachid', 'Nadia', 'Karim', 'Salma', 'Tariq', 'Layla',
    'Brahim', 'Samira', 'Mustafa', 'Imane', 'Ali', 'Soumaya', 'Hamid', 'Meriem'
];

const rewardTypes = [
    { name: 'Pulpo', icon: '🐙' },
    { name: 'Calamar', icon: '🦑' },
    { name: 'Mejillones', icon: '🦪' },
    { name: 'Navajas', icon: '🐚' },
    { name: 'Vieiras', icon: '🦐' },
    { name: 'Sidra', icon: '🍶' },
    { name: 'Grelos', icon: '🥬' },
    { name: 'Patatas', icon: '🥔' },
    { name: 'Pimientos de Padrón', icon: '🌶️' },
    { name: 'Empanada', icon: '🥟' },
    { name: 'Queso Tetilla', icon: '🧀' },
    { name: 'Pan gallego', icon: '🍞' }
];

// Balance constants (recalibrated)
const MAX_HP = 100;
const RECRUITMENT_COST = 50;
const WORK_SCORE_RATE = 2; // points per second while working
const MIN_SPAWN_INTERVAL = 8000;
const MAX_SPAWN_INTERVAL = 15000;

// HP changes per second - based on new requirements
// European: rain no umbrella -2, rain with umbrella 0, rain with umbrella+working +1
//           sun no umbrella +1, sun no umbrella+working +2, sun with umbrella 1
// Moroccan: rain no umbrella -4, rain with umbrella 0
//           sun no umbrella +2, sun no umbrella+working +3, sun with umbrella -2
const HP_CHANGE = {
    rain: {
        european: { noUmbrella: -2, withUmbrella: 0, withUmbrellaWorking: 1 },
        moroccan: { noUmbrella: -4, withUmbrella: 0 }
    },
    sun: {
        european: { noUmbrella: 1, noUmbrellaWorking: 2, withUmbrella: 1 },
        moroccan: { noUmbrella: 2, noUmbrellaWorking: 3, withUmbrella: -2 }
    }
};

// Character class
class Character {
    constructor(type, name, x, y) {
        this.type = type; // 'european' or 'moroccan'
        this.name = name;
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 40;
        this.vy = (Math.random() - 0.5) * 40;
        this.hp = MAX_HP;
        this.hasUmbrella = false;
        this.isWorking = false;
        this.isFrozen = false;
        this.isSmoking = false;
        this.smokeTimer = 0;
        this.digAnimation = 0;
        this.color = type === 'european' ? '#4A90E2' : '#E8A54A';
        this.width = 30;
        this.height = 45;
    }

    update(dt, fieldRect) {
        // Handle smoking - visual only, no HP penalty
        if (this.isSmoking) {
            this.smokeTimer -= dt;
            if (this.smokeTimer <= 0) {
                this.isSmoking = false;
            }
            return;
        }

        // Random smoking event for Moroccans in sun (very rare) - visual effect only
        // Only when not working, no umbrella, on sun
        if (this.type === 'moroccan' && weather === 'sun' && !this.isWorking && 
            !this.hasUmbrella && Math.random() < 0.001) {
            this.isSmoking = true;
            this.smokeTimer = 2 + Math.random() * 4; // 2-6 seconds, less than one sun cycle
            this.vx = 0;
            this.vy = 0;
            return;
        }

        // Check if in agricultural zone (lower half)
        const agZoneY = fieldRect.y + fieldRect.height / 2;
        this.isWorking = this.y > agZoneY;

        // Movement behavior
        if (this.isFrozen) {
            this.vx = 0;
            this.vy = 0;
        } else if (this.isSmoking) {
            this.vx = 0;
            this.vy = 0;
        } else {
            // Natural wandering
            if (Math.random() < 0.02) {
                this.vx = (Math.random() - 0.5) * 60;
                this.vy = (Math.random() - 0.5) * 60;
            }

            // Slow down in work zone
            if (this.isWorking) {
                this.vx *= 0.95;
                this.vy *= 0.95;
            }

            // Boundary checking
            if (this.x < fieldRect.x + 20) this.vx = Math.abs(this.vx);
            if (this.x > fieldRect.x + fieldRect.width - 20) this.vx = -Math.abs(this.vx);
            if (this.y < fieldRect.y + 20) this.vy = Math.abs(this.vy);
            if (this.y > fieldRect.y + fieldRect.height - 20) this.vy = -Math.abs(this.vy);
        }

        // Apply velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Keep in bounds
        this.x = Math.max(fieldRect.x + 20, Math.min(fieldRect.x + fieldRect.width - 20, this.x));
        this.y = Math.max(fieldRect.y + 20, Math.min(fieldRect.y + fieldRect.height - 20, this.y));

        // Dig animation
        if (this.isWorking && !this.isFrozen && !this.isSmoking) {
            this.digAnimation += dt * 5;
        }

        // HP changes based on weather and conditions - NEW LOGIC
        // Note: HP is updated once per second via hpUpdateAccumulator in gameLoop
        let hpChange = 0;
        const weatherData = HP_CHANGE[weather][this.type];

        if (this.isFrozen) {
            hpChange = weatherData.withUmbrella; // Frozen but stable
        } else if (this.hasUmbrella) {
            if (this.type === 'moroccan' && weather === 'rain') {
                // Moroccan freezes with umbrella in rain
                this.isFrozen = true;
                hpChange = weatherData.withUmbrella;
            } else {
                hpChange = weatherData.withUmbrella;
                this.isFrozen = false;
            }
            
            // Special case: European with umbrella working in rain gets +1
            if (this.type === 'european' && weather === 'rain' && this.isWorking) {
                hpChange = weatherData.withUmbrellaWorking;
            }
        } else {
            this.isFrozen = false;
            
            // Moroccan in sun without umbrella - MUST gain HP (override any other logic)
            if (this.type === 'moroccan' && weather === 'sun') {
                if (this.isWorking) {
                    hpChange = weatherData.noUmbrellaWorking; // +3 HP/s
                } else {
                    hpChange = weatherData.noUmbrella; // +2 HP/s
                }
            } else if (this.isWorking && weather === 'sun') {
                // Working in sun without umbrella (European)
                hpChange = weatherData.noUmbrellaWorking;
            } else {
                // Just standing in weather without umbrella
                hpChange = weatherData.noUmbrella;
            }
        }
        
        // Store hpChange for periodic update (smoking is visual only - no HP change)
        if (!this.isSmoking) {
            this.pendingHpChange = hpChange;
        } else {
            this.pendingHpChange = 0;
        }
    }
    
    applyHpUpdate(dt) {
        // Apply accumulated HP change (called once per second from gameLoop)
        if (this.pendingHpChange !== undefined) {
            this.hp += this.pendingHpChange;
            this.hp = Math.min(MAX_HP, Math.max(0, this.hp));
        }
    }

    draw(ctx) {
        // Draw character body
        ctx.fillStyle = this.color;
        
        // Body (simple oval)
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.width/2, this.height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Head
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.height/2 + 5, 12, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (two dots)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x - 4, this.y - this.height/2 + 3, 3, 0, Math.PI * 2);
        ctx.arc(this.x + 4, this.y - this.height/2 + 3, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x - 4, this.y - this.height/2 + 3, 1.5, 0, Math.PI * 2);
        ctx.arc(this.x + 4, this.y - this.height/2 + 3, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Shovel when working
        if (this.isWorking && !this.isFrozen && !this.isSmoking) {
            ctx.save();
            ctx.translate(this.x + 15, this.y);
            const digAngle = Math.sin(this.digAnimation) * 0.5;
            ctx.rotate(digAngle);
            
            // Shovel handle
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, 25);
            ctx.stroke();
            
            // Shovel blade
            ctx.fillStyle = '#666';
            ctx.beginPath();
            ctx.ellipse(0, 28, 8, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }

        // Smoking animation
        if (this.isSmoking) {
            ctx.fillStyle = '#ccc';
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(this.x + 10, this.y - this.height/2 - 5 - i * 8, 3 + i, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Umbrella
        if (this.hasUmbrella) {
            this.drawUmbrella(ctx);
        }

        // HP bar above head
        const hpBarWidth = 40;
        const hpBarHeight = 5;
        const hpBarX = this.x - hpBarWidth / 2;
        const hpBarY = this.y - this.height/2 - 20;
        
        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
        
        // HP fill
        const hpPercent = this.hp / MAX_HP;
        if (hpPercent > 0.6) {
            ctx.fillStyle = '#4CAF50';
        } else if (hpPercent > 0.3) {
            ctx.fillStyle = '#FFC107';
        } else {
            ctx.fillStyle = '#f44336';
        }
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth * hpPercent, hpBarHeight);

        // HP number
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(this.hp), this.x, hpBarY - 8);

        // Name label below character
        ctx.fillStyle = 'white';
        ctx.font = '11px Arial';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.strokeText(this.name, this.x, this.y + this.height/2 + 15);
        ctx.fillText(this.name, this.x, this.y + this.height/2 + 15);
    }

    drawUmbrella(ctx) {
        const ux = this.x;
        const uy = this.y - this.height/2 - 10;
        
        // Handle (curved)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ux, uy);
        ctx.lineTo(ux, uy + 25);
        // Curved hook
        ctx.quadraticCurveTo(ux, uy + 32, ux + 8, uy + 35);
        ctx.stroke();

        // Canopy (semi-circle)
        ctx.fillStyle = this.type === 'european' ? '#5DADE2' : '#F5B041';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.arc(ux, uy, 20, Math.PI, 0);
        ctx.lineTo(ux + 20, uy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Ribs
        ctx.beginPath();
        ctx.moveTo(ux, uy);
        ctx.lineTo(ux - 15, uy - 12);
        ctx.moveTo(ux, uy);
        ctx.lineTo(ux, uy - 20);
        ctx.moveTo(ux, uy);
        ctx.lineTo(ux + 15, uy - 12);
        ctx.stroke();
    }

    toggleUmbrella() {
        this.hasUmbrella = !this.hasUmbrella;
        if (this.hasUmbrella) {
            playSound('umbrellaOpen');
        } else {
            playSound('umbrellaClose');
        }
    }
}

// Collision avoidance
function checkCollisions() {
    const minDistance = 50;
    
    for (let i = 0; i < characters.length; i++) {
        for (let j = i + 1; j < characters.length; j++) {
            const c1 = characters[i];
            const c2 = characters[j];
            
            const dx = c2.x - c1.x;
            const dy = c2.y - c1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < minDistance) {
                const angle = Math.atan2(dy, dx);
                const push = (minDistance - dist) / 2;
                
                c1.x -= Math.cos(angle) * push;
                c1.y -= Math.sin(angle) * push;
                c2.x += Math.cos(angle) * push;
                c2.y += Math.sin(angle) * push;
            }
        }
    }
}

// Weather system
function changeWeather() {
    if (!gameRunning) return;
    
    weather = weather === 'sun' ? 'rain' : 'sun';
    
    // Reset effects
    if (weather === 'rain') {
        clouds = [];
        // Create initial clouds
        for (let i = 0; i < 5; i++) {
            clouds.push({
                x: Math.random() * canvas.width,
                y: 30 + Math.random() * 40,
                width: 60 + Math.random() * 40,
                speed: (Math.random() - 0.5) * 30,
                direction: Math.random() > 0.5 ? 1 : -1
            });
        }
        startAmbientSound('rain');
        rainDrops = [];
    } else {
        // Birds for sunny weather
        birds = [];
        for (let i = 0; i < 3; i++) {
            birds.push({
                x: Math.random() * canvas.width,
                y: 20 + Math.random() * 30,
                vx: 50 + Math.random() * 30,
                phase: Math.random() * Math.PI * 2
            });
        }
        playSound('birds');
        startAmbientSound('sun');
    }
    
    // Schedule next change
    const duration = weather === 'rain' 
        ? 3 + Math.random() * 9  // 3-12 seconds
        : 5 + Math.random() * 10; // 5-15 seconds
    
    clearTimeout(weatherTimer);
    weatherTimer = setTimeout(changeWeather, duration * 1000);
}

// Draw weather effects
function drawWeather() {
    if (weather === 'rain') {
        // Draw sun rays faintly in background (even during rain, subtle)
        drawSunRays(0.1);
        
        // Draw clouds
        ctx.fillStyle = 'rgba(220, 220, 220, 0.9)';
        clouds.forEach(cloud => {
            ctx.beginPath();
            ctx.ellipse(cloud.x, cloud.y, cloud.width/2, 25, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Fluffy edges
            ctx.beginPath();
            ctx.arc(cloud.x - cloud.width/3, cloud.y + 5, 20, 0, Math.PI * 2);
            ctx.arc(cloud.x + cloud.width/3, cloud.y + 5, 20, 0, Math.PI * 2);
            ctx.fill();
            
            // Move cloud
            cloud.x += cloud.speed * cloud.direction * 0.016;
            
            // Wrap around
            if (cloud.direction > 0 && cloud.x > canvas.width + 100) {
                cloud.x = -100;
            } else if (cloud.direction < 0 && cloud.x < -100) {
                cloud.x = canvas.width + 100;
            }
        });
        
        // Generate rain drops
        if (rainDrops.length < 200) {
            rainDrops.push({
                x: Math.random() * canvas.width,
                y: 80,
                length: 10 + Math.random() * 15,
                speed: 200 + Math.random() * 100,
                angle: (Math.random() - 0.5) * 0.3
            });
        }
        
        // Draw and update rain
        ctx.strokeStyle = 'rgba(100, 150, 200, 0.6)';
        ctx.lineWidth = 1.5;
        rainDrops.forEach(drop => {
            ctx.beginPath();
            const endX = drop.x + Math.sin(drop.angle) * drop.length;
            const endY = drop.y + drop.length;
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            drop.y += drop.speed * 0.016;
            drop.x += Math.sin(drop.angle) * drop.speed * 0.016;
            
            if (drop.y > canvas.height) {
                drop.y = 80;
                drop.x = Math.random() * canvas.width;
            }
        });
        
    } else {
        // Sunny weather
        drawSunRays(0.3);
        
        // Draw birds
        ctx.fillStyle = '#333';
        birds.forEach(bird => {
            bird.x += bird.vx * 0.016;
            if (bird.x > canvas.width + 50) {
                bird.x = -50;
            }
            
            const wingOffset = Math.sin(Date.now() / 100 + bird.phase) * 5;
            
            ctx.beginPath();
            ctx.moveTo(bird.x - 10, bird.y + wingOffset);
            ctx.quadraticCurveTo(bird.x, bird.y - 5, bird.x + 10, bird.y + wingOffset);
            ctx.quadraticCurveTo(bird.x, bird.y, bird.x - 10, bird.y + wingOffset);
            ctx.fill();
        });
    }
}

function drawSunRays(alpha) {
    const centerX = canvas.width / 2;
    const centerY = -50;
    
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const rayLength = 150 + Math.sin(Date.now() / 500 + i) * 30;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle);
        
        const gradient = ctx.createLinearGradient(0, 0, rayLength, 0);
        gradient.addColorStop(0, `rgba(255, 220, 100, ${alpha})`);
        gradient.addColorStop(1, 'rgba(255, 220, 100, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, -10, rayLength, 20);
        ctx.restore();
    }
}

// Draw agricultural zone
function drawField() {
    const fieldY = canvas.height / 2;
    
    // Green hills background
    const gradient = ctx.createLinearGradient(0, fieldY, 0, canvas.height);
    gradient.addColorStop(0, '#90EE90');
    gradient.addColorStop(0.5, '#228B22');
    gradient.addColorStop(1, '#006400');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, fieldY, canvas.width, canvas.height - fieldY);
    
    // Hill contours
    ctx.strokeStyle = '#1a6b1a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const baseY = fieldY + 20 + i * 30;
        ctx.moveTo(0, baseY);
        for (let x = 0; x < canvas.width; x += 50) {
            ctx.lineTo(x, baseY + Math.sin(x / 100 + i) * 15);
        }
        ctx.stroke();
    }
    
    // Crop details
    drawCrops();
}

function drawCrops() {
    const crops = [
        { emoji: '🥔', count: 15 },
        { emoji: '🍅', count: 10 },
        { emoji: '🥬', count: 12 },
        { emoji: '🍎', count: 8 }
    ];
    
    const fieldY = canvas.height / 2;
    
    crops.forEach(crop => {
        for (let i = 0; i < crop.count; i++) {
            const x = 50 + (i * 73) % canvas.width;
            const y = fieldY + 40 + ((i * 47) % (canvas.height - fieldY - 60));
            ctx.font = '16px Arial';
            ctx.globalAlpha = 0.7;
            ctx.fillText(crop.emoji, x, y);
            ctx.globalAlpha = 1;
        }
    });
}

// Spawn waiting characters
let lastSpawnTime = 0;

function spawnInitialCharacters() {
    const fieldRect = {
        x: 20,
        y: 100,
        width: canvas.width - 40,
        height: canvas.height - 120
    };
    
    // Define arrival zones to avoid
    const leftArrivalX = 120;
    const rightArrivalX = canvas.width - 120;
    const arrivalZoneY = canvas.height - 80;
    const arrivalZoneWidth = 100;
    const arrivalZoneHeight = 60;
    
    // Create 3 initial characters: 2 Europeans and 1 Moroccan (or vice versa)
    const initialTypes = ['european', 'european', 'moroccan'];
    
    initialTypes.forEach((type, index) => {
        const names = type === 'european' ? europeanNames : moroccanNames;
        const name = names[Math.floor(Math.random() * names.length)];
        
        // Find a valid position not in arrival zones
        let x, y, validPosition;
        let attempts = 0;
        
        do {
            validPosition = true;
            // Position in upper/middle area initially (not too close to bottom)
            x = 100 + Math.random() * (canvas.width - 200);
            y = 150 + Math.random() * (canvas.height / 2 - 100);
            
            // Check if position is inside arrival zones
            if ((x < leftArrivalX + arrivalZoneWidth && y > arrivalZoneY) ||
                (x > rightArrivalX - arrivalZoneWidth && y > arrivalZoneY)) {
                validPosition = false;
            }
            
            // Check if too close to other characters
            for (let i = 0; i < characters.length; i++) {
                const dx = x - characters[i].x;
                const dy = y - characters[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 70) {
                    validPosition = false;
                    break;
                }
            }
            
            attempts++;
        } while (!validPosition && attempts < 50);
        
        const char = new Character(type, name, x, y);
        characters.push(char);
    });
}

function spawnWaitingCharacter() {
    const now = Date.now();
    if (now - lastSpawnTime < MIN_SPAWN_INTERVAL) return;
    
    if (Math.random() < 0.01) {
        const type = Math.random() > 0.5 ? 'european' : 'moroccan';
        const names = type === 'european' ? europeanNames : moroccanNames;
        const name = names[Math.floor(Math.random() * names.length)];
        
        waitingCharacters[type].push({
            type: type,
            name: name,
            id: Date.now() + Math.random()
        });
        
        lastSpawnTime = now;
        updateWaitingDisplay();
    }
}

function updateWaitingDisplay() {
    const euroContainer = document.getElementById('waiting-european');
    const morocContainer = document.getElementById('waiting-moroccan');
    
    euroContainer.innerHTML = '';
    morocContainer.innerHTML = '';
    
    waitingCharacters.european.forEach((char, index) => {
        const el = document.createElement('div');
        el.className = 'waiting-character european';
        el.title = char.name;
        el.onclick = () => recruitCharacter('european', index);
        euroContainer.appendChild(el);
    });
    
    waitingCharacters.moroccan.forEach((char, index) => {
        const el = document.createElement('div');
        el.className = 'waiting-character moroccan';
        el.title = char.name;
        el.onclick = () => recruitCharacter('moroccan', index);
        morocContainer.appendChild(el);
    });
}

function recruitCharacter(type, index) {
    if (score < RECRUITMENT_COST) {
        showMessage('Not enough score!');
        return;
    }
    
    const charData = waitingCharacters[type][index];
    if (!charData) return;
    
    score -= RECRUITMENT_COST;
    updateScore();
    
    // Spawn at edge of field
    const x = type === 'european' ? 50 : canvas.width - 50;
    const y = canvas.height / 2 + 50;
    
    const names = type === 'european' ? europeanNames : moroccanNames;
    const character = new Character(type, charData.name, x, y);
    characters.push(character);
    
    waitingCharacters[type].splice(index, 1);
    updateWaitingDisplay();
    
    playSound('recruit');
}

// Reward system
function checkRewards() {
    if (score >= 200) {
        const rewardCount = Math.floor(score / 200);
        for (let i = 0; i < rewardCount; i++) {
            giveReward();
            score -= 200;
        }
        updateScore();
        updateRewardPanel();
    }
}

function giveReward() {
    const reward = rewardTypes[Math.floor(Math.random() * rewardTypes.length)];
    
    if (!rewards[reward.name]) {
        rewards[reward.name] = 0;
    }
    rewards[reward.name]++;
    
    playSound('reward');
    updateRewardPanel();
}

function updateRewardPanel() {
    rewardPanel.innerHTML = '';
    
    Object.keys(rewards).forEach(name => {
        const reward = rewardTypes.find(r => r.name === name);
        const count = rewards[name];
        
        const div = document.createElement('div');
        div.className = 'reward-item';
        div.innerHTML = `
            <span class="reward-icon">${reward.icon}</span>
            <div class="reward-info">
                <div class="reward-name">${reward.name}</div>
            </div>
            <span class="reward-count">${count}</span>
        `;
        
        rewardPanel.appendChild(div);
    });
}

// Audio system
function initAudio() {
    if (audioContext) return;
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    updateVolume();
}

function updateVolume() {
    if (masterGain) {
        masterGain.gain.value = volumeSlider.value / 100;
    }
}

function playSound(type) {
    if (!audioContext || !gameRunning) return;
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(masterGain);
    
    switch(type) {
        case 'umbrellaOpen':
            osc.frequency.setValueAtTime(400, audioContext.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            osc.start();
            osc.stop(audioContext.currentTime + 0.1);
            break;
            
        case 'umbrellaClose':
            osc.frequency.setValueAtTime(800, audioContext.currentTime);
            osc.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            osc.start();
            osc.stop(audioContext.currentTime + 0.1);
            break;
            
        case 'reward':
            osc.type = 'square';
            osc.frequency.setValueAtTime(523, audioContext.currentTime);
            osc.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
            osc.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
            osc.frequency.setValueAtTime(1047, audioContext.currentTime + 0.3);
            gain.gain.setValueAtTime(0.2, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            osc.start();
            osc.stop(audioContext.currentTime + 0.4);
            break;
            
        case 'recruit':
            osc.frequency.setValueAtTime(300, audioContext.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.15);
            gain.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            osc.start();
            osc.stop(audioContext.currentTime + 0.15);
            break;
            
        case 'birds':
            // Bird chirping sounds - short pleasant chirps
            for (let i = 0; i < 3; i++) {
                const birdOsc = audioContext.createOscillator();
                const birdGain = audioContext.createGain();
                birdOsc.connect(birdGain);
                birdGain.connect(masterGain);

                birdOsc.type = 'sine';
                birdOsc.frequency.setValueAtTime(1000 + i * 200, audioContext.currentTime + i * 0.1);
                birdOsc.frequency.exponentialRampToValueAtTime(1500 + i * 200, audioContext.currentTime + i * 0.1 + 0.05);
                birdGain.gain.setValueAtTime(0.1, audioContext.currentTime + i * 0.1);
                birdGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.1 + 0.1);

                birdOsc.start(audioContext.currentTime + i * 0.1);
                birdOsc.stop(audioContext.currentTime + i * 0.1 + 0.15);
            }
            break;

        case 'ambientRain':
            // Soft rain noise using noise buffer
            const bufferSize = audioContext.sampleRate * 2;
            const rainBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const rainData = rainBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                rainData[i] = (Math.random() * 2 - 1) * 0.3;
            }

            const rainSource = audioContext.createBufferSource();
            rainSource.buffer = rainBuffer;
            rainSource.loop = true;

            const rainFilter = audioContext.createBiquadFilter();
            rainFilter.type = 'lowpass';
            rainFilter.frequency.value = 800;

            const rainGain = audioContext.createGain();
            rainGain.gain.value = 0.15;

            rainSource.connect(rainFilter);
            rainFilter.connect(rainGain);
            rainGain.connect(masterGain);
            rainSource.start();

            // Store reference to stop later
            if (window.currentAmbient) {
                window.currentAmbient.stop();
            }
            window.currentAmbient = rainSource;
            window.currentAmbientGain = rainGain;
            break;

        case 'ambientSun':
            // Stop any existing ambient
            if (window.currentAmbient) {
                window.currentAmbient.stop();
            }
            // No continuous sound for sun, just occasional birds
            break;
    }
}

// Start ambient weather sound
function startAmbientSound(type) {
    if (!audioContext || !gameRunning) return;

    // Stop any existing ambient
    if (window.currentAmbient) {
        window.currentAmbient.stop();
        window.currentAmbient = null;
        window.currentAmbientGain = null;
    }

    if (type === 'rain') {
        playSound('ambientRain');
    } else if (type === 'sun') {
        playSound('ambientSun');
    }
}

// Stop ambient weather sound
function stopAmbientSound() {
    if (window.currentAmbient) {
        window.currentAmbient.stop();
        window.currentAmbient = null;
    }
    if (window.currentAmbientGain) {
        window.currentAmbientGain = null;
    }
}

// Show message
function showMessage(text) {
    messageOverlay.textContent = text;
    messageOverlay.style.display = 'block';
    
    setTimeout(() => {
        messageOverlay.style.display = 'none';
    }, 2000);
}

// Update score display
function updateScore() {
    scoreElement.textContent = Math.floor(score);
}

// Main game loop
function gameLoop(timestamp) {
    if (!gameRunning) return;
    
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw field
    drawField();
    
    // Draw weather
    drawWeather();
    
    // Update and draw characters
    const fieldRect = { x: 0, y: 0, width: canvas.width, height: canvas.height };
    
    characters.forEach(char => {
        char.update(dt, fieldRect);
        char.draw(ctx);
    });
    
    // HP update once per second
    hpUpdateAccumulator += dt;
    if (hpUpdateAccumulator >= 1) {
        characters.forEach(char => {
            char.applyHpUpdate(1);
        });
        hpUpdateAccumulator = 0;
    }
    
    // Check collisions
    checkCollisions();
    
    // Remove dead characters
    for (let i = characters.length - 1; i >= 0; i--) {
        if (characters[i].hp <= 0) {
            showMessage('Emigrated to Argentina');
            characters.splice(i, 1);
        }
    }
    
    // Score from working characters
    characters.forEach(char => {
        if (char.isWorking && !char.isFrozen && !char.isSmoking) {
            if (weather === 'sun' || (char.hasUmbrella && char.type === 'european')) {
                score += WORK_SCORE_RATE * dt;
            }
        }
    });
    
    updateScore();
    checkRewards();
    spawnWaitingCharacter();
    
    requestAnimationFrame(gameLoop);
}

// Canvas resize
function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}

// Initialize game
function startGame() {
    initAudio();
    
    gameRunning = true;
    score = 0;
    characters = [];
    waitingCharacters = { european: [], moroccan: [] };
    rewards = {};
    weather = 'sun';
    clouds = [];
    rainDrops = [];
    birds = [];
    lastSpawnTime = Date.now();
    hpUpdateAccumulator = 0;
    
    updateScore();
    rewardPanel.innerHTML = '';
    updateWaitingDisplay();
    
    startBtn.disabled = true;
    endBtn.disabled = false;
    
    resizeCanvas();
    changeWeather();
    
    // Spawn 3 initial characters (at least 1 European and 1 Moroccan)
    spawnInitialCharacters();
    
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameRunning = false;
    clearTimeout(weatherTimer);
    stopAmbientSound();
    
    startBtn.disabled = false;
    endBtn.disabled = true;
    
    showMessage('Game Over! Final Score: ' + Math.floor(score));
}

// Event listeners
startBtn.addEventListener('click', startGame);
endBtn.addEventListener('click', endGame);
volumeSlider.addEventListener('input', updateVolume);

canvas.addEventListener('click', (e) => {
    if (!gameRunning) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    characters.forEach(char => {
        const dx = clickX - char.x;
        const dy = clickY - char.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 40) {
            char.toggleUmbrella();
        }
    });
});

window.addEventListener('resize', resizeCanvas);

// Initial setup
resizeCanvas();

// Show a test reward immediately on load to verify the reward panel is visible
const testReward = rewardTypes[0];
rewards[testReward.name] = 1;
updateRewardPanel();
