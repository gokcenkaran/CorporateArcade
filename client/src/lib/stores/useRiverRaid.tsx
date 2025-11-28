import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type GamePhase = "menu" | "playing" | "paused" | "gameover";

export interface Bullet {
  id: string;
  x: number;
  y: number;
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  type: "helicopter" | "jet" | "ship" | "fuel";
  speed: number;
  direction: number;
}

interface RiverRaidState {
  phase: GamePhase;
  score: number;
  lives: number;
  playerX: number;
  fuel: number;
  bullets: Bullet[];
  enemies: Enemy[];
  riverOffset: number;
  username: string;
  
  // Actions
  setUsername: (name: string) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  gameOver: () => void;
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
}

let bulletIdCounter = 0;
let enemyIdCounter = 0;

export const useRiverRaid = create<RiverRaidState>()(
  subscribeWithSelector((set, get) => ({
    phase: "menu",
    score: 0,
    lives: 3,
    playerX: 400,
    fuel: 100,
    bullets: [],
    enemies: [],
    riverOffset: 0,
    username: "Player",
    
    setUsername: (name: string) => set({ username: name }),
    
    startGame: () => {
      bulletIdCounter = 0;
      enemyIdCounter = 0;
      set({
        phase: "playing",
        score: 0,
        lives: 3,
        playerX: 400,
        fuel: 100,
        bullets: [],
        enemies: [],
        riverOffset: 0,
      });
    },
    
    pauseGame: () => set({ phase: "paused" }),
    
    resumeGame: () => set({ phase: "playing" }),
    
    restartGame: () => {
      bulletIdCounter = 0;
      enemyIdCounter = 0;
      set({
        phase: "menu",
        score: 0,
        lives: 3,
        playerX: 400,
        fuel: 100,
        bullets: [],
        enemies: [],
        riverOffset: 0,
      });
    },
    
    gameOver: () => set({ phase: "gameover" }),
    
    movePlayer: (direction: "left" | "right") => {
      const { playerX } = get();
      const speed = 8;
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
      const { lives } = get();
      if (lives <= 1) {
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
      const { enemies, riverOffset } = get();
      const updatedEnemies = enemies
        .map((enemy) => ({
          ...enemy,
          y: enemy.y + enemy.speed,
          x: enemy.x + enemy.direction * 2,
        }))
        .filter((enemy) => enemy.y < 700);
      set({ enemies: updatedEnemies });
    },
    
    removeEnemy: (id: string) => {
      set((state) => ({
        enemies: state.enemies.filter((e) => e.id !== id),
      }));
    },
    
    updateRiverOffset: () => {
      set((state) => ({ riverOffset: (state.riverOffset + 3) % 100 }));
    },
    
    setPlayerX: (x: number) => set({ playerX: x }),
  }))
);

export function generateEnemyId(): string {
  return `enemy-${enemyIdCounter++}`;
}
