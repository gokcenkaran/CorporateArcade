class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;
  private volume: number = 0.5;
  private backgroundMusic: HTMLAudioElement | null = null;
  private initialized: boolean = false;

  constructor() {
    this.preloadSounds();
  }

  private preloadSounds() {
    const soundFiles = {
      shoot: "/sounds/hit.mp3",
      hit: "/sounds/hit.mp3",
      explosion: "/sounds/hit.mp3",
      fuel: "/sounds/success.mp3",
      powerup: "/sounds/success.mp3",
      gameOver: "/sounds/hit.mp3",
      background: "/sounds/background.mp3",
    };

    Object.entries(soundFiles).forEach(([name, path]) => {
      const audio = new Audio(path);
      audio.preload = "auto";
      audio.volume = this.volume;
      this.sounds.set(name, audio);
    });
  }

  public initialize() {
    if (this.initialized) return;
    this.initialized = true;
  }

  public play(soundName: string, options?: { volume?: number; loop?: boolean }) {
    if (!this.enabled) return;

    const sound = this.sounds.get(soundName);
    if (!sound) return;

    try {
      const clone = sound.cloneNode() as HTMLAudioElement;
      clone.volume = options?.volume ?? this.volume;
      clone.loop = options?.loop ?? false;
      clone.play().catch(() => {});
    } catch (e) {
      console.warn("Sound play failed:", e);
    }
  }

  public playShoot() {
    this.play("shoot", { volume: 0.3 });
  }

  public playHit() {
    this.play("hit", { volume: 0.5 });
  }

  public playExplosion() {
    this.play("explosion", { volume: 0.6 });
  }

  public playFuelPickup() {
    this.play("fuel", { volume: 0.5 });
  }

  public playPowerup() {
    this.play("powerup", { volume: 0.6 });
  }

  public playGameOver() {
    this.play("gameOver", { volume: 0.7 });
  }

  public startBackgroundMusic() {
    if (!this.enabled) return;

    const bgMusic = this.sounds.get("background");
    if (!bgMusic) return;

    try {
      this.backgroundMusic = bgMusic;
      this.backgroundMusic.loop = true;
      this.backgroundMusic.volume = 0.3;
      this.backgroundMusic.play().catch(() => {});
    } catch (e) {
      console.warn("Background music failed:", e);
    }
  }

  public stopBackgroundMusic() {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
      this.backgroundMusic.currentTime = 0;
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopBackgroundMusic();
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach(sound => {
      sound.volume = this.volume;
    });
    if (this.backgroundMusic) {
      this.backgroundMusic.volume = this.volume * 0.6;
    }
  }

  public isEnabled() {
    return this.enabled;
  }
}

export const soundManager = new SoundManager();
