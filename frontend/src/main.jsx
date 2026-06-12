import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'highlight.js/styles/atom-one-dark.css'
import 'katex/dist/katex.min.css';
import './index.css'
import App from './App.jsx'
import { ToastProvider } from 'pytron-ui/react';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
