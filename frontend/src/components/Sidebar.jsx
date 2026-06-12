import React, { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, Settings, PanelLeft } from 'lucide-react';

const Sidebar = ({ onOpenSettings }) => {
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
          <button className="new-chat-btn">
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        )}
      </div>
      
      <div className="sidebar-content">
        {!isCollapsed && <div className="recent-header">Recent</div>}
        <div className="chat-item active" title="Echo Session">
          <MessageSquare size={16} />
          {!isCollapsed && <span className="chat-item-text">Echo Session</span>}
        </div>
        <div className="chat-item" title="Template Test">
          <MessageSquare size={16} />
          {!isCollapsed && <span className="chat-item-text">Template Test</span>}
        </div>
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
