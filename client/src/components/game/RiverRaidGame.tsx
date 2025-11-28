import { useEffect, useRef, useCallback, useMemo } from "react";
import { useRiverRaid, generateEnemyId, generatePowerUpId, type Enemy, type PowerUp, type PowerUpType } from "@/lib/stores/useRiverRaid";
import { soundManager } from "@/lib/sounds/SoundManager";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const RIVER_LEFT = 150;
const RIVER_RIGHT = 650;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 50;

export function RiverRaidGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const lastSpawnRef = useRef<number>(0);
  const lastPowerUpSpawnRef = useRef<number>(0);
  const difficultyTimerRef = useRef<number>(0);
  const keysPressed = useRef<Set<string>>(new Set());
  const soundInitializedRef = useRef<boolean>(false);
  
  const {
    phase,
    score,
    highScore,
    lives,
    fuel,
    playerX,
    bullets,
    enemies,
    powerUps,
    explosions,
    riverOffset,
    username,
    difficulty,
    activePowerUps,
    soundEnabled,
    movePlayer,
    shoot,
    updateBullets,
    updateEnemies,
    updatePowerUps,
    updateRiverOffset,
    addEnemy,
    removeEnemy,
    removeBullet,
    addScore,
    loseLife,
    addFuel,
    consumeFuel,
    startGame,
    restartGame,
    addPowerUp,
    removePowerUp,
    activatePowerUp,
    updateActivePowerUps,
    hasPowerUp,
    addExplosion,
    updateExplosions,
    increaseDifficulty,
  } = useRiverRaid();

  const lastShootRef = useRef<number>(0);

  // Pre-calculate river path segments for performance
  const riverPath = useMemo(() => {
    const segments = [];
    for (let y = 0; y < CANVAS_HEIGHT + 100; y += 50) {
      const wobble = Math.sin((y + riverOffset * 10) * 0.02) * 30;
      segments.push({
        y,
        leftEdge: RIVER_LEFT + wobble,
        rightEdge: RIVER_RIGHT + wobble,
      });
    }
    return segments;
  }, [riverOffset]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
      
      // Initialize sound on first user interaction
      if (!soundInitializedRef.current) {
        soundManager.initialize();
        soundInitializedRef.current = true;
      }
      
      if (e.code === "Space") {
        e.preventDefault();
        if (phase === "menu" || phase === "gameover") {
          if (phase === "gameover") {
            restartGame();
          }
          // Reset all timers
          lastSpawnRef.current = 0;
          lastPowerUpSpawnRef.current = 0;
          difficultyTimerRef.current = 0;
          startGame();
          if (soundEnabled) {
            soundManager.startBackgroundMusic();
          }
        } else if (phase === "playing") {
          const hasRapidFire = hasPowerUp("rapidfire");
          const cooldown = hasRapidFire ? 80 : 150;
          const now = Date.now();
          if (now - lastShootRef.current > cooldown) {
            shoot();
            if (soundEnabled) {
              soundManager.playShoot();
            }
            lastShootRef.current = now;
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [phase, shoot, startGame, restartGame, soundEnabled, hasPowerUp]);

  // Stop music on game over
  useEffect(() => {
    if (phase === "gameover") {
      soundManager.stopBackgroundMusic();
      if (soundEnabled) {
        soundManager.playGameOver();
      }
    }
  }, [phase, soundEnabled]);

  // Spawn enemies with progressive difficulty
  const spawnEnemy = useCallback(() => {
    const types: Array<"helicopter" | "jet" | "ship" | "fuel"> = ["helicopter", "jet", "ship", "fuel"];
    const weights = [0.3, 0.25, 0.25, 0.2]; // Weighted random
    
    let rand = Math.random();
    let type: "helicopter" | "jet" | "ship" | "fuel" = "helicopter";
    for (let i = 0; i < weights.length; i++) {
      if (rand < weights[i]) {
        type = types[i];
        break;
      }
      rand -= weights[i];
    }
    
    const baseSpeed = type === "fuel" ? 2 : 2 + Math.random() * 2;
    const speedMultiplier = 1 + (difficulty - 1) * 0.3;
    
    const enemy: Enemy = {
      id: generateEnemyId(),
      x: RIVER_LEFT + 50 + Math.random() * (RIVER_RIGHT - RIVER_LEFT - 100),
      y: -50,
      type,
      speed: baseSpeed * speedMultiplier,
      direction: Math.random() > 0.5 ? 1 : -1,
      shootCooldown: type === "ship" ? 2000 : undefined,
    };
    
    addEnemy(enemy);
  }, [addEnemy, difficulty]);

  // Spawn power-ups
  const spawnPowerUp = useCallback(() => {
    const types: PowerUpType[] = ["speed", "rapidfire", "shield"];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const powerUp: PowerUp = {
      id: generatePowerUpId(),
      x: RIVER_LEFT + 50 + Math.random() * (RIVER_RIGHT - RIVER_LEFT - 100),
      y: -30,
      type,
      speed: 2,
    };
    
    addPowerUp(powerUp);
  }, [addPowerUp]);

  // Check collisions
  const checkCollisions = useCallback(() => {
    const playerBounds = {
      left: playerX - PLAYER_WIDTH / 2,
      right: playerX + PLAYER_WIDTH / 2,
      top: 500 - PLAYER_HEIGHT / 2,
      bottom: 500 + PLAYER_HEIGHT / 2,
    };

    // Check river boundary collision
    const currentSegment = riverPath.find(seg => seg.y >= 490 && seg.y <= 510);
    if (currentSegment) {
      if (playerBounds.left < currentSegment.leftEdge + 20 || 
          playerBounds.right > currentSegment.rightEdge - 20) {
        addExplosion(playerX, 500);
        if (soundEnabled) {
          soundManager.playExplosion();
        }
        loseLife();
        return;
      }
    }

    // Check bullet-enemy collisions
    bullets.forEach((bullet) => {
      enemies.forEach((enemy) => {
        const enemySize = enemy.type === "fuel" ? 30 : 35;
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < enemySize) {
          removeBullet(bullet.id);
          removeEnemy(enemy.id);
          addExplosion(enemy.x, enemy.y);
          
          if (soundEnabled) {
            if (enemy.type === "fuel") {
              soundManager.playFuelPickup();
            } else {
              soundManager.playHit();
            }
          }
          
          if (enemy.type === "fuel") {
            addFuel(30);
            addScore(50);
          } else {
            const points = enemy.type === "jet" ? 150 : enemy.type === "helicopter" ? 120 : 100;
            addScore(points);
          }
        }
      });
    });

    // Check player-enemy collisions
    enemies.forEach((enemy) => {
      const enemySize = enemy.type === "fuel" ? 25 : 30;
      const dx = playerX - enemy.x;
      const dy = 500 - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < enemySize + PLAYER_WIDTH / 2) {
        if (enemy.type === "fuel") {
          removeEnemy(enemy.id);
          addFuel(30);
          addScore(50);
          if (soundEnabled) {
            soundManager.playFuelPickup();
          }
        } else {
          removeEnemy(enemy.id);
          addExplosion(playerX, 500);
          addExplosion(enemy.x, enemy.y);
          if (soundEnabled) {
            soundManager.playExplosion();
          }
          loseLife();
        }
      }
    });

    // Check player-powerup collisions
    powerUps.forEach((powerUp) => {
      const dx = playerX - powerUp.x;
      const dy = 500 - powerUp.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 30 + PLAYER_WIDTH / 2) {
        removePowerUp(powerUp.id);
        activatePowerUp(powerUp.type, 8000); // 8 seconds duration
        addScore(25);
        if (soundEnabled) {
          soundManager.playPowerup();
        }
      }
    });
  }, [playerX, bullets, enemies, powerUps, riverPath, loseLife, removeBullet, removeEnemy, removePowerUp, addScore, addFuel, addExplosion, activatePowerUp, soundEnabled]);

  // Draw explosion effect
  const drawExplosion = (ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, maxFrames: number) => {
    const progress = frame / maxFrames;
    const radius = 15 + progress * 25;
    const alpha = 1 - progress;
    
    // Outer glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255, 255, 0, ${alpha})`);
    gradient.addColorStop(0.4, `rgba(255, 150, 0, ${alpha * 0.8})`);
    gradient.addColorStop(0.7, `rgba(255, 50, 0, ${alpha * 0.5})`);
    gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner core
    if (frame < maxFrames / 2) {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Draw power-up
  const drawPowerUp = (ctx: CanvasRenderingContext2D, powerUp: PowerUp) => {
    const { x, y, type } = powerUp;
    const pulse = Math.sin(Date.now() * 0.01) * 3;
    
    // Draw outer glow
    ctx.shadowColor = type === "speed" ? "#00FF00" : type === "rapidfire" ? "#FF0000" : "#00FFFF";
    ctx.shadowBlur = 10 + pulse;
    
    ctx.fillStyle = type === "speed" ? "#00FF00" : type === "rapidfire" ? "#FF0000" : "#00FFFF";
    ctx.beginPath();
    ctx.arc(x, y, 15 + pulse / 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    
    // Draw icon
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    if (type === "speed") {
      ctx.fillText("S", x, y);
    } else if (type === "rapidfire") {
      ctx.fillText("R", x, y);
    } else {
      ctx.fillText("!", x, y);
    }
  };

  // Draw active power-up indicators
  const drawActivePowerUps = (ctx: CanvasRenderingContext2D) => {
    const now = Date.now();
    let yOffset = 100;
    
    activePowerUps.forEach((powerUp) => {
      const remaining = Math.max(0, (powerUp.endTime - now) / 1000);
      if (remaining <= 0) return;
      
      const color = powerUp.type === "speed" ? "#00FF00" : powerUp.type === "rapidfire" ? "#FF0000" : "#00FFFF";
      const label = powerUp.type === "speed" ? "HIZLI" : powerUp.type === "rapidfire" ? "ATEŞ" : "KALKAN";
      
      // Draw background
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(10, yOffset, 80, 25);
      
      // Draw progress bar
      ctx.fillStyle = color;
      ctx.fillRect(10, yOffset, 80 * (remaining / 8), 25);
      
      // Draw border
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(10, yOffset, 80, 25);
      
      // Draw text
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(label, 50, yOffset + 16);
      
      yOffset += 30;
    });
  };

  // Draw game
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    // Clear canvas
    ctx.fillStyle = "#228B22";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw river
    ctx.fillStyle = "#1E90FF";
    ctx.beginPath();
    ctx.moveTo(riverPath[0]?.leftEdge || RIVER_LEFT, 0);
    
    riverPath.forEach((seg) => {
      ctx.lineTo(seg.leftEdge, seg.y);
    });
    
    ctx.lineTo(riverPath[riverPath.length - 1]?.leftEdge || RIVER_LEFT, CANVAS_HEIGHT);
    ctx.lineTo(riverPath[riverPath.length - 1]?.rightEdge || RIVER_RIGHT, CANVAS_HEIGHT);
    
    for (let i = riverPath.length - 1; i >= 0; i--) {
      ctx.lineTo(riverPath[i].rightEdge, riverPath[i].y);
    }
    
    ctx.closePath();
    ctx.fill();

    // Draw river road/bridge markings
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    for (let y = (riverOffset * 10) % 80; y < CANVAS_HEIGHT; y += 80) {
      const seg = riverPath.find(s => s.y >= y - 25 && s.y <= y + 25);
      if (seg) {
        ctx.beginPath();
        ctx.moveTo(seg.leftEdge - 30, y);
        ctx.lineTo(seg.leftEdge - 10, y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(seg.rightEdge + 10, y);
        ctx.lineTo(seg.rightEdge + 30, y);
        ctx.stroke();
      }
    }

    // Draw bullets
    ctx.fillStyle = "#FFFF00";
    bullets.forEach((bullet) => {
      ctx.beginPath();
      ctx.ellipse(bullet.x, bullet.y, 3, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw power-ups
    powerUps.forEach((powerUp) => {
      drawPowerUp(ctx, powerUp);
    });

    // Draw enemies
    enemies.forEach((enemy) => {
      if (enemy.type === "fuel") {
        // Draw fuel depot
        ctx.fillStyle = "#FF69B4";
        ctx.fillRect(enemy.x - 15, enemy.y - 20, 30, 40);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("F", enemy.x, enemy.y - 5);
        ctx.fillText("U", enemy.x, enemy.y + 5);
        ctx.fillText("E", enemy.x, enemy.y + 15);
        ctx.fillText("L", enemy.x, enemy.y + 25);
      } else if (enemy.type === "helicopter") {
        // Draw helicopter with rotating blade
        const bladeAngle = (Date.now() / 50) % 360;
        ctx.fillStyle = "#00FF00";
        ctx.fillRect(enemy.x - 20, enemy.y - 10, 40, 20);
        
        // Rotor blade
        ctx.save();
        ctx.translate(enemy.x, enemy.y - 8);
        ctx.rotate(bladeAngle * Math.PI / 180);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(-25, -2, 50, 4);
        ctx.restore();
        
        ctx.fillStyle = "#000000";
        ctx.fillRect(enemy.x - 5, enemy.y - 5, 10, 10);
      } else if (enemy.type === "jet") {
        // Draw enemy jet
        ctx.fillStyle = "#0000FF";
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y - 20);
        ctx.lineTo(enemy.x - 15, enemy.y + 15);
        ctx.lineTo(enemy.x, enemy.y + 5);
        ctx.lineTo(enemy.x + 15, enemy.y + 15);
        ctx.closePath();
        ctx.fill();
        
        // Jet exhaust
        ctx.fillStyle = "#FFA500";
        ctx.beginPath();
        ctx.moveTo(enemy.x - 3, enemy.y + 15);
        ctx.lineTo(enemy.x, enemy.y + 25);
        ctx.lineTo(enemy.x + 3, enemy.y + 15);
        ctx.closePath();
        ctx.fill();
      } else if (enemy.type === "ship") {
        // Draw ship
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(enemy.x - 25, enemy.y - 8, 50, 16);
        ctx.fillStyle = "#A0522D";
        ctx.fillRect(enemy.x - 5, enemy.y - 18, 10, 10);
        
        // Ship turret
        ctx.fillStyle = "#333333";
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y - 4, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw explosions
    explosions.forEach((explosion) => {
      drawExplosion(ctx, explosion.x, explosion.y, explosion.frame, explosion.maxFrames);
    });

    // Draw player jet with shield glow if active
    const hasShield = activePowerUps.some(p => p.type === "shield" && p.endTime > Date.now());
    
    if (hasShield) {
      // Draw shield bubble
      const pulseSize = Math.sin(Date.now() * 0.01) * 5;
      ctx.strokeStyle = "rgba(0, 255, 255, 0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(playerX, 500, PLAYER_WIDTH + 10 + pulseSize, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = "rgba(0, 255, 255, 0.2)";
      ctx.beginPath();
      ctx.arc(playerX, 500, PLAYER_WIDTH + 10 + pulseSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.moveTo(playerX, 500 - PLAYER_HEIGHT / 2);
    ctx.lineTo(playerX - PLAYER_WIDTH / 2, 500 + PLAYER_HEIGHT / 2);
    ctx.lineTo(playerX - 5, 500 + 10);
    ctx.lineTo(playerX, 500 + PLAYER_HEIGHT / 2 + 10);
    ctx.lineTo(playerX + 5, 500 + 10);
    ctx.lineTo(playerX + PLAYER_WIDTH / 2, 500 + PLAYER_HEIGHT / 2);
    ctx.closePath();
    ctx.fill();

    // Draw jet details
    ctx.fillStyle = "#FFA500";
    ctx.beginPath();
    ctx.moveTo(playerX, 500 - PLAYER_HEIGHT / 2 + 15);
    ctx.lineTo(playerX - 8, 500 + 5);
    ctx.lineTo(playerX + 8, 500 + 5);
    ctx.closePath();
    ctx.fill();

    // Draw jet engine flames
    const flameHeight = 10 + Math.random() * 5;
    ctx.fillStyle = "#FF4500";
    ctx.beginPath();
    ctx.moveTo(playerX - 3, 500 + PLAYER_HEIGHT / 2 + 10);
    ctx.lineTo(playerX, 500 + PLAYER_HEIGHT / 2 + 10 + flameHeight);
    ctx.lineTo(playerX + 3, 500 + PLAYER_HEIGHT / 2 + 10);
    ctx.closePath();
    ctx.fill();

    // Draw active power-up indicators
    drawActivePowerUps(ctx);

    // Draw difficulty indicator
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(CANVAS_WIDTH - 100, 60, 90, 25);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`LVL: ${difficulty.toFixed(1)}`, CANVAS_WIDTH - 55, 77);
  }, [riverPath, bullets, enemies, powerUps, explosions, playerX, activePowerUps, riverOffset, difficulty]);

  // Game loop
  useEffect(() => {
    if (phase !== "playing") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize timers on game start
    if (difficultyTimerRef.current === 0) {
      difficultyTimerRef.current = performance.now();
    }
    if (lastPowerUpSpawnRef.current === 0) {
      lastPowerUpSpawnRef.current = performance.now();
    }

    const gameLoop = (timestamp: number) => {
      // Handle continuous key presses
      if (keysPressed.current.has("ArrowLeft") || keysPressed.current.has("KeyA")) {
        movePlayer("left");
      }
      if (keysPressed.current.has("ArrowRight") || keysPressed.current.has("KeyD")) {
        movePlayer("right");
      }

      // Continuous shooting while Space is held
      if (keysPressed.current.has("Space")) {
        const hasRapidFire = hasPowerUp("rapidfire");
        const cooldown = hasRapidFire ? 80 : 150;
        const now = Date.now();
        if (now - lastShootRef.current > cooldown) {
          shoot();
          if (soundEnabled) {
            soundManager.playShoot();
          }
          lastShootRef.current = now;
        }
      }

      // Update game state
      updateBullets();
      updateEnemies();
      updatePowerUps();
      updateRiverOffset();
      consumeFuel();
      updateExplosions();
      updateActivePowerUps();

      // Spawn enemies - faster with higher difficulty
      const spawnInterval = Math.max(800, 1500 - (difficulty - 1) * 200);
      if (timestamp - lastSpawnRef.current > spawnInterval) {
        spawnEnemy();
        lastSpawnRef.current = timestamp;
      }

      // Spawn power-ups occasionally
      if (timestamp - lastPowerUpSpawnRef.current > 10000) { // Every 10 seconds
        if (Math.random() < 0.5) { // 50% chance
          spawnPowerUp();
        }
        lastPowerUpSpawnRef.current = timestamp;
      }

      // Increase difficulty over time
      if (timestamp - difficultyTimerRef.current > 15000) { // Every 15 seconds
        increaseDifficulty();
        difficultyTimerRef.current = timestamp;
      }

      // Check collisions
      checkCollisions();

      // Draw
      draw(ctx);

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [phase, movePlayer, shoot, updateBullets, updateEnemies, updatePowerUps, updateRiverOffset, consumeFuel, spawnEnemy, spawnPowerUp, checkCollisions, draw, updateExplosions, updateActivePowerUps, increaseDifficulty, hasPowerUp, soundEnabled, difficulty]);

  // Draw menu or game over screen with proper animation frame cleanup
  useEffect(() => {
    if (phase === "playing") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let menuAnimationId: number;
    let scrollOffset = 0;

    const drawMenuScreen = () => {
      // Animate background scroll for river effect
      scrollOffset = (scrollOffset + 1) % 100;

      // Draw background
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw animated river with scroll effect
      ctx.fillStyle = "#1E90FF";
      for (let y = -100; y < CANVAS_HEIGHT + 100; y += 50) {
        const wobble = Math.sin((y + scrollOffset * 3) * 0.02) * 30;
        ctx.fillRect(RIVER_LEFT + wobble, y, RIVER_RIGHT - RIVER_LEFT, 50);
      }

      // Draw decorative land elements
      ctx.fillStyle = "#228B22";
      ctx.fillRect(0, 0, RIVER_LEFT - 30, CANVAS_HEIGHT);
      ctx.fillRect(RIVER_RIGHT + 30, 0, CANVAS_WIDTH - RIVER_RIGHT - 30, CANVAS_HEIGHT);

      // Draw road markings on sides
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 3;
      for (let y = (scrollOffset * 3) % 80; y < CANVAS_HEIGHT; y += 80) {
        ctx.beginPath();
        ctx.moveTo(RIVER_LEFT - 50, y);
        ctx.lineTo(RIVER_LEFT - 30, y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(RIVER_RIGHT + 30, y);
        ctx.lineTo(RIVER_RIGHT + 50, y);
        ctx.stroke();
      }

      const blink = Math.floor(Date.now() / 500) % 2;

      if (phase === "menu") {
        // Draw title with shadow
        ctx.fillStyle = "#000000";
        ctx.font = "bold 60px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("RIVER RAID", CANVAS_WIDTH / 2 + 3, 153);
        ctx.fillStyle = "#FFD700";
        ctx.fillText("RIVER RAID", CANVAS_WIDTH / 2, 150);

        // Draw subtitle
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "24px 'Courier New', monospace";
        ctx.fillText(`Oyuncu: ${username}`, CANVAS_WIDTH / 2, 200);

        // Draw high score if exists
        if (highScore > 0) {
          ctx.fillStyle = "#00FF00";
          ctx.font = "bold 20px 'Courier New', monospace";
          ctx.fillText(`YÜKSEK SKOR: ${highScore}`, CANVAS_WIDTH / 2, 235);
        }

        // Draw instructions box
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(CANVAS_WIDTH / 2 - 180, 270, 360, 180);
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 2;
        ctx.strokeRect(CANVAS_WIDTH / 2 - 180, 270, 360, 180);

        ctx.fillStyle = "#00FF00";
        ctx.font = "20px 'Courier New', monospace";
        ctx.fillText("KONTROLLER", CANVAS_WIDTH / 2, 300);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "16px 'Courier New', monospace";
        ctx.fillText("← → Ok Tuşları: Hareket", CANVAS_WIDTH / 2, 335);
        ctx.fillText("SPACE: Ateş Et", CANVAS_WIDTH / 2, 365);
        ctx.fillText("Yakıtı topla, düşmanları vur!", CANVAS_WIDTH / 2, 405);
        ctx.fillText("Güç-artırımlarını kaçırma!", CANVAS_WIDTH / 2, 430);

        // Draw start prompt with blink
        if (blink) {
          ctx.fillStyle = "#FFFF00";
          ctx.font = "bold 28px 'Courier New', monospace";
          ctx.fillText("BAŞLAMAK İÇİN SPACE'E BASIN", CANVAS_WIDTH / 2, 510);
        }
      } else if (phase === "gameover") {
        // Draw game over with shadow
        ctx.fillStyle = "#000000";
        ctx.font = "bold 60px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("OYUN BİTTİ", CANVAS_WIDTH / 2 + 3, 173);
        ctx.fillStyle = "#FF0000";
        ctx.fillText("OYUN BİTTİ", CANVAS_WIDTH / 2, 170);

        // Draw final score box
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(CANVAS_WIDTH / 2 - 150, 210, 300, 160);
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 2;
        ctx.strokeRect(CANVAS_WIDTH / 2 - 150, 210, 300, 160);

        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 40px 'Courier New', monospace";
        ctx.fillText(`SKOR: ${score}`, CANVAS_WIDTH / 2, 260);

        // Show if new high score
        if (score >= highScore && score > 0) {
          ctx.fillStyle = "#00FF00";
          ctx.font = "bold 20px 'Courier New', monospace";
          ctx.fillText("YENİ REKOR!", CANVAS_WIDTH / 2, 295);
        }

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "20px 'Courier New', monospace";
        ctx.fillText(`Oyuncu: ${username}`, CANVAS_WIDTH / 2, 330);
        ctx.fillStyle = "#888888";
        ctx.font = "16px 'Courier New', monospace";
        ctx.fillText(`Yüksek Skor: ${highScore}`, CANVAS_WIDTH / 2, 360);

        // Draw restart prompt with blink
        if (blink) {
          ctx.fillStyle = "#00FF00";
          ctx.font = "bold 22px 'Courier New', monospace";
          ctx.fillText("YENİDEN BAŞLAMAK İÇİN SPACE'E BASIN", CANVAS_WIDTH / 2, 430);
        }
      }

      menuAnimationId = requestAnimationFrame(drawMenuScreen);
    };

    menuAnimationId = requestAnimationFrame(drawMenuScreen);

    return () => {
      if (menuAnimationId) {
        cancelAnimationFrame(menuAnimationId);
      }
    };
  }, [phase, score, username, highScore]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        display: "block",
        margin: "0 auto",
        imageRendering: "pixelated",
      }}
    />
  );
}
