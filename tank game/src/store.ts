import * as THREE from 'three';
import { useState, useEffect } from 'react';

class GameStore {
  isPlayerInTank: boolean = false;
  tankPosition: THREE.Vector3 = new THREE.Vector3(0, 0, -10);
  playerPosition: THREE.Vector3 = new THREE.Vector3(0, 5, 0);
  
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  setPlayerInTank(value: boolean) {
    this.isPlayerInTank = value;
    this.notify();
  }

  setTankPosition(pos: THREE.Vector3) {
    this.tankPosition.copy(pos);
    this.notify();
  }

  setPlayerPosition(pos: THREE.Vector3) {
    this.playerPosition.copy(pos);
    this.notify();
  }

  getState() {
    return this;
  }
}

const store = new GameStore();

export const useGameStore = () => {
  const [state, setState] = useState(store.getState());

  useEffect(() => {
    return store.subscribe(() => {
      setState({ ...store.getState() } as GameStore);
    });
  }, []);

  return {
    isPlayerInTank: store.isPlayerInTank,
    setPlayerInTank: (val: boolean) => store.setPlayerInTank(val),
    tankPosition: store.tankPosition,
    setTankPosition: (pos: THREE.Vector3) => store.setTankPosition(pos),
    playerPosition: store.playerPosition,
    setPlayerPosition: (pos: THREE.Vector3) => store.setPlayerPosition(pos),
  };
};

// Add getState to useGameStore for imperative access
useGameStore.getState = () => store.getState();
