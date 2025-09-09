import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Add SEO blocking meta tags dynamically
document.addEventListener('DOMContentLoaded', () => {
  // Ensure robots meta tag is present
  if (!document.querySelector('meta[name="robots"]')) {
    const robotsMeta = document.createElement('meta');
    robotsMeta.name = 'robots';
    robotsMeta.content = 'noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate';
    document.head.appendChild(robotsMeta);
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
