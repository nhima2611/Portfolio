import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { sceneState, startIntro } from './scene/state';
import './styles.css';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
sceneState.reducedMotion = reduce;
// Skip the intro for reduced motion, or when the page opens already scrolled / on a deep link.
startIntro(reduce || window.scrollY > 10 || window.location.hash.length > 1);
if (reduce) document.documentElement.classList.add('reduce-motion');
// Never leave the boot screen up if WebGL is slow or unavailable; App adds `booted` after the first frame.
window.setTimeout(() => document.documentElement.classList.add('booted'), 6000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
