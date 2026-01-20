/**
 * Chat Window Entry Point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWindow from './ChatWindow';
import '../styles/index.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChatWindow />
  </React.StrictMode>
);
