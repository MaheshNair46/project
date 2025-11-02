import { Song } from '../../shared/types';

class AudioService {
  private audio: HTMLAudioElement | null = null;
  private currentSong: Song | null = null;
  private isPlaying: boolean = false;
  private currentTime: number = 0;
  private volume: number = 0.7;
  private isMuted: boolean = false;
  private duration: number = 0;

  private onTimeUpdateListeners: ((time: number) => void)[] = [];
  private onEndedListeners: (() => void)[] = [];
  private onLoadListeners: (() => void)[] = [];
  private onErrorListeners: ((error: Error) => void)[] = [];

  constructor() {
    this.initializeAudio();
  }

  private initializeAudio(): void {
    this.audio = new Audio();
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate.bind(this));
    this.audio.addEventListener('ended', this.handleEnded.bind(this));
    this.audio.addEventListener('loadedmetadata', this.handleLoadedMetadata.bind(this));
    this.audio.addEventListener('error', this.handleError.bind(this));

    this.audio.volume = this.volume;
    this.audio.preload = 'metadata';
  }

  private handleTimeUpdate(): void {
    if (this.audio) {
      this.currentTime = this.audio.currentTime;
      this.onTimeUpdateListeners.forEach(listener => listener(this.currentTime));
    }
  }

  private handleEnded(): void {
    this.isPlaying = false;
    this.onEndedListeners.forEach(listener => listener());
  }

  private handleLoadedMetadata(): void {
    if (this.audio) {
      this.duration = this.audio.duration;
      this.onLoadListeners.forEach(listener => listener());
    }
  }

  private handleError(): void {
    const error = new Error('Audio playback error');
    this.isPlaying = false;
    this.onErrorListeners.forEach(listener => listener(error));
  }

  public async loadSong(song: Song): Promise<void> {
    if (!this.audio) {
      throw new Error('Audio not initialized');
    }

    this.currentSong = song;
    this.isPlaying = false;
    this.currentTime = 0;

    try {
      // For local files, we need to use file:// protocol
      const fileUrl = `file://${song.filePath}`;
      this.audio.src = fileUrl;

      // Wait for the audio to be ready
      await new Promise<void>((resolve, reject) => {
        const onLoad = () => {
          this.audio?.removeEventListener('canplay', onLoad);
          this.audio?.removeEventListener('error', onError);
          resolve();
        };
        const onError = () => {
          this.audio?.removeEventListener('canplay', onLoad);
          this.audio?.removeEventListener('error', onError);
          reject(new Error('Failed to load audio file'));
        };

        this.audio?.addEventListener('canplay', onLoad);
        this.audio?.addEventListener('error', onError);
      });
    } catch (error) {
      throw new Error(`Failed to load song: ${song.title}`);
    }
  }

  public async play(): Promise<void> {
    if (!this.audio || !this.currentSong) {
      throw new Error('No song loaded');
    }

    try {
      await this.audio.play();
      this.isPlaying = true;
    } catch (error) {
      throw new Error('Failed to play audio');
    }
  }

  public pause(): void {
    if (this.audio) {
      this.audio.pause();
      this.isPlaying = false;
    }
  }

  public stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.isPlaying = false;
      this.currentTime = 0;
    }
  }

  public seek(position: number): void {
    if (this.audio) {
      this.audio.currentTime = Math.max(0, Math.min(position, this.duration));
      this.currentTime = this.audio.currentTime;
    }
  }

  public setVolume(level: number): void {
    this.volume = Math.max(0, Math.min(1, level));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.audio) {
      this.audio.muted = muted;
    }
  }

  public getCurrentSong(): Song | null {
    return this.currentSong;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getDuration(): number {
    return this.duration;
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public addTimeUpdateListener(listener: (time: number) => void): void {
    this.onTimeUpdateListeners.push(listener);
  }

  public removeTimeUpdateListener(listener: (time: number) => void): void {
    const index = this.onTimeUpdateListeners.indexOf(listener);
    if (index > -1) {
      this.onTimeUpdateListeners.splice(index, 1);
    }
  }

  public addEndedListener(listener: () => void): void {
    this.onEndedListeners.push(listener);
  }

  public removeEndedListener(listener: () => void): void {
    const index = this.onEndedListeners.indexOf(listener);
    if (index > -1) {
      this.onEndedListeners.splice(index, 1);
    }
  }

  public addLoadListener(listener: () => void): void {
    this.onLoadListeners.push(listener);
  }

  public removeLoadListener(listener: () => void): void {
    const index = this.onLoadListeners.indexOf(listener);
    if (index > -1) {
      this.onLoadListeners.splice(index, 1);
    }
  }

  public addErrorListener(listener: (error: Error) => void): void {
    this.onErrorListeners.push(listener);
  }

  public removeErrorListener(listener: (error: Error) => void): void {
    const index = this.onErrorListeners.indexOf(listener);
    if (index > -1) {
      this.onErrorListeners.splice(index, 1);
    }
  }

  public destroy(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio.removeEventListener('timeupdate', this.handleTimeUpdate);
      this.audio.removeEventListener('ended', this.handleEnded);
      this.audio.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
      this.audio.removeEventListener('error', this.handleError);
      this.audio = null;
    }

    this.onTimeUpdateListeners = [];
    this.onEndedListeners = [];
    this.onLoadListeners = [];
    this.onErrorListeners = [];

    this.currentSong = null;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
  }
}

// Create a singleton instance
export const audioService = new AudioService();
export default audioService;