import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import FlipClockCountdown from '@leenguyen/react-flip-clock-countdown';
import '@leenguyen/react-flip-clock-countdown/dist/index.css';
import RotatingEarth from './components/ui/wireframe-dotted-globe';
import './App.css';

// === CONSTANTS ===
const CURTAIN_OPEN_DURATION = 2800;
const WELCOME_HOLD_DURATION = 3000;
const EVENT_TITLE_ENTER_DURATION = 2000;
const EVENT_TITLE_HOLD_DURATION = 4500;
const EVENT_TITLE_EXIT_DURATION = 800;
const EVENT_TITLE_COMPLETE_DURATION = EVENT_TITLE_ENTER_DURATION + EVENT_TITLE_HOLD_DURATION + EVENT_TITLE_EXIT_DURATION;
const COUNTDOWN_INTERVAL = 1000;
const COUNTDOWN_FADE_DURATION = 1000;
const TRANSITION_TO_24H_DURATION = 1000;

const PHASES = {
  INITIALIZING: 'INITIALIZING',
  CLOSED: 'CLOSED',
  OPENING: 'OPENING',
  WELCOME: 'WELCOME',
  COUNTDOWN_10: 'COUNTDOWN_10',
  EVENT_TITLE: 'EVENT_TITLE',
  COUNTDOWN_24H: 'COUNTDOWN_24H',
  COMPLETED: 'COMPLETED',
};

const STATUS = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
};


// === AUDIO SYSTEM ===
class AudioManager {
  constructor() {
    this.sounds = {};
    this.initialized = false;
  }

  init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.sounds.curtain = new Audio('/audio/curtain-whoosh.wav');
    this.sounds.curtain.volume = 0.6;

    this.sounds.countdown10s = new Audio('/audio/10-seconds-countdown-sound.mpeg');
    this.sounds.countdown10s.volume = 0.6;

    this.sounds.hooter = new Audio('/audio/hooter-sound.mp3');
    this.sounds.hooter.volume = 1.0;

    this.sounds.ambient = new Audio('/audio/background-sound.mp3');
    this.sounds.ambient.volume = 0.12;
    this.sounds.ambient.loop = true;

    this.sounds.hooter.addEventListener('ended', () => {
      this.play('ambient');
    });

    this.initialized = true;
  }

  play(soundName) {
    if (!this.initialized) this.init();
    if (!this.sounds[soundName]) return;
    try {
      this.sounds[soundName].currentTime = 0;
      this.sounds[soundName].play().catch(e => console.warn(`Audio play failed for ${soundName}:`, e));
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  }

  stopAll() {
    if (!this.initialized) return;
    Object.values(this.sounds).forEach(sound => {
      if (sound) {
        sound.pause();
        sound.currentTime = 0;
      }
    });
  }
}

const audioManager = new AudioManager();

// === HELPER FUNCTIONS ===
function calculateRemaining(endAt) {
  const remainingMs = Math.max(0, endAt - Date.now());
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
  return { remainingMs, hours, minutes, seconds };
}

function formatTime(hours, minutes, seconds) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return date.toLocaleString();
}

// === ADMIN PANEL ===
const AdminPanel = ({ eventState, remaining, onSetCountdown, onResetCountdown, onClose }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[100000] w-72 rounded-xl border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">Event Control</h3>
        <button onClick={onClose} className="text-white/40 transition hover:text-white/80">✕</button>
      </div>

      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Status</span>
          <span className={`flex items-center gap-1.5 text-xs font-medium ${eventState?.status === 'RUNNING' ? 'text-green-400' : 'text-white/50'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${eventState?.status === 'RUNNING' ? 'bg-green-400' : 'bg-white/30'}`} />
            {eventState?.status || 'IDLE'}
          </span>
        </div>

        {eventState?.status === 'RUNNING' && remaining && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Remaining</span>
              <span className="font-mono text-sm font-medium text-white">
                {formatTime(remaining.hours, remaining.minutes, remaining.seconds)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Ends</span>
              <span className="text-xs text-white/70">{formatDateTime(eventState.endAt)}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSetCountdown}
          className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20"
        >
          Set Countdown
        </button>
        <button
          onClick={onResetCountdown}
          className="flex-1 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/30"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

// === SET COUNTDOWN MODAL ===
const SetCountdownModal = ({ onCancel, onStart }) => {
  const [hours, setHours] = useState(24);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');

  const presets = [
    { label: '5 MIN', hours: 0, minutes: 5, seconds: 0 },
    { label: '10 MIN', hours: 0, minutes: 10, seconds: 0 },
    { label: '30 MIN', hours: 0, minutes: 30, seconds: 0 },
    { label: '1 HOUR', hours: 1, minutes: 0, seconds: 0 },
    { label: '6 HOURS', hours: 6, minutes: 0, seconds: 0 },
    { label: '12 HOURS', hours: 12, minutes: 0, seconds: 0 },
    { label: '24 HOURS', hours: 24, minutes: 0, seconds: 0 },
  ];

  const handleStart = () => {
    if (hours < 0 || minutes < 0 || seconds < 0) {
      setError('Values cannot be negative');
      return;
    }
    if (minutes >= 60) {
      setError('Minutes must be less than 60');
      return;
    }
    if (seconds >= 60) {
      setError('Seconds must be less than 60');
      return;
    }
    if (hours === 0 && minutes === 0 && seconds === 0) {
      setError('Duration must be greater than 0');
      return;
    }
    onStart(hours, minutes, seconds);
  };

  return (
    <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-white">Set Event Countdown</h2>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-white/50">Hours</label>
            <input
              type="number"
              min="0"
              max="99"
              value={hours}
              onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-white outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Minutes</label>
            <input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-white outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Seconds</label>
            <input
              type="number"
              min="0"
              max="59"
              value={seconds}
              onChange={(e) => setSeconds(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-white outline-none focus:border-white/30"
            />
          </div>
        </div>

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <div className="mb-4 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setHours(preset.hours);
                setMinutes(preset.minutes);
                setSeconds(preset.seconds);
                setError('');
              }}
              className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Start Countdown
          </button>
        </div>
      </div>
    </div>
  );
};

// === RESET CONFIRMATION ===
const ResetConfirmation = ({ onCancel, onConfirm }) => {
  return (
    <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="mb-2 text-lg font-semibold text-white">Reset Event?</h2>
        <p className="mb-6 text-sm text-white/60">
          This will restart the entire opening sequence from the beginning.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500"
          >
            Reset Event
          </button>
        </div>
      </div>
    </div>
  );
};

// === CURTAIN SCREEN (with WELCOME behind) ===
const CurtainScreen = ({ onOpen, cinematicStartedAt, children }) => {
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (cinematicStartedAt) {
      const elapsed = Date.now() - cinematicStartedAt;
      if (elapsed < CURTAIN_OPEN_DURATION) {
        setOpening(true);
        if (elapsed < 100) {
          audioManager.init();
          audioManager.play('curtain');
        }
        const timer = setTimeout(onOpen, Math.max(0, CURTAIN_OPEN_DURATION - elapsed));
        return () => clearTimeout(timer);
      }
    }
  }, [cinematicStartedAt, onOpen]);

  return (
    <div className={`curtain-stage ${opening ? 'curtain-opening' : ''}`}>
      {children}
      <div className="curtain-left">
        <div className="curtain-fabric" />
      </div>
      <div className="curtain-right">
        <div className="curtain-fabric" />
      </div>
      <div className="stage-reveal" />
      <div className="curtain-seam" />
    </div>
  );
};

// === COUNTDOWN SCREEN ===
const CountdownScreen = ({ onComplete, cinematicStartedAt }) => {
  const [count, setCount] = useState(() => {
    if (cinematicStartedAt) {
      const elapsed = Date.now() - cinematicStartedAt - 5800; // Countdown starts at 5.8s
      if (elapsed > 0) {
        return Math.max(1, 10 - Math.floor(elapsed / 1000));
      }
    }
    return 10;
  });
  const [fade, setFade] = useState(false);
  const audioStartedRef = useRef(false);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!startTimeRef.current) {
      if (cinematicStartedAt && count < 10) {
        const expectedElapsed = (10 - count) * COUNTDOWN_INTERVAL;
        startTimeRef.current = Date.now() - expectedElapsed;
      } else {
        startTimeRef.current = Date.now();
      }
    }

    if (count === 10 && !audioStartedRef.current) {
      audioStartedRef.current = true;
      audioManager.play('countdown10s');
    } else if (cinematicStartedAt && count < 10 && !audioStartedRef.current) {
      audioStartedRef.current = true; // Skip audio start if late join
    }

    if (count > 0) {
      const elapsed = Date.now() - startTimeRef.current;
      const targetElapsed = (11 - count) * COUNTDOWN_INTERVAL;
      const delay = Math.max(0, targetElapsed - elapsed);

      const timer = setTimeout(() => setCount(count - 1), delay);
      return () => clearTimeout(timer);
    } else {
      setFade(true);
      audioManager.play('hooter');
      const timer = setTimeout(onComplete, COUNTDOWN_FADE_DURATION);
      return () => clearTimeout(timer);
    }
  }, [count, onComplete, cinematicStartedAt]);

  return (
    <div className={`countdown-screen ${fade ? 'fade-out' : ''}`}>
      {count > 0 && (
        <div className="countdown-number" key={count}>
          {count}
        </div>
      )}
    </div>
  );
};

// === EVENT TITLE SCREEN ===
const EventTitleScreen = ({ onComplete, cinematicStartedAt }) => {
  const [phase, setPhase] = useState(() => {
    if (cinematicStartedAt) {
      const elapsed = Date.now() - cinematicStartedAt - 16800; // Starts at 16.8s
      if (elapsed > EVENT_TITLE_ENTER_DURATION + EVENT_TITLE_HOLD_DURATION) return 'exiting';
      if (elapsed > EVENT_TITLE_ENTER_DURATION) return 'holding';
      if (elapsed > 0) return 'entering';
    }
    return 'initial';
  });

  useEffect(() => {
    let offset = 0;
    if (cinematicStartedAt) {
      offset = Math.max(0, Date.now() - cinematicStartedAt - 16800);
    }

    const delay = 100;
    const enterDelay = Math.max(0, delay - offset);
    const holdDelay = Math.max(0, delay + EVENT_TITLE_ENTER_DURATION - offset);
    const exitDelay = Math.max(0, delay + EVENT_TITLE_ENTER_DURATION + EVENT_TITLE_HOLD_DURATION - offset);
    const completeDelay = Math.max(0, delay + EVENT_TITLE_COMPLETE_DURATION - offset);

    const enterTimer = setTimeout(() => setPhase('entering'), enterDelay);
    const holdTimer = setTimeout(() => setPhase('holding'), holdDelay);
    const exitTimer = setTimeout(() => setPhase('exiting'), exitDelay);
    const completeTimer = setTimeout(onComplete, completeDelay);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, cinematicStartedAt]);

  return (
    <div className={`event-title-screen ${phase}`}>
      <div className="event-title-light" />
      <div className="event-title-content">
        <h3 className="event-title-line-1">4th Edition</h3>
        <div className="event-title-divider">
          <span className="event-title-line" />
          <h4 className="event-title-line-2">of</h4>
          <span className="event-title-line" />
        </div>
        <h1 className="event-title-line-3">SISTec Innovation</h1>
        <h1 className="event-title-line-4">Hackathon</h1>
      </div>
    </div>
  );
};

// === MAIN APP ===
const App = () => {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [phase, setPhase] = useState(PHASES.INITIALIZING);
  const [eventState, setEventState] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showSetCountdown, setShowSetCountdown] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [defaultTargetTime, setDefaultTargetTime] = useState(null);

  // Load persisted state from API on mount
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('/api/countdown');
        if (res.ok) {
          const saved = await res.json();
          if (saved && saved.status) {
            setEventState(saved);
            
            if (saved.status === STATUS.RUNNING || saved.status === STATUS.COMPLETED) {
              if (saved.phase === PHASES.COUNTDOWN_24H || saved.phase === PHASES.COMPLETED) {
                setPhase(saved.phase);
                return;
              }

              if (saved.cinematicStartedAt) {
                const elapsed = Date.now() - saved.cinematicStartedAt;
                
                // Timeline:
                // OPENING: 0 - 2800
                // WELCOME: 2800 - 5800
                // COUNTDOWN_10: 5800 - 16800
                // EVENT_TITLE: 16800 - 24100
                // TRANSITION: 24100 - 25100
                // COUNTDOWN_24H: > 25100
                
                if (elapsed < 2800) {
                  setPhase(PHASES.OPENING);
                } else if (elapsed < 5800) {
                  setPhase(PHASES.WELCOME);
                } else if (elapsed < 16800) {
                  setPhase(PHASES.COUNTDOWN_10);
                } else if (elapsed < 24100) {
                  setPhase(PHASES.EVENT_TITLE);
                } else {
                  setPhase(PHASES.COUNTDOWN_24H);
                }
                return;
              } else {
                 setPhase(saved.phase || PHASES.CLOSED);
                 return;
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to load event state from API:', e);
      }
      setPhase(PHASES.CLOSED);
    };
    fetchState();
  }, []);

  // Calculate remaining time
  useEffect(() => {
    if (eventState && eventState.status === STATUS.RUNNING && eventState.endAt) {
      const updateRemaining = () => {
        const rem = calculateRemaining(eventState.endAt);
        setRemaining(rem);
        if (rem.remainingMs <= 0) {
          setEventState((prev) => ({ ...prev, status: STATUS.COMPLETED }));
          setPhase((prevPhase) => {
            if (prevPhase === PHASES.COUNTDOWN_24H || prevPhase === 'TRANSITION_TO_24H') {
              return PHASES.COMPLETED;
            }
            return prevPhase;
          });
        }
      };
      updateRemaining();
      const interval = setInterval(updateRemaining, 250);
      return () => clearInterval(interval);
    }
  }, [eventState]);

  // Keyboard shortcut for admin panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setShowAdminPanel((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Welcome hold timer
  useEffect(() => {
    if (phase === PHASES.WELCOME) {
      const timer = setTimeout(() => setPhase(PHASES.COUNTDOWN_10), WELCOME_HOLD_DURATION);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Transition to 24H countdown
  useEffect(() => {
    if (phase === 'TRANSITION_TO_24H') {
      const timer = setTimeout(() => setPhase(PHASES.COUNTDOWN_24H), TRANSITION_TO_24H_DURATION);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const isMobile = dimensions.width < 768;
  const isTablet = dimensions.width < 1024;

  const clockSize = {
    width: isMobile ? 50 : isTablet ? 120 : 180,
    height: isMobile ? 70 : isTablet ? 160 : 220,
    fontSize: isMobile ? 50 : isTablet ? 120 : 180,
  };

  const showCurtains = phase === PHASES.CLOSED || phase === PHASES.OPENING || phase === PHASES.WELCOME;
  const showCountdown = phase === PHASES.COUNTDOWN_10;
  const showEventTitle = phase === PHASES.EVENT_TITLE;
  const show24H = phase === 'TRANSITION_TO_24H' || phase === PHASES.COUNTDOWN_24H || phase === PHASES.COMPLETED;

  useEffect(() => {
    if (show24H && !defaultTargetTime && !eventState) {
      setDefaultTargetTime(Date.now() + 1000 * 60 * 60 * 24);
    }
  }, [show24H, defaultTargetTime, eventState]);

  const handleCurtainOpen = useCallback(() => {
    setPhase(PHASES.WELCOME);
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setPhase(PHASES.EVENT_TITLE);
  }, []);

  const handleEventTitleComplete = useCallback(() => {
    setPhase('TRANSITION_TO_24H');
  }, []);

  const handleSetCountdown = useCallback(async (hours, minutes, seconds) => {
    const durationMs = (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
    
    try {
      const res = await fetch('/api/countdown/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMs })
      });
      if (res.ok) {
        const newState = await res.json();
        setEventState(newState);
        
        setPhase((prevPhase) => {
          if (prevPhase === PHASES.COMPLETED || prevPhase === PHASES.COUNTDOWN_24H || prevPhase === 'TRANSITION_TO_24H') {
            return PHASES.COUNTDOWN_24H;
          }
          return prevPhase;
        });
      }
    } catch (err) {
      console.error('Failed to set countdown via API', err);
    }

    setShowSetCountdown(false);
    setShowAdminPanel(false);
  }, []);

  const handleResetCountdown = useCallback(async () => {
    audioManager.stopAll();
    
    try {
      const res = await fetch('/api/countdown/reset', { method: 'POST' });
      if (res.ok) {
        const newState = await res.json();
        setEventState(newState);
        audioManager.init();
        audioManager.play('curtain');
        setRemaining(null);
        setPhase(PHASES.OPENING); 
      }
    } catch (err) {
      console.error('Failed to reset countdown via API', err);
    }

    setShowResetConfirm(false);
    setShowAdminPanel(false);
  }, []);

  return (
    <>
      {showCurtains && (
        <CurtainScreen onOpen={handleCurtainOpen} cinematicStartedAt={eventState?.cinematicStartedAt}>
          <div className="welcome-text">WELCOME</div>
        </CurtainScreen>
      )}

      {showEventTitle && <EventTitleScreen onComplete={handleEventTitleComplete} cinematicStartedAt={eventState?.cinematicStartedAt} />}
      {showCountdown && <CountdownScreen onComplete={handleCountdownComplete} cinematicStartedAt={eventState?.cinematicStartedAt} />}

      {showAdminPanel && (
        <AdminPanel
          eventState={eventState}
          remaining={remaining}
          onSetCountdown={() => setShowSetCountdown(true)}
          onResetCountdown={() => setShowResetConfirm(true)}
          onClose={() => setShowAdminPanel(false)}
        />
      )}

      {!showAdminPanel && phase !== PHASES.INITIALIZING && (
        <button
          onClick={() => setShowAdminPanel(true)}
          className="fixed bottom-4 right-4 z-[99999] flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white/40 opacity-40 transition-all hover:bg-black/60 hover:text-white/80 hover:opacity-100"
          aria-label="Organizer Control"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </button>
      )}

      {showSetCountdown && (
        <SetCountdownModal
          onCancel={() => setShowSetCountdown(false)}
          onStart={handleSetCountdown}
        />
      )}

      {showResetConfirm && (
        <ResetConfirmation
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={handleResetCountdown}
        />
      )}

      <div
        className="app-container dark"
        style={{
          opacity: show24H ? 1 : 0,
          transform: show24H ? 'scale(1)' : 'scale(1.1)',
          transition: 'opacity 2s ease-in-out, transform 2s cubic-bezier(0.2, 0.8, 0.2, 1)',
          pointerEvents: show24H ? 'auto' : 'none',
        }}
      >
        <div className="absolute inset-0 z-0 pointer-events-auto transition-all duration-700 opacity-60 mix-blend-screen">
          <RotatingEarth theme="dark" />
        </div>
        <div
          className="z-10 pointer-events-none"
          style={{
            padding: '0 20px',
            maxWidth: '100%',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {(eventState?.endAt || defaultTargetTime) && (
            <FlipClockCountdown
              to={eventState?.endAt || defaultTargetTime}
              renderMap={[false, true, true, true]} // [days, hours, minutes, seconds]
              showLabels={false}
              separatorStyle={{ color: "#949494", size: isMobile ? "12px" : "18px" }}
              digitBlockStyle={{
                width: clockSize.width,
                height: clockSize.height,
                fontSize: clockSize.fontSize,
                color: "#949494",
                backgroundColor: "#1c1c1c",
                borderRadius: isMobile ? "10px" : "20px",
                boxShadow: "none",
              }}
              dividerStyle={{ color: "#141414", height: 1 }}
            />
          )}
        </div>

        {/* Secondary Event Branding */}
        <div className="event-branding-container z-10 pointer-events-none">
          <div className="si-monogram">
            <div className="si-ribbon-1"></div>
            <div className="si-ribbon-2"></div>
            <div className="si-ribbon-3"></div>
          </div>
          <div className="event-branding-text">
            SISTec Innovation Hackathon
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
