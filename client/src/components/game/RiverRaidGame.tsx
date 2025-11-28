import { useEffect, useRef, useCallback, useMemo } from "react";
import { useRiverRaid, generateEnemyId, type Enemy } from "@/lib/stores/useRiverRaid";

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
  const keysPressed = useRef<Set<string>>(new Set());
  
  const {
    phase,
    score,
    lives,
    fuel,
    playerX,
    bullets,
    enemies,
    riverOffset,
    username,
    movePlayer,
    shoot,
    updateBullets,
    updateEnemies,
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
      
      if (e.code === "Space") {
        e.preventDefault();
        if (phase === "menu" || phase === "gameover") {
          if (phase === "gameover") {
            restartGame();
          }
          startGame();
        } else if (phase === "playing") {
          const now = Date.now();
          if (now - lastShootRef.current > 150) {
            shoot();
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
  }, [phase, shoot, startGame, restartGame]);

  // Spawn enemies
  const spawnEnemy = useCallback(() => {
    const types: Array<"helicopter" | "jet" | "ship" | "fuel"> = ["helicopter", "jet", "ship", "fuel"];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const enemy: Enemy = {
      id: generateEnemyId(),
      x: RIVER_LEFT + 50 + Math.random() * (RIVER_RIGHT - RIVER_LEFT - 100),
      y: -50,
      type,
      speed: type === "fuel" ? 2 : 2 + Math.random() * 2,
      direction: Math.random() > 0.5 ? 1 : -1,
    };
    
    addEnemy(enemy);
  }, [addEnemy]);

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
          
          if (enemy.type === "fuel") {
            addFuel(30);
            addScore(50);
          } else {
            addScore(100);
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
        } else {
          removeEnemy(enemy.id);
          loseLife();
        }
      }
    });
  }, [playerX, bullets, enemies, riverPath, loseLife, removeBullet, removeEnemy, addScore, addFuel]);

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
        // Draw helicopter
        ctx.fillStyle = "#00FF00";
        ctx.fillRect(enemy.x - 20, enemy.y - 10, 40, 20);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(enemy.x - 25, enemy.y - 3, 50, 6);
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
      } else if (enemy.type === "ship") {
        // Draw ship
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(enemy.x - 25, enemy.y - 8, 50, 16);
        ctx.fillStyle = "#A0522D";
        ctx.fillRect(enemy.x - 5, enemy.y - 18, 10, 10);
      }
    });

    // Draw player jet
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
  }, [riverPath, bullets, enemies, playerX]);

  // Game loop
  useEffect(() => {
    if (phase !== "playing") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
        const now = Date.now();
        if (now - lastShootRef.current > 150) {
          shoot();
          lastShootRef.current = now;
        }
      }

      // Update game state
      updateBullets();
      updateEnemies();
      updateRiverOffset();
      consumeFuel();

      // Spawn enemies
      if (timestamp - lastSpawnRef.current > 1500) {
        spawnEnemy();
        lastSpawnRef.current = timestamp;
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
  }, [phase, movePlayer, shoot, updateBullets, updateEnemies, updateRiverOffset, consumeFuel, spawnEnemy, checkCollisions, draw]);

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
        ctx.fillText("RIVER RAID", CANVAS_WIDTH / 2 + 3, 183);
        ctx.fillStyle = "#FFD700";
        ctx.fillText("RIVER RAID", CANVAS_WIDTH / 2, 180);

        // Draw subtitle
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "24px 'Courier New', monospace";
        ctx.fillText(`Oyuncu: ${username}`, CANVAS_WIDTH / 2, 240);

        // Draw instructions box
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(CANVAS_WIDTH / 2 - 180, 290, 360, 130);
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 2;
        ctx.strokeRect(CANVAS_WIDTH / 2 - 180, 290, 360, 130);

        ctx.fillStyle = "#00FF00";
        ctx.font = "20px 'Courier New', monospace";
        ctx.fillText("KONTROLLER", CANVAS_WIDTH / 2, 320);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "18px 'Courier New', monospace";
        ctx.fillText("← → Ok Tuşları: Hareket", CANVAS_WIDTH / 2, 355);
        ctx.fillText("SPACE: Ateş Et", CANVAS_WIDTH / 2, 385);

        // Draw start prompt with blink
        if (blink) {
          ctx.fillStyle = "#FFFF00";
          ctx.font = "bold 28px 'Courier New', monospace";
          ctx.fillText("BAŞLAMAK İÇİN SPACE'E BASIN", CANVAS_WIDTH / 2, 480);
        }
      } else if (phase === "gameover") {
        // Draw game over with shadow
        ctx.fillStyle = "#000000";
        ctx.font = "bold 60px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("OYUN BİTTİ", CANVAS_WIDTH / 2 + 3, 203);
        ctx.fillStyle = "#FF0000";
        ctx.fillText("OYUN BİTTİ", CANVAS_WIDTH / 2, 200);

        // Draw final score box
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(CANVAS_WIDTH / 2 - 150, 240, 300, 120);
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 2;
        ctx.strokeRect(CANVAS_WIDTH / 2 - 150, 240, 300, 120);

        ctx.fillStyle = "#FFD700";
        ctx.font = "bold 40px 'Courier New', monospace";
        ctx.fillText(`SKOR: ${score}`, CANVAS_WIDTH / 2, 290);

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "24px 'Courier New', monospace";
        ctx.fillText(`Oyuncu: ${username}`, CANVAS_WIDTH / 2, 340);

        // Draw restart prompt with blink
        if (blink) {
          ctx.fillStyle = "#00FF00";
          ctx.font = "bold 24px 'Courier New', monospace";
          ctx.fillText("YENİDEN BAŞLAMAK İÇİN SPACE'E BASIN", CANVAS_WIDTH / 2, 420);
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
  }, [phase, score, username]);

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
