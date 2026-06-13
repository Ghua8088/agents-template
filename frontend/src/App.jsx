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
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);

  useEffect(() => {
    pytron.list_chats().then(res => {
      setChats(res || []);
    }).catch(console.error);
  }, []);

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
      } else if (data.type === 'tool_start') {
        setMessages(prev => [
          ...prev, 
          { id: Date.now().toString(), role: 'tool', content: `🛠️ Using tool: \`${data.tool}\`...`, isFinished: false }
        ]);
      } else if (data.type === 'tool_end') {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'tool') {
             const outputText = data.output ? `\n\n<details class="tool-result-block"><summary>View Output</summary>\n\n\`\`\`\n${data.output}\n\`\`\`\n\n</details>` : '';
             return [
               ...prev.slice(0, -1),
               { ...lastMsg, content: `✅ Finished using: \`${data.tool}\`${outputText}`, isFinished: true }
             ];
          }
          return prev;
        });
      } else if (data.type === 'error') {
        setIsTyping(false);
        setMessages(prev => [
          ...prev, 
          { id: Date.now().toString(), role: 'error', content: `⚠️ **Error:** ${data.content}`, isFinished: true }
        ]);
      } else if (data.type === 'finish') {
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
      } else if (data.type === 'chat_started') {
        setCurrentChatId(data.chat_id);
      } else if (data.type === 'chat_list_updated') {
        setChats(data.chats || []);
      }
    };

    window.addEventListener('ai_agent_event', handleAiEvent);
    return () => window.removeEventListener('ai_agent_event', handleAiEvent);
  }, []);

  const handleSendMessage = async (text) => {
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsTyping(true);

    try {
      await pytron.stream_ask(text, currentChatId);
    } catch (err) {
      console.error(err);
      setIsTyping(false);
    }
  };

  const handleStop = () => {
    pytron.stop_generation();
    setIsTyping(false);
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
  };

  const handleSelectChat = async (chatId) => {
    try {
      setIsTyping(true);
      const historyMessages = await pytron.load_chat(chatId);
      setMessages(historyMessages || []);
      setCurrentChatId(chatId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleDeleteChat = async (chatId) => {
    try {
      const res = await pytron.delete_chat(chatId);
      if (res && res.success) {
        if (currentChatId === chatId) {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error(err);
    }
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
          <Sidebar 
            onOpenSettings={() => setIsSettingsOpen(true)} 
            onNewChat={handleNewChat} 
            chats={chats}
            currentChatId={currentChatId}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
          />
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
