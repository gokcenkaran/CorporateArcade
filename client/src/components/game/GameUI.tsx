import { useRiverRaid } from "@/lib/stores/useRiverRaid";
import { soundManager } from "@/lib/sounds/SoundManager";

export function GameUI() {
  const { 
    phase, 
    score, 
    lives, 
    fuel, 
    username,
    soundEnabled,
    toggleSound,
  } = useRiverRaid();

  const handleToggleSound = () => {
    toggleSound();
    if (!soundEnabled) {
      soundManager.setEnabled(true);
    } else {
      soundManager.setEnabled(false);
      soundManager.stopBackgroundMusic();
    }
  };

  if (phase === "menu" || phase === "gameover") {
    return (
      <div className="game-ui">
        <button
          className="sound-toggle"
          onClick={handleToggleSound}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            padding: "8px 12px",
            backgroundColor: "rgba(0,0,0,0.7)",
            color: soundEnabled ? "#00FF00" : "#FF0000",
            border: `2px solid ${soundEnabled ? "#00FF00" : "#FF0000"}`,
            borderRadius: "4px",
            cursor: "pointer",
            fontFamily: "'Courier New', monospace",
            fontSize: "14px",
            fontWeight: "bold",
            pointerEvents: "auto",
          }}
        >
          SES {soundEnabled ? "AÇIK" : "KAPALI"}
        </button>
      </div>
    );
  }

  return (
    <div className="game-ui">
      <div className="game-ui-top">
        <div className="game-ui-player">
          <span className="label">OYUNCU:</span>
          <span className="value">{username}</span>
        </div>
        <div className="game-ui-score">
          <span className="label">SKOR:</span>
          <span className="value">{score}</span>
        </div>
        <div className="game-ui-lives">
          <span className="label">CAN:</span>
          <span className="value">
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={i}
                className={`life-icon ${i < lives ? "active" : "inactive"}`}
              >
                ✈
              </span>
            ))}
          </span>
        </div>
      </div>
      
      <div className="game-ui-bottom">
        <div className="fuel-container">
          <span className="fuel-label">YAKIT</span>
          <div className="fuel-bar-bg">
            <div 
              className="fuel-bar-fill"
              style={{ 
                width: `${fuel}%`,
                backgroundColor: fuel < 20 ? '#FF0000' : fuel < 40 ? '#FFFF00' : '#00FF00',
              }}
            />
          </div>
          <div className="fuel-markers">
            <span>E</span>
            <span>½</span>
            <span>F</span>
          </div>
        </div>
        
        <button
          onClick={handleToggleSound}
          style={{
            marginLeft: "20px",
            padding: "5px 10px",
            backgroundColor: "rgba(0,0,0,0.7)",
            color: soundEnabled ? "#00FF00" : "#FF0000",
            border: `1px solid ${soundEnabled ? "#00FF00" : "#FF0000"}`,
            borderRadius: "3px",
            cursor: "pointer",
            fontFamily: "'Courier New', monospace",
            fontSize: "12px",
            pointerEvents: "auto",
          }}
        >
          {soundEnabled ? "🔊" : "🔇"}
        </button>
      </div>
    </div>
  );
}
