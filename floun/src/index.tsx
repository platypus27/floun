import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@kryv/teal';
import '@kryv/teal/styles.css';
import App from './App';

const rootElement = document.getElementById('root') as HTMLElement; // Ensure the root element exists
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
