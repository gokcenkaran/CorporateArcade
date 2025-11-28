import { useRiverRaid } from "@/lib/stores/useRiverRaid";

export function GameUI() {
  const { phase, score, lives, fuel, username } = useRiverRaid();

  if (phase === "menu" || phase === "gameover") {
    return null;
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
              style={{ width: `${fuel}%` }}
            />
          </div>
          <div className="fuel-markers">
            <span>E</span>
            <span>½</span>
            <span>F</span>
          </div>
        </div>
      </div>
    </div>
  );
}
