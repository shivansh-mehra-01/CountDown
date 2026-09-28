import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import FlipClockCountdown from '@leenguyen/react-flip-clock-countdown';
import '@leenguyen/react-flip-clock-countdown/dist/index.css';
import RotatingEarth from './components/ui/wireframe-dotted-globe';
import './App.css';

// === CONSTANTS ===
const CURTAIN_OPEN_DURATION = 2800;
const WELCOME_ENTER_DURATION = 800;
const WELCOME_HOLD_DURATION = 1700;
const WELCOME_EXIT_DURATION = 700;
const WELCOME_COMPLETE_DURATION = WELCOME_ENTER_DURATION + WELCOME_HOLD_DURATION + WELCOME_EXIT_DURATION;
const COUNTDOWN_INTERVAL = 1000;
const COUNTDOWN_FADE_DURATION = 1000;
const EVENT_TITLE_ENTER_DURATION = 2000;
const EVENT_TITLE_HOLD_DURATION = 4500;
const EVENT_TITLE_EXIT_DURATION = 800;
const EVENT_TITLE_COMPLETE_DURATION = EVENT_TITLE_ENTER_DURATION + EVENT_TITLE_HOLD_DURATION + EVENT_TITLE_EXIT_DURATION;
const TRANSITION_TO_24H_DURATION = 1000;

const PHASES = {
  CLOSED_CURTAIN: 'CLOSED_CURTAIN',
  CURTAIN_OPENING: 'CURTAIN_OPENING',
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

const STORAGE_KEY = 'hackathon_event_state';

// === PERSISTENCE LAYER ===
// Isolated so it can be replaced with an API call later
function loadEventState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load event state:', e);
  }
  return null;
}

function saveEventState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save event state:', e);
  }
}

function clearEventState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear event state:', e);
  }
}

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

// === CURTAIN SCREEN ===
const CurtainScreen = ({ onOpen }) => {
  const [opening, setOpening] = useState(false);
  const timeoutRef = useRef(null);

  const handleClick = useCallback(() => {
    if (opening) return;
    setOpening(true);
    timeoutRef.current = setTimeout(() => {
      onOpen();
    }, CURTAIN_OPEN_DURATION);
  }, [opening, onOpen]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`curtain-stage ${opening ? 'curtain-opening' : ''}`}
      onClick={handleClick}
      role="button"
      aria-label="Open curtains to begin the show"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="curtain-left">
        <div className="curtain-fabric" />
      </div>
      <div className="curtain-right">
        <div className="curtain-fabric" />
      </div>
      <div className="stage-reveal" />
      <div className="curtain-seam" />
      <div className="curtain-click-hint" aria-hidden="true">
        <span>Click to Begin</span>
      </div>
    </div>
  );
};

// === WELCOME SCREEN ===
const WelcomeScreen = ({ onComplete }) => {
  const [phase, setPhase] = useState('initial');

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase('entering'), 200);
    const holdTimer = setTimeout(() => setPhase('holding'), WELCOME_ENTER_DURATION);
    const exitTimer = setTimeout(() => setPhase('exiting'), WELCOME_ENTER_DURATION + WELCOME_HOLD_DURATION);
    const completeTimer = setTimeout(onComplete, WELCOME_COMPLETE_DURATION);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`welcome-screen ${phase}`}>
      <div className="welcome-light" />
      <div className="welcome-text">Welcome</div>
    </div>
  );
};

// === COUNTDOWN SCREEN ===
const CountdownScreen = ({ onComplete }) => {
  const [count, setCount] = useState(10);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (count > 0) {
      const timer = setTimeout(() => setCount(count - 1), COUNTDOWN_INTERVAL);
      return () => clearTimeout(timer);
    } else {
      setFade(true);
      const timer = setTimeout(onComplete, COUNTDOWN_FADE_DURATION);
      return () => clearTimeout(timer);
    }
  }, [count, onComplete]);

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
const EventTitleScreen = ({ onComplete }) => {
  const [phase, setPhase] = useState('initial');

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase('entering'), 100);
    const holdTimer = setTimeout(() => setPhase('holding'), EVENT_TITLE_ENTER_DURATION);
    const exitTimer = setTimeout(() => setPhase('exiting'), EVENT_TITLE_ENTER_DURATION + EVENT_TITLE_HOLD_DURATION);
    const completeTimer = setTimeout(onComplete, EVENT_TITLE_COMPLETE_DURATION);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

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

  const [phase, setPhase] = useState(PHASES.CLOSED_CURTAIN);
  const [eventState, setEventState] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showSetCountdown, setShowSetCountdown] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    const saved = loadEventState();
    if (saved && saved.phase === PHASES.COUNTDOWN_24H && saved.status === STATUS.RUNNING) {
      setEventState(saved);
      setPhase(PHASES.COUNTDOWN_24H);
    }
  }, []);

  // Calculate remaining time
  useEffect(() => {
    if (eventState && eventState.status === STATUS.RUNNING && eventState.endAt) {
      const updateRemaining = () => {
        const rem = calculateRemaining(eventState.endAt);
        setRemaining(rem);
        if (rem.remainingMs <= 0) {
          setEventState((prev) => ({ ...prev, status: STATUS.COMPLETED }));
          setPhase(PHASES.COMPLETED);
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

  const showCurtains = phase === PHASES.CLOSED_CURTAIN || phase === PHASES.CURTAIN_OPENING;
  const showWelcome = phase === PHASES.WELCOME;
  const showCountdown = phase === PHASES.COUNTDOWN_10;
  const showEventTitle = phase === PHASES.EVENT_TITLE;
  const show24H = phase === PHASES.COUNTDOWN_24H || phase === PHASES.COMPLETED;

  const handleCurtainOpen = useCallback(() => {
    setPhase(PHASES.WELCOME);
  }, []);

  const handleWelcomeComplete = useCallback(() => {
    setPhase(PHASES.COUNTDOWN_10);
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setPhase(PHASES.EVENT_TITLE);
  }, []);

  const handleEventTitleComplete = useCallback(() => {
    setPhase('TRANSITION_TO_24H');
  }, []);

  const handleSetCountdown = useCallback((hours, minutes, seconds) => {
    const durationMs = (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
    const startedAt = Date.now();
    const endAt = startedAt + durationMs;
    const newState = {
      phase: PHASES.COUNTDOWN_24H,
      status: STATUS.RUNNING,
      startedAt,
      endAt,
      durationMs,
    };
    setEventState(newState);
    saveEventState(newState);
    setPhase(PHASES.COUNTDOWN_24H);
    setShowSetCountdown(false);
    setShowAdminPanel(false);
  }, []);

  const handleResetCountdown = useCallback(() => {
    clearEventState();
    setEventState(null);
    setRemaining(null);
    setPhase(PHASES.CLOSED_CURTAIN);
    setShowResetConfirm(false);
    setShowAdminPanel(false);
  }, []);

  return (
    <>
      {showCurtains && <CurtainScreen onOpen={handleCurtainOpen} />}
      {showWelcome && <WelcomeScreen onComplete={handleWelcomeComplete} />}
      {showCountdown && <CountdownScreen onComplete={handleCountdownComplete} />}
      {showEventTitle && <EventTitleScreen onComplete={handleEventTitleComplete} />}

      {showAdminPanel && (
        <AdminPanel
          eventState={eventState}
          remaining={remaining}
          onSetCountdown={() => setShowSetCountdown(true)}
          onResetCountdown={() => setShowResetConfirm(true)}
          onClose={() => setShowAdminPanel(false)}
        />
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
          <FlipClockCountdown
            to={eventState?.endAt || Date.now() + 1000 * 60 * 60 * 24}
            renderMap={[false, true, true, true]}
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
        </div>
      </div>
    </>
  );
};

export default App;
