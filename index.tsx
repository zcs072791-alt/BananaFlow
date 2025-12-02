import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Robust error suppression for ResizeObserver loops
// These errors are generally benign in React applications using ResizeObserver
const resizeObserverLoopErr = /ResizeObserver loop limit exceeded|ResizeObserver loop completed with undelivered notifications/;

const originalError = console.error;
console.error = (...args) => {
  if (args.length > 0) {
    // Check if any argument matches the error pattern
    const isResizeError = args.some(arg => {
      if (typeof arg === 'string') return resizeObserverLoopErr.test(arg);
      if (arg instanceof Error) return resizeObserverLoopErr.test(arg.message);
      return false;
    });

    if (isResizeError) return;
  }
  originalError.apply(console, args);
};

// Handle global error events via addEventListener
const errorHandler = (e: ErrorEvent) => {
  const msg = e.message || (e.error && e.error.message) || '';
  if (typeof msg === 'string' && resizeObserverLoopErr.test(msg)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
};
window.addEventListener('error', errorHandler);

// Handle global errors via window.onerror (for wider browser support on this specific error)
window.onerror = function(message, source, lineno, colno, error) {
  const msg = message.toString();
  if (resizeObserverLoopErr.test(msg)) {
    return true; // Return true to suppress the error
  }
  return false;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);