import React from 'react';
import { X } from 'lucide-react';
import './SettingsModal.css';

const SettingsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="setting-group">
            <label>API Key</label>
            <input type="password" placeholder="sk-..." className="settings-input" />
          </div>
          <div className="setting-group">
            <label>Model</label>
            <select className="settings-input">
              <option>Claude 3.5 Sonnet</option>
              <option>GPT-4o</option>
              <option>Llama 3</option>
            </select>
          </div>
          <div className="setting-group">
            <label>System Prompt</label>
            <textarea placeholder="You are a helpful assistant..." className="settings-input" rows={4}></textarea>
          </div>
        </div>
        <div className="modal-footer">
          <button className="save-btn" onClick={onClose}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
