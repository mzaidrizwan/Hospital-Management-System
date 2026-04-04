// lib/electron.ts
export const isElectron = () => {
  return typeof window !== 'undefined' && 
    (window.process?.type === 'renderer' || 
     navigator.userAgent.includes('Electron'));
};

// Usage in components if needed
if (isElectron()) {
  console.log('Running in Electron desktop app');
}