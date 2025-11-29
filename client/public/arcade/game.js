/**
 * Corporate Breakout - Arcade Game
 *
 * Klasik tuğla kırma oyununun şirket temalı versiyonu.
 * "Bürokratik engelleri" kır ve zirveye ulaş!
 */

class CorporateBreakout {
  constructor(canvasId, mcp = null) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.mcp = mcp; // MCPCallee instance

    // Oyun durumu
    this.gameState = 'waiting'; // waiting, playing, paused, won, lost
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.startTime = null;
    this.highScore = this._loadHighScore();

    // Top
    this.ball = {
      x: 0,
      y: 0,
      dx: 4,
      dy: -4,
      radius: 8,
      speed: 5
    };

    // Platform (paddle)
    this.paddle = {
      width: 100,
      height: 12,
      x: 0,
      y: 0,
      speed: 8
    };

    // Tuğlalar (brickConfig resizeCanvas'tan önce tanımlanmalı)
    this.bricks = [];
    this.brickConfig = {
      rows: 5,
      cols: 8,
      width: 0,
      height: 25,
      padding: 4,
      offsetTop: 60,
      offsetLeft: 0
    };

    // Canvas boyutları (brickConfig tanımlandıktan sonra)
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Kontroller
    this.keys = {
      left: false,
      right: false
    };

    // Renkler - Şirket teması
    this.colors = {
      background: '#1a1a2e',
      paddle: '#4ecca3',
      ball: '#eeeeee',
      text: '#eeeeee',
      accent: '#e94560',
      brickColors: [
        '#e94560', // Kırmızı - CEO seviyesi
        '#ff6b6b', // Turuncu - Yönetici
        '#feca57', // Sarı - Müdür
        '#48dbfb', // Mavi - Uzman
        '#1dd1a1'  // Yeşil - Stajyer
      ]
    };

    this._setupControls();
    this._initLevel();
  }

  /**
   * Canvas boyutlandırma
   */
  resizeCanvas() {
    const container = this.canvas.parentElement;
    const maxWidth = Math.min(container.clientWidth - 40, 800);
    const maxHeight = Math.min(container.clientHeight - 100, 600);

    this.canvas.width = maxWidth;
    this.canvas.height = maxHeight;

    // Brick genişliğini yeniden hesapla
    this.brickConfig.width = (this.canvas.width - 40) / this.brickConfig.cols - this.brickConfig.padding;
    this.brickConfig.offsetLeft = 20;

    // Paddle ve ball pozisyonlarını güncelle
    this.paddle.y = this.canvas.height - 30;
    this.paddle.x = (this.canvas.width - this.paddle.width) / 2;

    this._resetBall();
  }

  /**
   * Kontrolleri kur
   */
  _setupControls() {
    // Klavye kontrolleri
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        this.keys.left = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd') {
        this.keys.right = true;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        this._handleAction();
      }
      if (e.key === 'p' || e.key === 'P') {
        this.togglePause();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        this.keys.left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd') {
        this.keys.right = false;
      }
    });

    // Mouse/Touch kontrolleri
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      this.paddle.x = Math.max(0, Math.min(x - this.paddle.width / 2, this.canvas.width - this.paddle.width));
    });

    this.canvas.addEventListener('click', () => {
      this._handleAction();
    });

    // Touch desteği
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      this.paddle.x = Math.max(0, Math.min(x - this.paddle.width / 2, this.canvas.width - this.paddle.width));
    });

    this.canvas.addEventListener('touchstart', () => {
      this._handleAction();
    });
  }

  /**
   * Aksiyon işleyici (Space/Click/Touch)
   */
  _handleAction() {
    switch (this.gameState) {
      case 'waiting':
        this.start();
        break;
      case 'paused':
        this.resume();
        break;
      case 'won':
      case 'lost':
        this.restart();
        break;
    }
  }

  /**
   * Seviye başlat
   */
  _initLevel() {
    this.bricks = [];

    const { rows, cols, width, height, padding, offsetTop, offsetLeft } = this.brickConfig;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Her satır farklı puan ve renk
        const points = (rows - row) * 10;
        const colorIndex = Math.min(row, this.colors.brickColors.length - 1);

        this.bricks.push({
          x: offsetLeft + col * (width + padding),
          y: offsetTop + row * (height + padding),
          width,
          height,
          color: this.colors.brickColors[colorIndex],
          points,
          alive: true,
          label: this._getBrickLabel(row)
        });
      }
    }

    this._resetBall();
    this.paddle.x = (this.canvas.width - this.paddle.width) / 2;
  }

  /**
   * Tuğla etiketi (şirket teması)
   */
  _getBrickLabel(row) {
    const labels = ['CEO', 'VP', 'MGR', 'SR', 'JR'];
    return labels[row] || '';
  }

  /**
   * Topu sıfırla
   */
  _resetBall() {
    this.ball.x = this.canvas.width / 2;
    this.ball.y = this.canvas.height - 50;
    this.ball.dx = (Math.random() > 0.5 ? 1 : -1) * this.ball.speed;
    this.ball.dy = -this.ball.speed;
  }

  /**
   * Oyunu başlat
   */
  start() {
    if (this.gameState === 'playing') return;

    this.gameState = 'playing';
    this.startTime = Date.now();

    // MCP'ye başladığımızı bildir
    if (this.mcp) {
      this._sendProgress();
    }

    this._gameLoop();
  }

  /**
   * Oyunu duraklat
   */
  pause() {
    if (this.gameState !== 'playing') return;
    this.gameState = 'paused';
  }

  /**
   * Oyunu devam ettir
   */
  resume() {
    if (this.gameState !== 'paused') return;
    this.gameState = 'playing';
    this._gameLoop();
  }

  /**
   * Duraklat/Devam
   */
  togglePause() {
    if (this.gameState === 'playing') {
      this.pause();
    } else if (this.gameState === 'paused') {
      this.resume();
    }
  }

  /**
   * Yeniden başlat
   */
  restart() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.gameState = 'waiting';
    this._initLevel();
    this._render();
  }

  /**
   * Ana oyun döngüsü
   */
  _gameLoop() {
    if (this.gameState !== 'playing') {
      this._render();
      return;
    }

    this._update();
    this._render();

    requestAnimationFrame(() => this._gameLoop());
  }

  /**
   * Oyun güncellemesi
   */
  _update() {
    // Paddle hareketi (klavye)
    if (this.keys.left) {
      this.paddle.x = Math.max(0, this.paddle.x - this.paddle.speed);
    }
    if (this.keys.right) {
      this.paddle.x = Math.min(this.canvas.width - this.paddle.width, this.paddle.x + this.paddle.speed);
    }

    // Top hareketi
    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;

    // Duvar çarpışmaları
    if (this.ball.x - this.ball.radius < 0 || this.ball.x + this.ball.radius > this.canvas.width) {
      this.ball.dx = -this.ball.dx;
    }
    if (this.ball.y - this.ball.radius < 0) {
      this.ball.dy = -this.ball.dy;
    }

    // Alt sınır - can kaybı
    if (this.ball.y + this.ball.radius > this.canvas.height) {
      this.lives--;

      if (this.mcp) {
        this._sendProgress();
      }

      if (this.lives <= 0) {
        this._gameOver(false);
      } else {
        this._resetBall();
      }
    }

    // Paddle çarpışması
    if (this._checkPaddleCollision()) {
      // Paddle'ın neresine çarptığına göre açı değiştir
      const hitPoint = (this.ball.x - this.paddle.x) / this.paddle.width;
      const angle = hitPoint * Math.PI - Math.PI / 2;
      const speed = Math.sqrt(this.ball.dx ** 2 + this.ball.dy ** 2);

      this.ball.dx = speed * Math.sin(angle);
      this.ball.dy = -Math.abs(speed * Math.cos(angle));
    }

    // Tuğla çarpışmaları
    this._checkBrickCollisions();

    // Tüm tuğlalar kırıldı mı?
    const aliveBricks = this.bricks.filter(b => b.alive);
    if (aliveBricks.length === 0) {
      this._nextLevel();
    }
  }

  /**
   * Paddle çarpışma kontrolü
   */
  _checkPaddleCollision() {
    return (
      this.ball.y + this.ball.radius > this.paddle.y &&
      this.ball.y - this.ball.radius < this.paddle.y + this.paddle.height &&
      this.ball.x > this.paddle.x &&
      this.ball.x < this.paddle.x + this.paddle.width
    );
  }

  /**
   * Tuğla çarpışma kontrolü
   */
  _checkBrickCollisions() {
    for (const brick of this.bricks) {
      if (!brick.alive) continue;

      if (
        this.ball.x + this.ball.radius > brick.x &&
        this.ball.x - this.ball.radius < brick.x + brick.width &&
        this.ball.y + this.ball.radius > brick.y &&
        this.ball.y - this.ball.radius < brick.y + brick.height
      ) {
        brick.alive = false;
        this.ball.dy = -this.ball.dy;
        this.score += brick.points;

        // Her 5 tuğlada bir progress gönder
        const destroyedCount = this.bricks.filter(b => !b.alive).length;
        if (destroyedCount % 5 === 0 && this.mcp) {
          this._sendProgress();
        }

        break; // Bir seferde tek tuğla
      }
    }
  }

  /**
   * Sonraki seviye
   */
  _nextLevel() {
    this.level++;

    // Hızı artır
    this.ball.speed += 0.5;

    // Yeni seviye için tuğlaları yeniden oluştur
    if (this.level > 5) {
      // 5 seviye tamamlandı - oyun kazanıldı
      this._gameOver(true);
    } else {
      this._initLevel();

      if (this.mcp) {
        this._sendProgress();
      }
    }
  }

  /**
   * Oyun sonu
   */
  _gameOver(won) {
    this.gameState = won ? 'won' : 'lost';

    // High score güncelle
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this._saveHighScore();
    }

    // MCP'ye sonucu bildir
    if (this.mcp) {
      this.mcp.completeGame({
        finalScore: this.score,
        highScore: this.highScore,
        level: this.level,
        timeElapsed: Math.floor((Date.now() - this.startTime) / 1000),
        won: won
      });
    }
  }

  /**
   * Progress gönder
   */
  _sendProgress() {
    if (!this.mcp) return;

    const totalBricks = this.bricks.length;
    const destroyedBricks = this.bricks.filter(b => !b.alive).length;
    const progressPercent = Math.round((destroyedBricks / totalBricks) * 100);

    this.mcp.sendGameProgress({
      score: this.score,
      level: this.level,
      lives: this.lives,
      timeElapsed: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      progressPercent: progressPercent
    });
  }

  /**
   * Render
   */
  _render() {
    const { ctx, canvas } = this;

    // Arka plan
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid efekti
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 30) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Tuğlalar
    for (const brick of this.bricks) {
      if (!brick.alive) continue;

      // Tuğla gölge
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(brick.x + 3, brick.y + 3, brick.width, brick.height);

      // Tuğla
      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

      // Tuğla border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);

      // Tuğla etiketi
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(brick.label, brick.x + brick.width / 2, brick.y + brick.height / 2);
    }

    // Paddle gölge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(this.paddle.x + 3, this.paddle.y + 3, this.paddle.width, this.paddle.height);

    // Paddle
    ctx.fillStyle = this.colors.paddle;
    ctx.beginPath();
    ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height, 4);
    ctx.fill();

    // Top glow
    ctx.shadowColor = this.colors.ball;
    ctx.shadowBlur = 15;

    // Top
    ctx.fillStyle = this.colors.ball;
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // UI - Skor ve Lives
    this._renderUI();

    // Overlay mesajları
    this._renderOverlay();
  }

  /**
   * UI render
   */
  _renderUI() {
    const { ctx, canvas } = this;

    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Skor
    ctx.fillText(`SCORE: ${this.score}`, 10, 10);

    // Level
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${this.level}`, canvas.width / 2, 10);

    // Lives (kalp olarak)
    ctx.textAlign = 'right';
    let livesText = '';
    for (let i = 0; i < this.lives; i++) {
      livesText += '❤️ ';
    }
    ctx.fillText(livesText || '💔', canvas.width - 10, 10);

    // High Score
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(`HI: ${this.highScore}`, canvas.width - 10, 32);
  }

  /**
   * Overlay render (mesajlar)
   */
  _renderOverlay() {
    const { ctx, canvas } = this;

    if (this.gameState === 'waiting') {
      this._drawOverlayBox('CORPORATE BREAKOUT', 'Bürokratik engelleri kır!', 'Başlamak için TIKLA veya SPACE', this.colors.paddle);
    } else if (this.gameState === 'paused') {
      this._drawOverlayBox('DURAKLATILDI', '', 'Devam için TIKLA veya SPACE', this.colors.accent);
    } else if (this.gameState === 'won') {
      this._drawOverlayBox('TEBRİKLER!', `Final Skor: ${this.score}`, 'Yeniden oynamak için TIKLA', this.colors.paddle);
    } else if (this.gameState === 'lost') {
      this._drawOverlayBox('OYUN BİTTİ', `Skor: ${this.score}`, 'Tekrar denemek için TIKLA', this.colors.accent);
    }
  }

  /**
   * Overlay kutusu çiz
   */
  _drawOverlayBox(title, subtitle, action, color) {
    const { ctx, canvas } = this;

    // Karartma
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Kutu
    const boxWidth = 300;
    const boxHeight = 150;
    const boxX = (canvas.width - boxWidth) / 2;
    const boxY = (canvas.height - boxHeight) / 2;

    ctx.fillStyle = 'rgba(30, 30, 50, 0.95)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Title
    ctx.fillStyle = color;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, canvas.width / 2, boxY + 40);

    // Subtitle
    if (subtitle) {
      ctx.fillStyle = this.colors.text;
      ctx.font = '16px monospace';
      ctx.fillText(subtitle, canvas.width / 2, boxY + 75);
    }

    // Action
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '14px monospace';
    ctx.fillText(action, canvas.width / 2, boxY + boxHeight - 30);
  }

  /**
   * High score yükle
   */
  _loadHighScore() {
    try {
      return parseInt(localStorage.getItem('corporateBreakout_highScore')) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * High score kaydet
   */
  _saveHighScore() {
    try {
      localStorage.setItem('corporateBreakout_highScore', this.highScore.toString());
    } catch {
      // localStorage kullanılamıyor
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CorporateBreakout };
} else if (typeof window !== 'undefined') {
  window.CorporateBreakout = CorporateBreakout;
}
