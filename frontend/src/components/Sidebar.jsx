import React, { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, Settings, PanelLeft, Trash2 } from 'lucide-react';

const Sidebar = ({ onOpenSettings, onNewChat, chats = [], currentChatId, onSelectChat, onDeleteChat }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e) => {
    if (isResizing) {
      // Allow resizing between 200px and 600px
      const newWidth = Math.min(Math.max(200, e.clientX), 600);
      setWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <div 
      className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isResizing ? 'is-resizing' : ''}`}
      style={!isCollapsed ? { width: `${width}px` } : {}}
    >
      <div className="sidebar-header">
        <button className="icon-btn toggle-btn" onClick={() => setIsCollapsed(!isCollapsed)} title="Toggle Sidebar">
          <PanelLeft size={18} />
        </button>
        {!isCollapsed && (
          <button className="new-chat-btn" onClick={onNewChat}>
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        )}
      </div>
      
      <div className="sidebar-content">
        {!isCollapsed && <div className="recent-header">Recent</div>}
        {chats.map(chat => (
          <div 
            key={chat.id} 
            className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`}
            onClick={() => onSelectChat && onSelectChat(chat.id)}
            title={chat.title}
          >
            <MessageSquare size={16} style={{ flexShrink: 0 }} />
            {!isCollapsed && <span className="chat-item-text">{chat.title}</span>}
            {!isCollapsed && onDeleteChat && (
              <button 
                className="delete-chat-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                title="Delete Chat"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-color)',
                  opacity: 0.5,
                  cursor: 'pointer',
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                  borderRadius: '4px'
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      
      <div className="sidebar-footer">
        <button className="icon-btn" onClick={onOpenSettings} title="Settings">
          <Settings size={18} />
          {!isCollapsed && <span>Settings</span>}
        </button>
      </div>

      {!isCollapsed && (
        <div className="sidebar-resizer" onMouseDown={startResizing} />
      )}
    </div>
  );
};

export default Sidebar;
