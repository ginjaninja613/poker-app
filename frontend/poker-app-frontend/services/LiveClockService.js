// frontend/services/LiveClockService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

// Singleton service that keeps the tournament clock running even if screens unmount.
// Uses absolute timestamps to stay accurate after backgrounding.
// Persists state per tournament+day in AsyncStorage.

const TICK_MS = 1000;

function storageKey(tournamentId, dayIndex) {
  return `clock:${String(tournamentId)}:${dayIndex ?? 0}`;
}

function levelDurationMinutes(lv) {
  const val = typeof lv?.durationMinutes === 'number' ? lv.durationMinutes : lv?.duration;
  return typeof val === 'number' && val > 0 ? val : 20;
}

class LiveClockServiceImpl {
  constructor() {
    this._listeners = new Set();
    this._interval = null;
    this._lastTickAt = null;

    // Core
    this._tournament = null;
    this._tournamentId = null;
    this._dayIndex = 0;
    this._levels = [];

    // State
    this._status = 'not_started'; // 'running' | 'paused' | 'finished'
    this._currentLevelIndex = 0;
    this._remainingMs = 0;
    this._autoAdvance = true;
  }

  // Subscribe to live snapshots
  subscribe(listener) {
    this._listeners.add(listener);
    listener(this._snapshot());
    return () => this._listeners.delete(listener);
  }

  _emit() {
    const snap = this._snapshot();
    for (const l of this._listeners) {
      try { l(snap); } catch {}
    }
  }

  _snapshot() {
    return {
      tournament: this._tournament,
      tournamentId: this._tournamentId,
      dayIndex: this._dayIndex,
      levels: this._levels,
      status: this._status,
      currentLevelIndex: this._currentLevelIndex,
      remainingMs: this._remainingMs,
      autoAdvance: this._autoAdvance,
    };
  }

  getState() { return this._snapshot(); }
  getLevels() { return this._levels; }

  // Init / day selection
  async init({ tournament, dayIndex = 0 }) {
    const newId = tournament?._id || tournament?.id || tournament?.tournamentId || 'unknown';
    const same = this._tournamentId === newId && this._dayIndex === (dayIndex | 0);

    this._tournament = tournament || null;
    this._tournamentId = newId;
    this._dayIndex = Math.max(0, dayIndex | 0);
    this._levels = this._computeLevels();

    if (!same) {
      await this._loadFromStorage();
      this._ensureTicking();
      this._emit();
    } else {
      this._emit();
    }
  }

  _computeLevels() {
    const t = this._tournament;
    if (!t) return [];
    const hasDays = Array.isArray(t?.days) && t.days.length > 0;
    if (hasDays) {
      const idx = Math.min(Math.max(0, this._dayIndex), t.days.length - 1);
      return Array.isArray(t.days[idx]?.structure) ? t.days[idx].structure : [];
    }
    return Array.isArray(t?.structure) ? t.structure : [];
  }

  async setDay(dayIndex) {
    this._dayIndex = Math.max(0, dayIndex | 0);
    this._levels = this._computeLevels();
    await this._loadFromStorage();
    this._ensureTicking();
    this._emit();
  }

  // Storage
  async _loadFromStorage() {
    try {
      const key = storageKey(this._tournamentId, this._dayIndex);
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {
        this._status = 'paused';
        this._currentLevelIndex = 0;
        this._remainingMs = this._levelDurationMs(0);
        this._autoAdvance = true;
        return;
      }
      const saved = JSON.parse(raw);
      const safeIdx = typeof saved.currentLevelIndex === 'number'
        ? Math.min(Math.max(0, saved.currentLevelIndex), Math.max(0, this._levels.length - 1))
        : 0;
      this._status = saved.status ?? 'paused';
      this._currentLevelIndex = safeIdx;
      const dur = this._levelDurationMs(safeIdx);
      const left = typeof saved.millisLeft === 'number' ? Math.min(Math.max(0, saved.millisLeft), dur) : dur;
      this._remainingMs = left;
      this._autoAdvance = !!saved.autoAdvance;
    } catch {}
  }

  async _saveToStorage() {
    try {
      const key = storageKey(this._tournamentId, this._dayIndex);
      const toSave = {
        status: this._status,
        currentLevelIndex: this._currentLevelIndex,
        millisLeft: this._remainingMs,
        autoAdvance: this._autoAdvance,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(toSave));
    } catch {}
  }

  _levelDurationMs(idx) {
    if (!this._levels.length) return 0;
    const i = Math.min(Math.max(0, idx | 0), this._levels.length - 1);
    return levelDurationMinutes(this._levels[i]) * 60 * 1000;
  }

  // Ticking
  _ensureTicking() {
    if (this._status !== 'running') {
      this._clearInterval();
      return;
    }
    if (this._interval) return;
    this._lastTickAt = Date.now();
    this._interval = setInterval(() => this._onTick(), TICK_MS);
  }

  _onTick() {
    const now = Date.now();
    const delta = Math.max(0, now - (this._lastTickAt || now));
    this._lastTickAt = now;

    if (this._status !== 'running') {
      this._clearInterval();
      return;
    }

    const next = this._remainingMs - delta;
    if (next <= 0) {
      if (this._autoAdvance) {
        this._advanceLevelInternal(true);
      } else {
        this._remainingMs = 0;
        this._status = 'paused';
      }
    } else {
      this._remainingMs = next;
    }

    this._emit();
    this._saveToStorage();
  }

  _clearInterval() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
  }

  // Controls
  startOrResume() {
    if (!this._levels.length) return;
    if (this._status === 'finished') {
      this._currentLevelIndex = 0;
      this._remainingMs = this._levelDurationMs(0);
    }
    this._status = 'running';
    this._ensureTicking();
    this._emit();
    this._saveToStorage();
  }

  pause() {
    this._status = 'paused';
    this._clearInterval();
    this._emit();
    this._saveToStorage();
  }

  setLevel(idx, preserveRunning = false) {
    if (!this._levels.length) return;
    const clamped = Math.min(Math.max(0, idx | 0), this._levels.length - 1);
    this._currentLevelIndex = clamped;
    this._remainingMs = this._levelDurationMs(clamped);
    if (!preserveRunning) this._status = 'paused';
    this._ensureTicking();
    this._emit();
    this._saveToStorage();
  }

  nextLevel() { this._advanceLevelInternal(false, +1); }
  prevLevel() { this._advanceLevelInternal(false, -1); }

  _advanceLevelInternal(fromAuto, dir = 1) {
    if (!this._levels.length) return;
    let nextIdx = this._currentLevelIndex + dir;
    if (nextIdx >= this._levels.length) {
      this._status = 'finished';
      nextIdx = this._levels.length - 1;
    } else if (nextIdx < 0) {
      nextIdx = 0;
    }
    this._currentLevelIndex = nextIdx;
    this._remainingMs = this._levelDurationMs(nextIdx);
    if (!fromAuto) this._status = 'paused';
    this._ensureTicking();
    this._emit();
    this._saveToStorage();
  }

  addMinutes(delta) {
    const ms = (delta | 0) * 60 * 1000;
    this._remainingMs = Math.max(0, this._remainingMs + ms);
    this._emit();
    this._saveToStorage();
  }

  setPresetMs(ms) {
    this._remainingMs = Math.max(0, ms | 0);
    this._emit();
    this._saveToStorage();
  }

  setAutoAdvance(flag) {
    this._autoAdvance = !!flag;
    this._emit();
    this._saveToStorage();
  }
}

const LiveClockService = new LiveClockServiceImpl();
export default LiveClockService;
