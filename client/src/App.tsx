import { useEffect, useRef, useCallback } from "react";
import { MCPCallee } from "@/lib/mcp/MCPCallee";
import { useRiverRaid } from "@/lib/stores/useRiverRaid";
import { RiverRaidGame } from "@/components/game/RiverRaidGame";
import { GameUI } from "@/components/game/GameUI";
import "@fontsource/inter";

function App() {
  const mcpRef = useRef<MCPCallee | null>(null);
  const lastProgressSendRef = useRef<number>(0);
  const { 
    setUsername, 
    phase, 
    score, 
    lives, 
    fuel,
    highScore,
    difficulty,
    playTime,
    enemiesDestroyed,
    startGame,
    restartGame,
    pauseGame,
    resumeGame,
    setHighScore,
    stopTimer,
  } = useRiverRaid();
  
  const prevPhaseRef = useRef<string>(phase);
  const prevLivesRef = useRef<number>(lives);

  // Handle control commands from parent
  const handleControl = useCallback((action: string, params: any) => {
    console.log("MCP Control:", action, params);
    
    switch (action) {
      case "play":
      case "start":
        if (phase === "menu" || phase === "gameover") {
          if (phase === "gameover") {
            restartGame();
          }
          startGame();
        } else if (phase === "paused") {
          resumeGame();
        }
        break;
      case "pause":
        if (phase === "playing") {
          pauseGame();
        }
        break;
      case "resume":
        if (phase === "paused") {
          resumeGame();
        }
        break;
      case "restart":
        restartGame();
        break;
    }
  }, [phase, startGame, restartGame, pauseGame, resumeGame]);

  useEffect(() => {
    // Initialize MCP Callee for layer mode integration
    mcpRef.current = new MCPCallee({
      appId: "river-raid-game",
      version: "1.0.0",
      capabilities: ["play", "pause", "restart", "resume"],
      debug: true,
    });

    // Handle init from parent app or URL params
    mcpRef.current.onInit((context) => {
      console.log("MCP Init received:", context);
      
      // Set username from params
      if (context.params.username) {
        setUsername(context.params.username);
      } else if (context.userId) {
        setUsername(context.userId);
      }
      
      // Notify parent that game is ready
      mcpRef.current?.sendProgress({
        current: 0,
        total: 100,
        message: "Game ready to start",
      });
    });

    // Handle control commands from parent
    mcpRef.current.onControl(handleControl);

    // Handle close request from parent
    mcpRef.current.onClose((reason) => {
      console.log("MCP Close:", reason);
      // Send final state when closing
      const state = useRiverRaid.getState();
      const finalPlayTime = state.gameStartTime 
        ? Math.round((Date.now() - state.gameStartTime) / 1000)
        : state.playTime;
      mcpRef.current?.cancelWithData(reason, {
        finalScore: state.score,
        highScore: state.highScore,
        difficulty: state.difficulty,
        playTime: finalPlayTime,
        completed: false,
        enemiesDestroyed: state.enemiesDestroyed,
      });
    });

    return () => {
      mcpRef.current?.destroy();
    };
  }, [setUsername, handleControl]);

  // Send progress updates when score, lives, or fuel changes during gameplay
  // Throttled to 500ms to prevent message flood
  useEffect(() => {
    if (mcpRef.current && phase === "playing") {
      const now = Date.now();
      if (now - lastProgressSendRef.current >= 500) {
        mcpRef.current.sendGameProgress({
          score,
          lives,
          status: "playing",
        });
        
        mcpRef.current.sendProgress({
          current: score,
          total: score + 1000,
          message: `Score: ${score} | Lives: ${lives} | Fuel: ${Math.round(fuel)}%`,
        });
        
        lastProgressSendRef.current = now;
      }
    }
  }, [phase, score, lives, fuel]);

  // Detect life loss and notify parent
  useEffect(() => {
    if (phase === "playing" && lives < prevLivesRef.current) {
      console.log(`Life lost! Remaining lives: ${lives}`);
      if (mcpRef.current) {
        mcpRef.current.sendProgress({
          current: lives,
          total: 3,
          message: `Life lost! Remaining: ${lives}`,
        });
      }
    }
    prevLivesRef.current = lives;
  }, [lives, phase]);

  // Detect phase changes and notify parent
  useEffect(() => {
    if (mcpRef.current) {
      if (phase === "playing" && prevPhaseRef.current !== "playing") {
        // Game started
        mcpRef.current.sendGameProgress({
          score: 0,
          lives: 3,
          status: "playing",
        });
      } else if (phase === "paused" && prevPhaseRef.current === "playing") {
        // Game paused
        mcpRef.current.sendGameProgress({
          score,
          lives,
          status: "paused",
        });
      } else if (phase === "gameover" && prevPhaseRef.current !== "gameover") {
        // Game over - send completion with all data
        const state = useRiverRaid.getState();
        stopTimer();
        const finalPlayTime = state.gameStartTime 
          ? Math.round((Date.now() - state.gameStartTime) / 1000)
          : state.playTime;
        mcpRef.current.completeGame({
          finalScore: score,
          highScore: state.highScore,
          difficulty: state.difficulty,
          playTime: finalPlayTime,
          completed: true,
          enemiesDestroyed: state.enemiesDestroyed,
        });
      }
    }
    prevPhaseRef.current = phase;
  }, [phase, score, lives]);

  // Send high score updates to parent app
  useEffect(() => {
    if (mcpRef.current && highScore > 0) {
      mcpRef.current.sendProgress({
        current: highScore,
        total: highScore,
        message: `High Score: ${highScore}`,
      });
    }
  }, [highScore]);

  return (
    <div className="game-container">
      <RiverRaidGame />
      <GameUI />
    </div>
  );
}

export default App;
