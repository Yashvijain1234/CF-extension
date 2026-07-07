import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import '@/styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div className="cf-leetmode-root cf-lm-dark">
      <Popup />
    </div>
  </StrictMode>,
);
