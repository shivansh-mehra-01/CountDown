import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import FlipClockCountdown from '@leenguyen/react-flip-clock-countdown';
import '@leenguyen/react-flip-clock-countdown/dist/index.css';
import RotatingEarth from './components/ui/wireframe-dotted-globe';
import './App.css';

const CURTAIN_OPEN_DURATION = 2800;

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

const SplashScreen = ({ onComplete, onFadeStart }) => {
  const [count, setCount] = useState(10);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setFade(true);
      if (onFadeStart) onFadeStart();
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    }
  }, [count, onComplete, onFadeStart]);

  return (
    <div className={`splash-screen dark ${fade ? 'fade-out' : ''}`}>
      {count > 0 && (
        <div className="splash-number" key={count}>
          {count}
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [curtainState, setCurtainState] = useState('closed');
  const [showSplash, setShowSplash] = useState(false);
  const [splashFadingOut, setSplashFadingOut] = useState(false);

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

  const appIsVisible = curtainState === 'open' && (!showSplash || splashFadingOut);

  const handleCurtainOpen = useCallback(() => {
    setCurtainState('open');
    setShowSplash(true);
  }, []);

  const handleFadeStart = useCallback(() => setSplashFadingOut(true), []);
  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  return (
    <>
      {curtainState !== 'open' && <CurtainScreen onOpen={handleCurtainOpen} />}
      {showSplash && (
        <SplashScreen
          onFadeStart={handleFadeStart}
          onComplete={handleSplashComplete}
        />
      )}
      <div
        className="app-container dark"
        style={{
          opacity: appIsVisible ? 1 : 0,
          transform: appIsVisible ? 'scale(1)' : 'scale(1.1)',
          transition:
            'opacity 2s ease-in-out, transform 2s cubic-bezier(0.2, 0.8, 0.2, 1)',
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
