import React, { useState, useEffect, useRef } from 'react';
import { Send, Square, User, Bot } from 'lucide-react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

// Configure marked with highlight.js
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (e) {}
    }
    return hljs.highlightAuto(code).value;
  }
});
// Helper to parse `<think>` blocks into HTML details tags
const formatThinkBlocks = (content) => {
  if (!content) return '';
  let formatted = content;
  
  // Replace completed think blocks
  formatted = formatted.replace(
    /<think>([\s\S]*?)<\/think>/g,
    '<details class="think-block"><summary>Thought process</summary>\n\n$1\n\n</details>'
  );
  
  // Replace open think blocks (during streaming)
  if (formatted.includes('<think>')) {
    const parts = formatted.split('<think>');
    formatted = parts[0] + '<details open class="think-block"><summary>Thinking...</summary>\n\n' + parts[1] + '\n\n</details>';
  }
  
  return formatted;
};

export default function Chat({ messages, onSendMessage, isTyping, onStop }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  const handleInput = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
    setInput(e.target.value);
  };

  return (
    <div className="chat-layout">
      {/* Messages Column */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <Bot size={48} style={{ opacity: 0.2, marginBottom: '20px' }} />
            <h2>How can I help you today?</h2>
            <p>I am your new Agent Template. My UI is clean and completely unopinionated!</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-row ${msg.role === 'user' ? 'user-row' : 'agent-row'}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
            </div>
            <div className="message-content">
              {msg.role === 'assistant' ? (
                 <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(formatThinkBlocks(msg.content || '')) }} />
              ) : msg.role === 'tool' ? (
                 <div className="tool-body markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content || '') }} style={{opacity: 0.7, fontSize: '0.9em', padding: '8px', background: 'var(--secondary-bg)', borderRadius: '6px', borderLeft: '3px solid var(--accent-color)'}} />
              ) : msg.role === 'error' ? (
                 <div className="error-body markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content || '') }} style={{color: '#ff6b6b'}} />
              ) : (
                 <div className="user-text">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        
        {isTyping && messages[messages.length - 1]?.role !== 'assistant' && (
           <div className="message-row agent-row">
              <div className="message-avatar"><Bot size={18} /></div>
              <div className="message-content"><div className="typing-indicator">● ● ●</div></div>
           </div>
        )}
        <div ref={bottomRef} style={{ height: 20 }} />
      </div>

      {/* Input Area */}
      <div className="input-container">
        <div className="input-wrapper">
          <textarea
            value={input}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message the agent..."
            rows={1}
          />
          {isTyping ? (
            <button className="stop-btn" onClick={onStop}>
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button className="send-btn" onClick={handleSubmit} disabled={!input.trim()}>
              <Send size={16} />
            </button>
          )}
        </div>
        <div className="input-footer">
          Agents Template - Beautiful, minimal, and fully extensible.
        </div>
      </div>
    </div>
  );
}
