import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type GamePhase = "menu" | "playing" | "paused" | "gameover";

export interface Bullet {
  id: string;
  x: number;
  y: number;
}

export type EnemyType = "helicopter" | "jet" | "ship" | "fuel";
export type PowerUpType = "speed" | "rapidfire" | "shield";

export interface Enemy {
  id: string;
  x: number;
  y: number;
  type: EnemyType;
  speed: number;
  direction: number;
  shootCooldown?: number;
}

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: PowerUpType;
  speed: number;
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  frame: number;
  maxFrames: number;
}

interface RiverRaidState {
  phase: GamePhase;
  score: number;
  highScore: number;
  lives: number;
  playerX: number;
  fuel: number;
  bullets: Bullet[];
  enemies: Enemy[];
  powerUps: PowerUp[];
  explosions: Explosion[];
  riverOffset: number;
  username: string;
  difficulty: number;
  activePowerUps: { type: PowerUpType; endTime: number }[];
  soundEnabled: boolean;
  playTime: number;
  gameStartTime: number | null;
  enemiesDestroyed: number;
  
  // Actions
  setUsername: (name: string) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  gameOver: () => void;
  startTimer: () => void;
  stopTimer: () => void;
  incrementEnemiesDestroyed: () => void;
  movePlayer: (direction: "left" | "right") => void;
  shoot: () => void;
  addScore: (points: number) => void;
  loseLife: () => void;
  addFuel: (amount: number) => void;
  consumeFuel: () => void;
  updateBullets: () => void;
  removeBullet: (id: string) => void;
  addEnemy: (enemy: Enemy) => void;
  updateEnemies: () => void;
  removeEnemy: (id: string) => void;
  updateRiverOffset: () => void;
  setPlayerX: (x: number) => void;
  addPowerUp: (powerUp: PowerUp) => void;
  removePowerUp: (id: string) => void;
  updatePowerUps: () => void;
  activatePowerUp: (type: PowerUpType, duration: number) => void;
  updateActivePowerUps: () => void;
  hasPowerUp: (type: PowerUpType) => boolean;
  addExplosion: (x: number, y: number) => void;
  updateExplosions: () => void;
  increaseDifficulty: () => void;
  toggleSound: () => void;
  setHighScore: (score: number) => void;
}

let bulletIdCounter = 0;
let enemyIdCounter = 0;
let powerUpIdCounter = 0;
let explosionIdCounter = 0;

export const useRiverRaid = create<RiverRaidState>()(
  subscribeWithSelector((set, get) => ({
    phase: "menu",
    score: 0,
    highScore: 0,
    lives: 3,
    playerX: 400,
    fuel: 100,
    bullets: [],
    enemies: [],
    powerUps: [],
    explosions: [],
    riverOffset: 0,
    username: "Player",
    difficulty: 1,
    activePowerUps: [],
    soundEnabled: true,
    playTime: 0,
    gameStartTime: null,
    enemiesDestroyed: 0,
    
    setUsername: (name: string) => set({ username: name }),
    
    startGame: () => {
      bulletIdCounter = 0;
      enemyIdCounter = 0;
      powerUpIdCounter = 0;
      explosionIdCounter = 0;
      set({
        phase: "playing",
        score: 0,
        lives: 3,
        playerX: 400,
        fuel: 100,
        bullets: [],
        enemies: [],
        powerUps: [],
        explosions: [],
        riverOffset: 0,
        difficulty: 1,
        activePowerUps: [],
        playTime: 0,
        gameStartTime: Date.now(),
        enemiesDestroyed: 0,
      });
    },
    
    pauseGame: () => set({ phase: "paused" }),
    
    resumeGame: () => set({ phase: "playing" }),
    
    restartGame: () => {
      bulletIdCounter = 0;
      enemyIdCounter = 0;
      powerUpIdCounter = 0;
      explosionIdCounter = 0;
      set({
        phase: "menu",
        score: 0,
        lives: 3,
        playerX: 400,
        fuel: 100,
        bullets: [],
        enemies: [],
        powerUps: [],
        explosions: [],
        riverOffset: 0,
        difficulty: 1,
        activePowerUps: [],
        playTime: 0,
        gameStartTime: null,
        enemiesDestroyed: 0,
      });
    },
    
    gameOver: () => {
      const { score, highScore } = get();
      if (score > highScore) {
        set({ highScore: score });
      }
      set({ phase: "gameover" });
    },
    
    movePlayer: (direction: "left" | "right") => {
      const { playerX, activePowerUps } = get();
      const hasSpeedBoost = activePowerUps.some(p => p.type === "speed" && p.endTime > Date.now());
      const speed = hasSpeedBoost ? 12 : 8;
      const minX = 180;
      const maxX = 620;
      
      if (direction === "left") {
        set({ playerX: Math.max(minX, playerX - speed) });
      } else {
        set({ playerX: Math.min(maxX, playerX + speed) });
      }
    },
    
    shoot: () => {
      const { playerX, bullets } = get();
      const newBullet: Bullet = {
        id: `bullet-${bulletIdCounter++}`,
        x: playerX,
        y: 500,
      };
      set({ bullets: [...bullets, newBullet] });
    },
    
    addScore: (points: number) => set((state) => ({ score: state.score + points })),
    
    loseLife: () => {
      const { lives, activePowerUps } = get();
      
      // Check for shield power-up
      const hasShield = activePowerUps.some(p => p.type === "shield" && p.endTime > Date.now());
      if (hasShield) {
        // Shield protects player, remove the shield
        set({
          activePowerUps: activePowerUps.filter(p => p.type !== "shield"),
        });
        return;
      }
      
      if (lives <= 1) {
        const { score, highScore } = get();
        if (score > highScore) {
          set({ highScore: score });
        }
        set({ lives: 0, phase: "gameover" });
      } else {
        set({ 
          lives: lives - 1,
          playerX: 400,
          fuel: 100,
        });
      }
    },
    
    addFuel: (amount: number) => set((state) => ({ 
      fuel: Math.min(100, state.fuel + amount) 
    })),
    
    consumeFuel: () => {
      const { fuel } = get();
      if (fuel <= 0) {
        get().loseLife();
      } else {
        set({ fuel: Math.max(0, fuel - 0.05) });
      }
    },
    
    updateBullets: () => {
      const { bullets } = get();
      const updatedBullets = bullets
        .map((bullet) => ({ ...bullet, y: bullet.y - 15 }))
        .filter((bullet) => bullet.y > 0);
      set({ bullets: updatedBullets });
    },
    
    removeBullet: (id: string) => {
      set((state) => ({
        bullets: state.bullets.filter((b) => b.id !== id),
      }));
    },
    
    addEnemy: (enemy: Enemy) => {
      set((state) => ({ enemies: [...state.enemies, enemy] }));
    },
    
    updateEnemies: () => {
      const { enemies, difficulty } = get();
      const updatedEnemies = enemies
        .map((enemy) => {
          let newX = enemy.x;
          let newY = enemy.y + enemy.speed;
          let newDirection = enemy.direction;
          
          // Different behavior based on enemy type
          if (enemy.type === "helicopter") {
            // Helicopters move side to side more aggressively
            newX = enemy.x + enemy.direction * 3 * difficulty;
            if (newX < 180 || newX > 620) {
              newDirection = -enemy.direction;
              newX = Math.max(180, Math.min(620, newX));
            }
          } else if (enemy.type === "jet") {
            // Jets dive faster
            newY = enemy.y + enemy.speed * 1.5;
          } else if (enemy.type === "ship") {
            // Ships move slowly side to side
            newX = enemy.x + enemy.direction * 1;
            if (newX < 180 || newX > 620) {
              newDirection = -enemy.direction;
              newX = Math.max(180, Math.min(620, newX));
            }
          } else if (enemy.type === "fuel") {
            // Fuel depots move slowly down
            newY = enemy.y + 1.5;
          }
          
          return {
            ...enemy,
            x: newX,
            y: newY,
            direction: newDirection,
          };
        })
        .filter((enemy) => enemy.y < 700);
      set({ enemies: updatedEnemies });
    },
    
    removeEnemy: (id: string) => {
      set((state) => ({
        enemies: state.enemies.filter((e) => e.id !== id),
        enemiesDestroyed: state.enemiesDestroyed + 1,
      }));
    },
    
    updateRiverOffset: () => {
      set((state) => ({ riverOffset: (state.riverOffset + 3) % 100 }));
    },
    
    setPlayerX: (x: number) => set({ playerX: x }),
    
    addPowerUp: (powerUp: PowerUp) => {
      set((state) => ({ powerUps: [...state.powerUps, powerUp] }));
    },
    
    removePowerUp: (id: string) => {
      set((state) => ({
        powerUps: state.powerUps.filter((p) => p.id !== id),
      }));
    },
    
    updatePowerUps: () => {
      const { powerUps } = get();
      const updatedPowerUps = powerUps
        .map((powerUp) => ({ ...powerUp, y: powerUp.y + powerUp.speed }))
        .filter((powerUp) => powerUp.y < 700);
      set({ powerUps: updatedPowerUps });
    },
    
    activatePowerUp: (type: PowerUpType, duration: number) => {
      const { activePowerUps } = get();
      const endTime = Date.now() + duration;
      const existing = activePowerUps.find(p => p.type === type);
      
      if (existing) {
        // Extend duration
        set({
          activePowerUps: activePowerUps.map(p => 
            p.type === type ? { ...p, endTime: Math.max(p.endTime, endTime) } : p
          ),
        });
      } else {
        set({
          activePowerUps: [...activePowerUps, { type, endTime }],
        });
      }
    },
    
    updateActivePowerUps: () => {
      const { activePowerUps } = get();
      const now = Date.now();
      set({
        activePowerUps: activePowerUps.filter(p => p.endTime > now),
      });
    },
    
    hasPowerUp: (type: PowerUpType) => {
      const { activePowerUps } = get();
      return activePowerUps.some(p => p.type === type && p.endTime > Date.now());
    },
    
    addExplosion: (x: number, y: number) => {
      const explosion: Explosion = {
        id: `explosion-${explosionIdCounter++}`,
        x,
        y,
        frame: 0,
        maxFrames: 12,
      };
      set((state) => ({ explosions: [...state.explosions, explosion] }));
    },
    
    updateExplosions: () => {
      const { explosions } = get();
      const updatedExplosions = explosions
        .map((exp) => ({ ...exp, frame: exp.frame + 1 }))
        .filter((exp) => exp.frame < exp.maxFrames);
      set({ explosions: updatedExplosions });
    },
    
    increaseDifficulty: () => {
      set((state) => ({ difficulty: Math.min(3, state.difficulty + 0.1) }));
    },
    
    toggleSound: () => {
      set((state) => ({ soundEnabled: !state.soundEnabled }));
    },
    
    setHighScore: (score: number) => set({ highScore: score }),
    
    startTimer: () => {
      set({ gameStartTime: Date.now() });
    },
    
    stopTimer: () => {
      const { gameStartTime } = get();
      if (gameStartTime) {
        const elapsed = Math.round((Date.now() - gameStartTime) / 1000);
        set({ playTime: elapsed, gameStartTime: null });
      }
    },
    
    incrementEnemiesDestroyed: () => {
      set((state) => ({ enemiesDestroyed: state.enemiesDestroyed + 1 }));
    },
  }))
);

export function generateEnemyId(): string {
  return `enemy-${enemyIdCounter++}`;
}

export function generatePowerUpId(): string {
  return `powerup-${powerUpIdCounter++}`;
}
