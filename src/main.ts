import '@adam0white/lab-kit/tokens.css';
import './ui/style.css';
import { initializeLab } from './ui/lab.ts';

// The public path selects preservation before App, Shelf or native-save startup.
initializeLab(location.pathname === '/file/' || location.pathname === '/file/index.html');
await import('./ui/app.ts');
