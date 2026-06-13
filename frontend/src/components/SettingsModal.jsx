import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import pytron from 'pytron-client';
import './SettingsModal.css';

const SettingsModal = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [status, setStatus] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.openai.com/v1');
  const [customModelName, setCustomModelName] = useState('llama3');
  const [localModelPath, setLocalModelPath] = useState('');

  useEffect(() => {
    if (isOpen) {
      pytron.get_api_key_status().then(res => {
        setHasKey(res.has_key);
        if (res.has_key) {
           setApiKey('********');
        }
      }).catch(console.error);

      pytron.get_gemini_api_key_status().then(res => {
        setHasGeminiKey(res.has_key);
        if (res.has_key) {
           setGeminiApiKey('********');
        }
      }).catch(console.error);

      pytron.get_models().then(res => {
        setModels(res || []);
      }).catch(console.error);

      pytron.store_get('SELECTED_MODEL', 'gpt-4o-mini').then(res => {
        setSelectedModel(res || 'gpt-4o-mini');
      }).catch(console.error);

      pytron.store_get('API_BASE_URL', 'https://api.openai.com/v1').then(res => {
        setApiBaseUrl(res || 'https://api.openai.com/v1');
      }).catch(console.error);

      pytron.store_get('CUSTOM_MODEL_NAME', 'llama3').then(res => {
        setCustomModelName(res || 'llama3');
      }).catch(console.error);

      pytron.store_get('LOCAL_MODEL_PATH', '').then(res => {
        setLocalModelPath(res || '');
      }).catch(console.error);
    }
  }, [isOpen]);

  const handleSelectModelFile = async () => {
    try {
      const path = await pytron.dialog_open_file('Select Local GGUF Model', null, ['gguf']);
      if (path) {
        setLocalModelPath(path);
      }
    } catch (e) {
      console.error('File selection error:', e);
    }
  };

  const handleSave = async () => {
    try {
      let saved = false;
      // Only save if it's not the placeholder
      if (apiKey && apiKey !== '********') {
        const res = await pytron.set_api_key(apiKey);
        if (res.success) {
          saved = true;
        }
      }

      if (geminiApiKey && geminiApiKey !== '********') {
        const res = await pytron.set_gemini_api_key(geminiApiKey);
        if (res.success) {
          saved = true;
        }
      }
      
      const modelRes = await pytron.change_model(selectedModel);
      if (modelRes.success) {
        saved = true;
      }

      await pytron.store_set('API_BASE_URL', apiBaseUrl.trim());
      await pytron.store_set('CUSTOM_MODEL_NAME', customModelName.trim());
      await pytron.store_set('LOCAL_MODEL_PATH', localModelPath.trim());
      saved = true;

      if (saved) {
        setStatus('Saved successfully!');
        setTimeout(() => { setStatus(''); onClose(); }, 1500);
      } else {
        onClose();
      }
    } catch (e) {
      setStatus('Error saving.');
    }
  };

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
            <label>API Base URL</label>
            <input 
              type="text" 
              placeholder="https://api.openai.com/v1" 
              className="settings-input" 
              value={apiBaseUrl}
              onChange={e => setApiBaseUrl(e.target.value)}
            />
          </div>
          <div className="setting-group">
            <label>OpenAI API Key {hasKey && <span style={{color: 'var(--accent-color)', fontSize: '0.8em', marginLeft: '8px'}}>(Stored Securely)</span>}</label>
            <input 
              type="password" 
              placeholder="sk-..." 
              className="settings-input" 
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
          </div>
          <div className="setting-group">
            <label>Gemini API Key {hasGeminiKey && <span style={{color: 'var(--accent-color)', fontSize: '0.8em', marginLeft: '8px'}}>(Stored Securely)</span>}</label>
            <input 
              type="password" 
              placeholder="AIzaSy..." 
              className="settings-input" 
              value={geminiApiKey}
              onChange={e => setGeminiApiKey(e.target.value)}
            />
          </div>
          <div className="setting-group">
            <label>Model</label>
            <select 
              className="settings-input" 
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          {selectedModel === 'custom' && (
            <div className="setting-group">
              <label>Custom Model Name</label>
              <input 
                type="text" 
                placeholder="e.g. llama3, mistral, phi-3" 
                className="settings-input" 
                value={customModelName}
                onChange={e => setCustomModelName(e.target.value)}
              />
            </div>
          )}
          {selectedModel === 'llamacpp' && (
            <div className="setting-group">
              <label>Local GGUF Model File</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  readOnly
                  placeholder="No GGUF file selected..." 
                  className="settings-input" 
                  value={localModelPath}
                  style={{ flex: 1, textOverflow: 'ellipsis' }}
                />
                <button 
                  className="save-btn" 
                  onClick={handleSelectModelFile}
                  style={{ whiteSpace: 'nowrap', padding: '0 12px', fontSize: '0.9em' }}
                >
                  Browse...
                </button>
              </div>
            </div>
          )}
          {status && <div style={{color: 'var(--accent-color)', fontSize: '0.9em', marginTop: '10px'}}>{status}</div>}
        </div>
        <div className="modal-footer">
          <button className="save-btn" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
