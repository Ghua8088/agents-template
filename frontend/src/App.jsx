import React, { useState, useEffect } from 'react';
import pytron from 'pytron-client';
import './index.css';
import { PytronTitleBar, ThemeProvider } from 'pytron-ui/react';
import Chat from './components/Chat';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';

function App() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const handleAiEvent = (e) => {
      const data = e.detail || {};
      if (data.type === 'token') {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.isFinished) {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, content: lastMsg.content + data.content }
            ];
          } else {
            return [...prev, { id: Date.now().toString(), role: 'assistant', content: data.content }];
          }
        });
      } else if (data.type === 'finish' || data.type === 'error') {
        setIsTyping(false);
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, isFinished: true }
            ];
          }
          return prev;
        });
      }
    };

    window.addEventListener('ai_agent_event', handleAiEvent);
    return () => window.removeEventListener('ai_agent_event', handleAiEvent);
  }, []);

  const handleSendMessage = async (text) => {
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsTyping(true);

    try {
      await pytron.stream_ask(text);
    } catch (err) {
      console.error(err);
      setIsTyping(false);
    }
  };

  const handleStop = () => {
    pytron.stop_generation();
    setIsTyping(false);
  };

  const currentTheme = {
    bg: 'var(--bg-color)',
    fg: 'var(--fg-color)',
    primary: 'var(--accent-color)',
    secondary: 'var(--secondary-bg)',
    accent: 'var(--accent-color)',
    buttonBg: 'var(--accent-color)',
    buttonFg: 'var(--accent-fg)'
  };

  return (
    <ThemeProvider theme={currentTheme}>
      <div className="app-wrapper">
        <PytronTitleBar title="Agents Template" variant="windows" onClose={() => window.close()} />
        <div className="main-content">
          <Sidebar onOpenSettings={() => setIsSettingsOpen(true)} />
          <Chat 
            messages={messages} 
            onSendMessage={handleSendMessage} 
            isTyping={isTyping} 
            onStop={handleStop} 
          />
        </div>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    </ThemeProvider>
  );
}

export default App;
