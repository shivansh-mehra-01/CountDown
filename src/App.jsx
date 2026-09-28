import React from 'react';
import FlipClockCountdown from '@leenguyen/react-flip-clock-countdown';
import '@leenguyen/react-flip-clock-countdown/dist/index.css';
import RotatingEarth from './components/ui/wireframe-dotted-globe';
import './App.css';

const App = () => {
  // Let's set the countdown to some duration from now (e.g. 1 hour 57 minutes as in image or just 1 hour)
  const targetTime = new Date().getTime() + 1000 * 60 * 60 * 2; // 2 hours from now

  return (
    <div className="app-container">
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-auto">
        <RotatingEarth width={window.innerWidth} height={window.innerHeight} />
      </div>

      <div className="z-10 pointer-events-none">
        <FlipClockCountdown
          to={targetTime}
          renderMap={[false, true, true, true]} // [days, hours, minutes, seconds]
          showLabels={false}
          separatorStyle={{ color: "#949494", size: "18px" }}
          digitBlockStyle={{
            width: 180,
            height: 220,
            fontSize: 180,
            color: "#949494",
            backgroundColor: "#1c1c1c",
            borderRadius: "20px",
          }}
          dividerStyle={{ color: "#141414", height: 2 }}
        />
      </div>
    </div>
  );
};

export default App;
