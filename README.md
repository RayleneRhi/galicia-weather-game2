# galicia-weather-game2
Environment for Galicia weather game prototype. v2

# Galicia Farm Chaos 🌧️☀️

A humorous Galicia-themed real-time management game where you manage migrant workers from Eastern Europe and Morocco on a chaotic farm in Galicia, Spain.

## How to Run Locally

1. **Clone or download** this repository
2. **Open `index.html`** in any modern web browser (Chrome, Firefox, Safari, Edge)
3. Click **\"Start Game\"** to begin playing

No installation or server required - it runs directly in your browser!

## Main Mechanics

### Objective
Manage your workers to maximize score while keeping them alive through changing weather conditions. A skilled player can maintain 6-7 active workers without extreme effort.

### Weather System
Weather changes suddenly between **Rain** and **Sun**:
- **Rain**: Clouds move across the top of the screen with visible rain falling
- **Sun**: Warm sun rays from above with birds flying around

No timers or progress bars - weather changes are unpredictable!

### Characters

Two groups with different traits:

**European Workers** (Blue) - Galicia, Poland, Hungary, Ukraine, Russia, Finland names
- Handle rain better
- Can work efficiently with umbrella during rain
- Slightly penalized by using umbrella in sun

**Moroccan Workers** (Orange) - Moroccan/North African names  
- Thrive in sunny weather
- Freeze in place when using umbrella in rain (can't work)
- Occasionally stop to smoke in the sun (rare, costs small HP)

### Umbrella Management
- **Click on characters** to toggle their umbrellas
- Umbrellas protect from rain but have trade-offs
- Europeans can work under umbrella in rain
- Moroccans freeze when using umbrella in rain

### Work Zone
- **Lower half** of the field is the agricultural zone with green hills
- Characters automatically start **digging/working** when they enter this zone
- Working generates **+2 points per second**
- Characters wandering outside the work zone generate no points

### Health System
- Each character has an HP bar above their head
- HP changes based on weather, umbrella status, and group type
- When HP reaches **zero**, the character **\"Emigrates to Argentina\"**
- Neglected characters will eventually disappear

### Recruitment
- New workers arrive at the bottom corners:
  - **Left (🚂)**: Eastern European arrivals by train
  - **Right (⛵)**: Moroccan arrivals by boat
- Click waiting workers to recruit them
- **Cost: 50 points** per recruitment

### Rewards
Every **200 points**, earn a random Galicia-themed reward:
- 🐙 Octopus
- 🦑 Squid
- 🥬 Grelos (Galician cabbage)
- 🥔 Potatoes
- 🦪 Mussels
- 🐚 Navajas (razor clams)
- 🍶 Cider

Rewards appear in the side panel and stack with counters.

### Controls
- **Start Game**: Begin playing
- **End Game**: Stop current session
- **Volume Slider**: Adjust sound effects volume
- **Click characters**: Toggle umbrellas
- **Click waiting workers**: Recruit new workers

### Tips for Success
1. Watch the weather closely and react quickly
2. Keep Europeans working in rain with umbrellas open
3. Let Moroccans work in sun without umbrellas
4. Balance your workforce between both groups
5. Recruit strategically - don't grow too fast
6. Aim to keep 6-7 workers alive and productive

Enjoy the chaos of Galician farming! 🌾
