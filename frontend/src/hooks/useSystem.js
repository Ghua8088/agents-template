import { useState, useEffect, useCallback } from 'react';
import pytron from 'pytron-client';
import { PytronToaster } from 'pytron-ui/react';

export function useSystem(pollStats = false) {
  const { addToast } = PytronToaster();
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [installNotification, setInstallNotification] = useState({ visible: false, status: '', message: '' });
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [playwrightStatus, setPlaywrightStatus] = useState(null);
  const [toolList, setToolList] = useState([]);
  const [confirmationDialog, setConfirmationDialog] = useState({ isOpen: false, id: '', message: '' });

  // Persistent System Stats
  const [systemStats, setSystemStats] = useState({
    platform: 'Loading...',
    cpu_usage: 0,
    memory_usage: 0,
    python_version: '...',
    gpu_info: null,
    disk_usage: null,
    network: null
  });
  const [uptime, setUptime] = useState(0);

  // Poll system stats only when requested
  useEffect(() => {
    if (!pollStats) return;

    const fetchStats = async () => {
      try {
        if (pytron.get_system_info) {
          const info = await pytron.get_system_info();
          setSystemStats(info);
          if (info.uptime !== undefined) {
            setUptime(info.uptime);
          }
        }
      } catch (e) {
        console.error('Error fetching system info:', e);
      }
    };

    fetchStats();
    const interval = setInterval(() => {
      fetchStats();
    }, 1000);

    return () => clearInterval(interval);
  }, [pollStats]);

  // Ollama control helpers
  const handleInstallOllama = useCallback(async () => {
    try {
      if (pytron.install_ollama) {
        await pytron.install_ollama();
        setShowSettings(true);
      }
    } catch (e) {
      console.error('install_ollama error', e);
    }
  }, []);

  const handlePullOllamaModel = useCallback(async (modelName) => {
    try {
      if (pytron.pull_ollama_model) {
        await pytron.pull_ollama_model(modelName);
        setShowSettings(true);
      }
    } catch (e) {
      console.error('pull_ollama_model error', e);
    }
  }, []);

  const handleEnsureOllamaServe = useCallback(async () => {
    try {
      if (pytron.ensure_ollama_serve) {
        await pytron.ensure_ollama_serve();
        setShowSettings(true);
      }
    } catch (e) {
      console.error('ensure_ollama_serve error', e);
    }
  }, []);

  const handleInstallPlaywright = useCallback(async () => {
    try {
      if (pytron.install_playwright_browsers) {
        await pytron.install_playwright_browsers();
        setShowSettings(true);
      }
    } catch (e) {
      console.error('install_playwright error', e);
    }
  }, []);

  const fetchTools = useCallback(async () => {
    try {
      if (pytron.list_tools_with_permissions) {
        const list = await pytron.list_tools_with_permissions();
        setToolList(list);
        return list;
      }
    } catch (e) {
      console.error('fetchTools error', e);
    }
    return [];
  }, []);

  const savePermission = useCallback(async (toolName, allowed, confirm) => {
    try {
      if (pytron.set_tool_permission) {
        await pytron.set_tool_permission(toolName, allowed, confirm);
      }
      // refresh
      await fetchTools();
    } catch (e) {
      console.error('savePermission error', e);
    }
  }, [fetchTools]);

  useEffect(() => {
    const handleAgentEvent = (event) => {
      if (!event || !event.type) return;

      // Playwright install events (status notifications)
      if (event.type === 'playwright_install') {
        setPlaywrightStatus({ type: event.type, ...event.data });
        if (event.data?.status === 'confirm') {
          setShowSettings(true);
        }
        return;
      }

      // Ollama related events
      if (event.type === 'ollama_install' || event.type === 'ollama_pull' || event.type === 'ollama_serve') {
        setOllamaStatus({ type: event.type, ...event.data });
        return;
      }

      // Tools confirmation request (ask user in GUI)
      if (event.type === 'tools.confirm') {
        const id = event.data?.id;
        const message = event.data?.message || 'Confirm?';
        setConfirmationDialog({ isOpen: true, id, message });
        return;
      }

      // Permissions update event
      if (event.type === 'permissions.updated') {
        fetchTools();
        if (addToast) addToast(`Permissions updated: ${event.data?.tool}`, { type: 'success' });
        return;
      }
    };

    pytron.on('agent-event', handleAgentEvent);
    return () => {
      pytron.off('agent-event', handleAgentEvent);
    };
  }, []);

  // Body class helper for layout shifting
  useEffect(() => {
    if (showHistory) {
      document.body.classList.add('history-open');
    } else {
      document.body.classList.remove('history-open');
    }
  }, [showHistory]);

  // Gemini API key management
  const getGeminiKey = useCallback(async () => {
    try {
      if (pytron.get_gemini_api_key) {
        return await pytron.get_gemini_api_key();
      }
    } catch (e) {
      console.error('getGeminiKey error', e);
    }
    return '';
  }, []);

  const saveGeminiKey = useCallback(async (key) => {
    try {
      if (pytron.set_gemini_api_key) {
        const success = await pytron.set_gemini_api_key(key);
        if (success && addToast) addToast('Gemini API key saved', { type: 'success' });
        return success;
      }
    } catch (e) {
      console.error('saveGeminiKey error', e);
    }
    return false;
  }, [addToast]);

  const getOpenAIKey = useCallback(async () => {
    try {
      if (pytron.get_openai_key) {
        return await pytron.get_openai_key();
      }
    } catch (e) {
      console.error('getOpenAIKey error', e);
    }
    return '';
  }, []);

  const saveOpenAIKey = useCallback(async (key) => {
    try {
      if (pytron.save_openai_key) {
        const success = await pytron.save_openai_key(key);
        if (success && addToast) addToast('OpenAI API key saved', { type: 'success' });
        return success;
      }
    } catch (e) {
      console.error('saveOpenAIKey error', e);
    }
    return false;
  }, [addToast]);

  const getAnthropicKey = useCallback(async () => {
    try {
      if (pytron.get_anthropic_key) {
        return await pytron.get_anthropic_key();
      }
    } catch (e) {
      console.error('getAnthropicKey error', e);
    }
    return '';
  }, []);

  const saveAnthropicKey = useCallback(async (key) => {
    try {
      if (pytron.save_anthropic_key) {
        const success = await pytron.save_anthropic_key(key);
        if (success && addToast) addToast('Anthropic API key saved', { type: 'success' });
        return success;
      }
    } catch (e) {
      console.error('saveAnthropicKey error', e);
    }
    return false;
  }, [addToast]);

  const fetchPreferences = useCallback(async () => {
    try {
      if (pytron.get_preferences) {
        return await pytron.get_preferences();
      }
    } catch (e) {
      console.error('fetchPreferences error', e);
    }
    return null;
  }, []);

  const savePreferences = useCallback(async (prefs) => {
    try {
      if (pytron.save_preferences) {
        const result = await pytron.save_preferences(prefs);
        if (result.ok && addToast) addToast('Preferences saved', { type: 'success' });
        return result;
      }
    } catch (e) {
      console.error('savePreferences error', e);
    }
    return { error: 'Failed' };
  }, [addToast]);

  return {
    systemStats,
    uptime,
    showHistory,
    setShowHistory,
    showSettings,
    setShowSettings,
    showModels,
    setShowModels,
    showProfile,
    setShowProfile,
    installNotification,
    ollamaStatus,
    playwrightStatus,
    toolList,
    handleInstallOllama,
    handlePullOllamaModel,
    handleEnsureOllamaServe,
    handleInstallPlaywright,
    fetchTools,
    savePermission,
    getGeminiKey,
    saveGeminiKey,
    getOpenAIKey,
    saveOpenAIKey,
    getAnthropicKey,
    saveAnthropicKey,
    fetchPreferences,
    savePreferences,
    confirmationDialog,
    handleConfirm: async () => {
      const { id } = confirmationDialog;
      setConfirmationDialog({ isOpen: false, id: '', message: '' });
      try {
        if (pytron.confirm_tool_response) {
          await pytron.confirm_tool_response(id, 'yes');
          if (addToast) addToast('Action confirmed', { type: 'success' });
        }
      } catch (e) {
        console.error('confirm_tool_response error', e);
      }
    },
    handleCancel: async () => {
      const { id } = confirmationDialog;
      setConfirmationDialog({ isOpen: false, id: '', message: '' });
      try {
        if (pytron.confirm_tool_response) {
          await pytron.confirm_tool_response(id, 'no');
          if (addToast) addToast('Action cancelled', { type: 'info' });
        }
      } catch (e) {
        console.error('confirm_tool_response error', e);
      }
    }
  };
}
