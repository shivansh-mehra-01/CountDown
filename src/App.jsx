import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import FlipClockCountdown from '@leenguyen/react-flip-clock-countdown';
import '@leenguyen/react-flip-clock-countdown/dist/index.css';
import RotatingEarth from './components/ui/wireframe-dotted-globe';
import './App.css';

const CURTAIN_OPEN_DURATION = 2800;
const COUNTDOWN_INTERVAL = 1000;
const COUNTDOWN_FADE_DURATION = 1000;
const WELCOME_ENTER_DURATION = 2000;
const WELCOME_HOLD_DURATION = 4500;
const WELCOME_EXIT_DURATION = 800;
const WELCOME_COMPLETE_DURATION = WELCOME_ENTER_DURATION + WELCOME_HOLD_DURATION + WELCOME_EXIT_DURATION;
const TRANSITION_TO_24H_DURATION = 1000;

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

const WelcomeScreen = ({ onComplete }) => {
  const [phase, setPhase] = useState('initial');

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase('entering'), 100);
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
      <div className="welcome-content">
        <h3 className="welcome-line-1">4th Edition</h3>
        <div className="welcome-divider">
          <span className="welcome-line" />
          <h4 className="welcome-line-2">of</h4>
          <span className="welcome-line" />
        </div>
        <h1 className="welcome-line-3">SISTec Innovation</h1>
        <h1 className="welcome-line-4">Hackathon</h1>
      </div>
    </div>
  );
};

const App = () => {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [phase, setPhase] = useState('CLOSED');

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

  useEffect(() => {
    if (phase === 'TRANSITION_TO_24H') {
      const timer = setTimeout(() => setPhase('24_HOUR_COUNTDOWN'), TRANSITION_TO_24H_DURATION);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const targetTime = useMemo(
    () => new Date().getTime() + 1000 * 60 * 60 * 24,
    []
  );

  const isMobile = dimensions.width < 768;
  const isTablet = dimensions.width < 1024;

  const clockSize = {
    width: isMobile ? 50 : isTablet ? 120 : 180,
    height: isMobile ? 70 : isTablet ? 160 : 220,
    fontSize: isMobile ? 50 : isTablet ? 120 : 180,
  };

  const showCurtains = phase === 'CLOSED' || phase === 'OPENING';
  const showCountdown = phase === 'COUNTDOWN';
  const showWelcome = phase === 'WELCOME';
  const show24H = phase === 'TRANSITION_TO_24H' || phase === '24_HOUR_COUNTDOWN';

  const handleCurtainOpen = useCallback(() => {
    setPhase('COUNTDOWN');
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setPhase('WELCOME');
  }, []);

  const handleWelcomeComplete = useCallback(() => {
    setPhase('TRANSITION_TO_24H');
  }, []);

  return (
    <>
      {showCurtains && <CurtainScreen onOpen={handleCurtainOpen} />}
      {showCountdown && <CountdownScreen onComplete={handleCountdownComplete} />}
      {showWelcome && <WelcomeScreen onComplete={handleWelcomeComplete} />}
      <div
        className="app-container dark"
        style={{
          opacity: show24H ? 1 : 0,
          transform: show24H ? 'scale(1)' : 'scale(1.1)',
          transition: 'opacity 2s ease-in-out, transform 2s cubic-bezier(0.2, 0.8, 0.2, 1)',
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
            to={targetTime}
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
