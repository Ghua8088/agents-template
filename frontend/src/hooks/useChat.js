import { useState, useEffect, useRef, useCallback } from 'react';
import pytron from 'pytron-client';
import { marked } from '../utils/markdown';

export function useChat() {
  const [messages, setMessages] = useState([{
    role: 'agent',
    content: "Hello! I'm your AI assistant. I can search the web, read files, and help you find information. What can I do for you today?",
    isHtml: false
  }]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [currentArtifactId, setCurrentArtifactId] = useState(null);
  const [showArtifacts, setShowArtifacts] = useState(false);

  // Refs for state access in callbacks
  const messagesRef = useRef(messages);
  const voiceModeRef = useRef(voiceMode);
  const currentChatIdRef = useRef(currentChatId);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  // Debounce helper
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const fetchSuggestions = useCallback(debounce((val) => {
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }
    pytron.suggest(val).then(setSuggestions).catch(() => { });
  }, 300), []);

  const handleInputChange = (val) => {
    fetchSuggestions(val);
  };

  const handleVoiceCall = async () => {
    if (isListening) return;
    setIsListening(true);
    try {
      if (pytron.listen) {
        const text = await pytron.listen();
        if (text) {
          handleSendMessage(text);
        }
      }
    } catch (e) {
      console.error("Voice error:", e);
    } finally {
      setIsListening(false);
    }
  };

  const handleToggleVoiceMode = () => {
    setVoiceMode(prev => !prev);
  };

  const saveCurrentToChat = async (chatId = null) => {
    try {
      const targetId = chatId || currentChatId;
      if (targetId && pytron.save_chat) {
        await pytron.save_chat(messagesRef.current, targetId);
      }
    } catch (e) {
      console.error('saveCurrentToChat error', e);
    }
  };

  const finalizeGeneration = useCallback(() => {
    setIsTyping(false);
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMsg = newMessages[newMessages.length - 1];
      if (lastMsg) {
        newMessages[newMessages.length - 1] = { ...lastMsg, isStreaming: false };

        // Speak if voice mode is on and it was an agent message
        if (voiceModeRef.current && lastMsg.role === 'agent') {
          let textToSpeak = lastMsg.rawContent || "";

          // Remove code blocks
          textToSpeak = textToSpeak.replace(/```[\s\S]*?```/g, "Refer code block here");

          // Remove Reasoning Depth markers
          textToSpeak = textToSpeak.replace(/\(Reasoning Depth:\s*\d+\)/gi, "");
          textToSpeak = textToSpeak.replace(/\*\(Reasoning Depth:\s*\d+\)\*/gi, "");

          // Remove markdown formatting chars
          textToSpeak = textToSpeak.replace(/[*#_`]/g, "");

          // Remove emojis
          textToSpeak = textToSpeak.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');

          if (textToSpeak.trim()) {
            pytron?.speak(textToSpeak).catch(console.error);
          }
        }
      }
      return newMessages;
    });

    // Save again to capture the full agent response
    const activeChatId = currentChatIdRef.current;
    if (activeChatId && pytron.save_chat) {
      setTimeout(() => {
        pytron.save_chat(messagesRef.current, activeChatId).catch(console.error);
      }, 100);
    }
  }, []);

  // Keep a ref to finalizeGeneration so we can call it from the event listener
  const finalizeGenerationRef = useRef(finalizeGeneration);
  useEffect(() => {
    finalizeGenerationRef.current = finalizeGeneration;
  }, [finalizeGeneration]);

  const handleSendMessage = async (text) => {
    // Intercept commands
    if (text.trim() === '/clear') {
      if (window.__clear_chat) window.__clear_chat();
      return;
    }
    if (text.trim() === '/history') {
      if (window.__toggle_history) window.__toggle_history();
      return;
    }

    // If a previous generation is running, stop it before starting a new prompt
    try {
      if (pytron.stop_generation) {
        await pytron.stop_generation();
      }
    } catch (e) {
      console.warn('stop_generation failed', e);
    }

    // Ensure chat exists
    let activeChatId = currentChatId;
    if (!activeChatId) {
      try {
        if (pytron.new_chat) {
          const resp = await pytron.new_chat();
          if (resp && resp.id) {
            activeChatId = resp.id;
            setCurrentChatId(resp.id);
          }
        }
      } catch (e) {
        console.error('ensureChatExists error', e);
      }
    }

    // Add user message and placeholder
    setMessages(prev => [
      ...prev,
      { role: 'user', content: text, isHtml: false },
      { role: 'agent', content: "", rawContent: "", isHtml: true, isStreaming: true }
    ]);
    setIsTyping(true);

    // Save immediately to capture user message
    if (activeChatId && pytron.save_chat) {
      const currentMsgs = [...messagesRef.current, { role: 'user', content: text, isHtml: false }];
      await pytron.save_chat(currentMsgs, activeChatId);
    }

    try {
      if (pytron.stream_ask) {
        const result = await pytron.stream_ask(text, activeChatId);

        if (typeof result === 'string') {
          if (result.startsWith && result.startsWith("Error")) {
            throw new Error(result);
          }
        } else if (result && typeof result === 'object') {
          if (result.error) {
            throw new Error(result.message || JSON.stringify(result));
          }
          if (typeof result.returncode === 'number' && result.returncode !== 0) {
            const stderr = result.stderr_preview || result.stderr_paged_id || '';
            throw new Error(`Command failed (code ${result.returncode}): ${stderr}`);
          }
          // Success! We wait for 'generation_completed' event.
        }
        console.log("result", result);
      } else {
        // Browser fallback
        const mockResponse = "Application is in browser mode. The AI backend is not reachable.";
        for (const char of mockResponse) {
          await new Promise(r => setTimeout(r, 30));
          window.__pytron_dispatch && window.__pytron_dispatch('chat-chunk', char);
        }
        finalizeGeneration();
      }
    } catch (e) {
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        newMessages[newMessages.length - 1] = {
          ...lastMsg,
          content: lastMsg.content + `<br/><span style="color: #ef4444">Error: ${e.message || e}</span>`,
          isStreaming: false
        };
        return newMessages;
      });
      setIsTyping(false);
    }
  };

  // Expose to window for Welcome Screen prompts
  useEffect(() => {
    window.__handle_send_message = handleSendMessage;
    return () => { window.__handle_send_message = null; };
  }, [handleSendMessage]);

  // Chat persistence helpers
  const fetchChatsList = async () => {
    try {
      if (pytron.list_chats) {
        const list = await pytron.list_chats();
        return list;
      }
    } catch (e) {
      console.error('fetchChatsList error', e);
    }
    return [];
  };

  const openChatById = async (chatId) => {
    try {
      let data = null;
      if (pytron.load_chat) {
        data = await pytron.load_chat(chatId);
      }
      if (data && !data.error) {
        setMessages(data.messages || []);
        setCurrentChatId(chatId);
      }
    } catch (e) {
      console.error('openChatById error', e);
    }
  };

  const createNewChat = async () => {
    try {
      let resp = null;
      if (pytron.new_chat) {
        resp = await pytron.new_chat();
      }
      if (resp && resp.id) {
        setCurrentChatId(resp.id);
        setMessages([{
          role: 'agent',
          content: "Hello! I'm your AI assistant. I can search the web, read files, and help you find information. What can I do for you today?",
          isHtml: false
        }]);
      }
    } catch (e) {
      console.error('createNewChat error', e);
    }
  };

  const deleteChatById = async (chatId) => {
    try {
      if (pytron.delete_chat) {
        await pytron.delete_chat(chatId);
      }
      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([{
          role: 'agent',
          content: "Hello! I'm your AI assistant. I can search the web, read files, and help you find information. What can I do for you today?",
          isHtml: false
        }]);
      }
    } catch (e) {
      console.error('deleteChatById error', e);
    }
  };

  // Buffering for performance
  const chunkBufferRef = useRef("");
  // Ref to track if backend signal for completion has arrived
  const isGenerationSignalReceivedRef = useRef(false);

  useEffect(() => {
    // Flush buffer every 50ms
    const interval = setInterval(() => {
      // 1. Process Buffer
      if (chunkBufferRef.current) {
        const chunkToProcess = chunkBufferRef.current;
        chunkBufferRef.current = ""; // Clear buffer immediately

        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsgIndex = newMessages.length - 1;
          const lastMsg = newMessages[lastMsgIndex];

          // Append to last message if it's an agent message (streaming or not, usually streaming)
          // We relax the isStreaming check slightly: if it matches agent and isn't a tool, we append.
          // This fixes the race condition where isStreaming might have ironically been flipped by another event.
          // BUT, we should be careful not to append to an old completed message from 5 mins again.
          // Ideally, we only append if it's the *current* generation.
          // Since we are in the typing flow (isTyping is true), it should be safe.

          if (lastMsg && lastMsg.role === 'agent' && lastMsg.type !== 'tool') {
            // Append to existing
            const updatedRaw = (lastMsg.rawContent || "") + chunkToProcess;
            const parsed = marked.parse(updatedRaw);

            newMessages[lastMsgIndex] = {
              ...lastMsg,
              rawContent: updatedRaw,
              content: parsed,
              isHtml: true,
              isStreaming: true // Ensure it stays/becomes open while we have data
            };
            return newMessages;
          }

          // Start new message
          const parsed = marked.parse(chunkToProcess);
          return [...prev, {
            role: 'agent',
            content: parsed,
            rawContent: chunkToProcess,
            isHtml: true,
            isStreaming: true,
            type: 'text'
          }];
        });
      }

      // 2. Check for completion signal
      // Only finalize if buffer is empty AND signal received
      if (!chunkBufferRef.current && isGenerationSignalReceivedRef.current) {
        isGenerationSignalReceivedRef.current = false;
        finalizeGenerationRef.current();
      }

    }, 50);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleChunk = (chunk) => {
      chunkBufferRef.current += chunk;
    };

    const handleAgentEvent = (event) => {
      if (!event || !event.type) return;

      if (event.type === 'generation_completed' || event.type === 'generation_stopped' || event.type === 'generation_error') {
        // Defer finalization to the interval loop to ensure buffer clears first
        isGenerationSignalReceivedRef.current = true;
        return;
      }

      // ... rest of tool logic

      if (event.type === 'tool_start') {
        const name = event.data?.name || 'unknown';
        const args = event.data?.args || {};

        setMessages(prev => [...prev, {
          role: 'agent',
          type: 'tool',
          toolName: name,
          toolArgs: args,
          toolStatus: 'running',
          toolResult: null,
          isHtml: false
        }]);
      } else if (event.type === 'tool_end') {
        const name = event.data?.name || 'unknown';
        const result = event.data?.result || '';

        setMessages(prev => {
          const newMessages = [...prev];
          for (let i = newMessages.length - 1; i >= 0; i--) {
            if (newMessages[i].type === 'tool' &&
              newMessages[i].toolName === name &&
              newMessages[i].toolStatus === 'running') {

              newMessages[i] = {
                ...newMessages[i],
                toolStatus: 'completed',
                toolResult: result
              };
              break;
            }
          }
          return newMessages;
        });
      }
    };

    pytron.on('chat-chunk', handleChunk);
    pytron.on('agent-event', handleAgentEvent);

    return () => {
      pytron.off('chat-chunk', handleChunk);
      pytron.off('agent-event', handleAgentEvent);
    }
  }, []);

  // Helper to extract code blocks for artifacts
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'agent' && lastMessage.rawContent) {
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;
      let matchIndex = 0;

      while ((match = codeBlockRegex.exec(lastMessage.rawContent)) !== null) {
        const lang = match[1] || 'text';
        const content = match[2].trim();

        // Only process substantial chunks
        if (content.length > 30) {
          const artifactId = `msg-${messages.length}-block-${matchIndex}`;
          const isHtml = lang === 'html' || content.startsWith('<!DOCTYPE html>') || content.startsWith('<html');
          const isImage = lang === 'screenshot';

          setArtifacts(prev => {
            const existingIdx = prev.findIndex(a => a.id === artifactId);
            if (existingIdx !== -1) {
              // Update existing if content changed
              if (prev[existingIdx].content === content) return prev;
              const next = [...prev];
              next[existingIdx] = { ...prev[existingIdx], content };
              return next;
            } else {
              // Add new
              const newArt = {
                id: artifactId,
                title: isImage ? 'Screenshot' : (isHtml ? 'Web Preview' : `Code (${lang})`),
                type: lang,
                content,
                isHtml,
                isImage
              };
              if (!showArtifacts) setShowArtifacts(true);
              if (!currentArtifactId) setCurrentArtifactId(newArt.id);
              return [...prev, newArt];
            }
          });
        }
        matchIndex++;
      }
    }
  }, [messages, showArtifacts, currentArtifactId]);

  return {
    messages,
    setMessages,
    isTyping,
    currentChatId,
    isListening,
    voiceMode,
    suggestions,
    handleInputChange,
    handleVoiceCall,
    handleToggleVoiceMode,
    handleSendMessage,
    fetchChatsList,
    openChatById,
    createNewChat,
    deleteChatById,
    saveCurrentToChat,
    artifacts,
    currentArtifactId,
    setCurrentArtifactId,
    showArtifacts,
    setShowArtifacts,
    handleSelectFile: async () => {
      try {
        if (pytron.select_file) {
          return await pytron.select_file();
        }
      } catch (e) {
        console.error('select_file error', e);
      }
      return null;
    }
  };
}