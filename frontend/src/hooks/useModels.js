import { useState, useEffect, useCallback, useRef } from 'react';
import pytron from 'pytron-client';

export function useModels() {
  const [models, setModels] = useState([]);
  const [cachedModels, setCachedModels] = useState([]);
  const [currentModel, setCurrentModel] = useState("");
  const currentModelRef = useRef("");

  useEffect(() => {
    currentModelRef.current = currentModel;
  }, [currentModel]);

  const loadModels = useCallback(async () => {
    try {
      let loadedModels = [];
      if (pytron.get_models) {
        loadedModels = await pytron.get_models();
      } else {
        console.warn('pytron.get_models not available in this environment');
      }

      if (loadedModels && loadedModels.length > 0) {
        setModels(loadedModels);
        // Fallback: stay on current or pick first
        if (!loadedModels.includes(currentModelRef.current)) {
          setCurrentModel(loadedModels[0]);
        }
      } else {
        setModels([]);
      }

      // Fetch cached models too
      if (pytron.get_cached_models) {
        const cached = await pytron.get_cached_models();
        setCachedModels(cached || []);
      }
    } catch (e) {
      console.error("Error loading models:", e);
      setModels([]);
    }
  }, []);

  const handleSelectModel = useCallback(async (model) => {
    setCurrentModel(model);
    try {
      if (pytron.change_model) {
        const result = await pytron.change_model(model);
        // Refresh cache status after change
        if (pytron.get_cached_models) {
            const cached = await pytron.get_cached_models();
            setCachedModels(cached || []);
        }
        return { success: true, message: result };
      }
      return { success: true, message: "Model selection updated" };
    } catch (e) {
      console.error(e);
      return { success: false, message: e.message || String(e) };
    }
  }, []);

  const preloadModel = useCallback(async (model) => {
    try {
      if (pytron.pre_load_model) {
        await pytron.pre_load_model(model);
        // We don't immediately refresh cache here because pre-load is async in background
        // The backend will send a toast when done.
        return true;
      }
    } catch (e) {
      console.error("Pre-load error:", e);
    }
    return false;
  }, []);

  useEffect(() => {
    const handleReady = () => loadModels();
    window.addEventListener('pywebviewready', handleReady);
    loadModels();
    
    // Periodically refresh cache status
    const interval = setInterval(async () => {
      if (pytron.get_cached_models) {
        const cached = await pytron.get_cached_models();
        setCachedModels(prev => {
            // Only update if changed to avoid unnecessary re-renders
            if (JSON.stringify(prev) !== JSON.stringify(cached)) return cached;
            return prev;
        });
      }
    }, 5000);

    return () => {
        window.removeEventListener('pywebviewready', handleReady);
        clearInterval(interval);
    };
  }, [loadModels]);

  return {
    models,
    cachedModels,
    currentModel,
    handleSelectModel,
    refreshModels: loadModels,
    preloadModel
  };
}
