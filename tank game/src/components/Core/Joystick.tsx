import React, { useEffect, useRef, useState } from 'react';

interface JoystickProps {
  onMove: (x: number, y: number) => void;
  onEnd: () => void;
  position: 'left' | 'right';
}

export function Joystick({ onMove, onEnd, position }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const maxRadius = 40;
  
  const currentPos = useRef({ x: 0, y: 0 });
  const requestRef = useRef<number>();

  const updateLoop = () => {
    if (currentPos.current.x !== 0 || currentPos.current.y !== 0) {
      onMove(currentPos.current.x / maxRadius, currentPos.current.y / maxRadius);
    }
    requestRef.current = requestAnimationFrame(updateLoop);
  };

  useEffect(() => {
    if (active) {
      requestRef.current = requestAnimationFrame(updateLoop);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [active]);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    setActive(true);
    handleTouchMove(e, true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent, forceActive = false) => {
    if (!containerRef.current) return;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.targetTouches[0].clientX;
      clientY = e.targetTouches[0].clientY;
    } else {
      if (!active && !forceActive) return;
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    
    setKnobPos({ x: dx, y: dy });
    currentPos.current = { x: dx, y: dy };
  };

  const handleTouchEnd = () => {
    setActive(false);
    setKnobPos({ x: 0, y: 0 });
    currentPos.current = { x: 0, y: 0 };
    onEnd();
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      style={{
        position: 'absolute',
        bottom: '40px',
        [position === 'left' ? 'left' : 'right']: '40px',
        width: '120px',
        height: '120px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: '50px',
          height: '50px',
          backgroundColor: 'rgba(255, 255, 255, 0.5)',
          borderRadius: '50%',
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          transition: active ? 'none' : 'transform 0.2s ease-out',
        }}
      />
    </div>
  );
}
