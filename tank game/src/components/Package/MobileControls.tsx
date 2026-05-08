import React, { useEffect, useState } from 'react';
import { InputManager } from '../../../game/InputManager';
import { Joystick } from '../Core/Joystick';

interface MobileControlsProps {
  input: InputManager;
}

export function MobileControls({ input }: MobileControlsProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile) return null;

  const handleLeftJoystickMove = (x: number, y: number) => {
    input.keys['KeyW'] = y < -0.2;
    input.keys['KeyS'] = y > 0.2;
    input.keys['KeyA'] = x < -0.2;
    input.keys['KeyD'] = x > 0.2;
  };

  const handleLeftJoystickEnd = () => {
    input.keys['KeyW'] = false;
    input.keys['KeyS'] = false;
    input.keys['KeyA'] = false;
    input.keys['KeyD'] = false;
  };

  const handleRightJoystickMove = (x: number, y: number) => {
    input.mouseX -= x * 0.001;
    input.mouseY += y * 0.001;
    input.mouseY = Math.max(-Math.PI / 6, Math.min(Math.PI / 3, input.mouseY));
  };

  const handleRightJoystickEnd = () => {
    // Look joystick doesn't reset position, just stops moving
  };

  const ActionButton = ({ label, onDown, onUp, style }: any) => (
    <button
      onTouchStart={(e) => { e.preventDefault(); onDown(); }}
      onTouchEnd={(e) => { e.preventDefault(); onUp(); }}
      onTouchCancel={(e) => { e.preventDefault(); onUp(); }}
      onMouseDown={(e) => { e.preventDefault(); onDown(); }}
      onMouseUp={(e) => { e.preventDefault(); onUp(); }}
      onMouseLeave={(e) => { e.preventDefault(); onUp(); }}
      style={{
        width: '60px',
        height: '60px',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        border: '2px solid rgba(255, 255, 255, 0.5)',
        borderRadius: '50%',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
        zIndex: 100,
        ...style
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}>
      {/* Left Joystick for Movement */}
      <div style={{ pointerEvents: 'auto' }}>
        <Joystick position="left" onMove={handleLeftJoystickMove} onEnd={handleLeftJoystickEnd} />
      </div>

      {/* Right Joystick for Look */}
      <div style={{ pointerEvents: 'auto' }}>
        <Joystick position="right" onMove={handleRightJoystickMove} onEnd={handleRightJoystickEnd} />
      </div>

      {/* Action Buttons */}
      <div style={{ pointerEvents: 'auto' }}>
        <ActionButton 
          label="JUMP" 
          onDown={() => input.keys['Space'] = true} 
          onUp={() => input.keys['Space'] = false} 
          style={{ position: 'absolute', bottom: '180px', right: '40px' }} 
        />
        <ActionButton 
          label="RUN" 
          onDown={() => input.keys['ShiftLeft'] = true} 
          onUp={() => input.keys['ShiftLeft'] = false} 
          style={{ position: 'absolute', bottom: '110px', right: '110px' }} 
        />
        <ActionButton 
          label="FIRE" 
          onDown={() => input.mouseDown = true} 
          onUp={() => input.mouseDown = false} 
          style={{ position: 'absolute', bottom: '180px', left: '40px' }} 
        />
        <ActionButton 
          label="ENTER" 
          onDown={() => { input.keys['KeyE'] = true; input.interactPressed = true; }} 
          onUp={() => input.keys['KeyE'] = false} 
          style={{ position: 'absolute', top: '20px', right: '20px' }} 
        />
      </div>
    </div>
  );
}
