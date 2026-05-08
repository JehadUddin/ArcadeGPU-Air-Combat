import React, { useEffect, useRef, useState } from 'react';
import { GameManager } from '../../game/GameManager';
import { MobileControls } from '../Package/MobileControls';

export function Scene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameManager, setGameManager] = useState<GameManager | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (canvasRef.current && !gameManager) {
      const manager = new GameManager(canvasRef.current);
      setGameManager(manager);
    }
    
    const handleLockChange = () => {
      setIsLocked(document.pointerLockElement !== null);
    };
    document.addEventListener('pointerlockchange', handleLockChange);
    
    return () => {
      document.removeEventListener('pointerlockchange', handleLockChange);
    };
  }, [canvasRef, gameManager]);

  return (
    <div 
      style={{ width: '100vw', height: '100vh', cursor: isLocked ? 'none' : 'pointer', position: 'relative' }}
      onClick={(e) => {
        if (!isLocked && !isMobile) {
          try {
            const promise = e.currentTarget.requestPointerLock() as unknown as Promise<void>;
            if (promise && promise.catch) {
              promise.catch((err) => console.warn("Pointer lock error:", err));
            }
          } catch (err) {
            console.warn("Pointer lock error:", err);
          }
        }
      }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      
      {/* UI Overlay */}
      {!isLocked && !isMobile && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
          color: 'white',
          fontFamily: 'sans-serif',
          pointerEvents: 'none',
          zIndex: 10
        }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Click to Play</h1>
          <p style={{ fontSize: '1.2rem' }}>WASD to move, SHIFT to sprint, SPACE to jump, E to enter/exit tank, MOUSE to look</p>
        </div>
      )}
      
      {/* Crosshair */}
      {(isLocked || isMobile) && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '4px',
          height: '4px',
          backgroundColor: 'rgba(255,255,255,0.8)',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 10
        }} />
      )}

      {/* Mobile Controls */}
      {isMobile && gameManager && (
        <MobileControls input={gameManager.input} />
      )}
    </div>
  );
}
