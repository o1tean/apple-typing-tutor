import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '../css/main.css';
import '../css/keyboard.css';
import '../css/hands.css';

createRoot(document.getElementById('root')).render(<App />);
