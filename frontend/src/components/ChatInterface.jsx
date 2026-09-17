import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { useNavigate } from 'react-router-dom';
import { localInputToIST, formatIST, formatDateIST } from '../utils/time';
import { Zap, Volume2, VolumeX, Mic } from 'lucide-react';
import ChatGPTVoiceOrb from './ChatGPTVoiceOrb';

// Component to render formatted Markdown (bold, headers, bullets, colors) cleanly
function FormattedMessage({ text, isUser }) {
  if (isUser) {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>;
  }

  const cleanedText = text.replace(/```json[\s\S]*?```/gi, '').trim();
  const lines = cleanedText.split('\n');

  const renderInlineMarkdown = (str) => {
    const parts = [];
    const regex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(
          <strong key={match.index} className="font-semibold text-[var(--accent-base)] bg-[var(--accent-base)]/10 px-1 py-0.5 rounded border border-[var(--accent-base)]/20">
            {match[2]}
          </strong>
        );
      } else if (match[4]) {
        parts.push(<em key={match.index} className="italic opacity-90">{match[4]}</em>);
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }

    return parts.length > 0 ? parts : str;
  };

  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        if (trimmed.startsWith('#')) {
          const headerText = trimmed.replace(/^#+\s*/, '');
          return (
            <h4 key={idx} className="font-bold text-[var(--text-main)] text-sm mt-2 mb-1 flex items-center gap-1.5 border-b border-[var(--border-subtle)] pb-1">
              <span className="w-1.5 h-3 bg-[var(--accent-base)] rounded-full inline-block"></span>
              {renderInlineMarkdown(headerText)}
            </h4>
          );
        }

        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const bulletText = trimmed.replace(/^[*\-]\s*/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-0.5">
              <span className="text-[var(--accent-base)] font-bold text-xs mt-1">•</span>
              <span className="flex-1">{renderInlineMarkdown(bulletText)}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="my-0.5">
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export default function ChatInterface({ isChatOpen, openChat }) {

  const { token, API_BASE } = useAuth();
  const { tasks, addTask, fetchTasks } = useTasks();
  const navigate = useNavigate();

  // Load initial messages from localStorage or default welcome message
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('taskpulse_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    } catch (e) {
      console.error('Failed to load chat history', e);
    }
    return [{
      id: Date.now(),
      text: "Hello! I'm your TaskPulse assistant. Say 'Hey TaskPulse' or type a command to get started.\n• Ask questions about your schedule or tasks\n• Hands-free voice accessibility active!",
      isUser: false,
      timestamp: new Date()
    }];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voices, setVoices] = useState([]);
  const [isListening, setIsListening] = useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [latestTranscript, setLatestTranscript] = useState('');
  const [latestAiResponse, setLatestAiResponse] = useState('');

  // Load voices for speech synthesis
  useEffect(() => {
    const loadVoices = () => {
      if ('speechSynthesis' in window) {
        setVoices(window.speechSynthesis.getVoices());
      }
    };
    loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const messagesRef = useRef(messages);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  // Scroll to bottom on mount and whenever messages or loading state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom(messages.length <= 2 ? 'auto' : 'smooth');
    }, 60);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  // Scroll to the latest message every time the chat panel is opened
  useEffect(() => {
    if (isChatOpen) {
      const timer = setTimeout(() => scrollToBottom('auto'), 80);
      return () => clearTimeout(timer);
    }
  }, [isChatOpen]);

  // Save messages to local storage and sync ref whenever they change
  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem('taskpulse_chat_history', JSON.stringify(messages));
  }, [messages]);

  const [conversationState, setConversationState] = useState({
    step: 'initial',
    taskData: {},
    awaitingField: null
  });

  const activeRecognitionRef = useRef(null);
  const isProcessingRef = useRef(false);
  const messageIdRef = useRef(0);

  // Global Keyboard Shortcut for Push-to-Talk Voice Input (Alt+V)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (openChat) openChat();
        startVoiceInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openChat]);

  // Generate unique message ID
  const generateMessageId = () => {
    return Date.now() + messageIdRef.current++;
  };

  const [isTwoWayMode, setIsTwoWayMode] = useState(false);
  const isTwoWayModeRef = useRef(false);

  // Keep ref in sync with state for callback access
  useEffect(() => {
    isTwoWayModeRef.current = isTwoWayMode;
  }, [isTwoWayMode]);

  const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => localStorage.getItem('taskpulse_selected_voice_uri') || '');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  const handleVoiceChange = (uri) => {
    setSelectedVoiceURI(uri);
    localStorage.setItem('taskpulse_selected_voice_uri', uri);
  };

  const audioRef = useRef(null);

  const stopAllVoiceActivity = () => {
    setIsTwoWayMode(false);
    isTwoWayModeRef.current = false;
    setIsListening(false);
    setIsSpeaking(false);
    setIsLoading(false);
    isProcessingRef.current = false;

    // 1. Instantly strip callbacks and abort active SpeechRecognition
    if (activeRecognitionRef.current) {
      try {
        activeRecognitionRef.current.onresult = null;
        activeRecognitionRef.current.onerror = null;
        activeRecognitionRef.current.onend = null;
        activeRecognitionRef.current.stop();
        activeRecognitionRef.current.abort();
      } catch (e) { }
      activeRecognitionRef.current = null;
    }

    // 2. Instantly pause, strip callbacks, and destroy HTML5 Audio
    if (audioRef.current) {
      try {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) { }
      audioRef.current = null;
    }

    // 3. Cancel Web Speech Synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const testSelectedVoice = async (uriToTest = selectedVoiceURI) => {
    const sampleText = "Hello! I am your TaskPulse AI assistant. How does this voice sound to you?";
    speakText(sampleText);
  };

  // Clean text for natural human Speech Synthesis (strip markdown, JSON code blocks, symbols)
  const cleanTextForSpeech = (rawText) => {
    if (!rawText) return '';
    return rawText
      .replace(/```json[\s\S]*?```/gi, '') // remove json code blocks
      .replace(/```[\s\S]*?```/gi, '')     // remove code blocks
      .replace(/[\*\_`#\[\]\(\)>~]/g, ' ') // remove markdown symbols
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Ultra-realistic Neural Human Speech Synthesis (ChatGPT Voice Style) via /nlp/tts
  const speakText = async (text, onSpeechEnd) => {
    // If voice orb mode has been closed, do NOT start speaking
    if (!isTwoWayModeRef.current) {
      setIsSpeaking(false);
      if (onSpeechEnd) onSpeechEnd();
      return;
    }

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) {
      setIsSpeaking(false);
      if (onSpeechEnd) onSpeechEnd();
      return;
    }

    setLatestAiResponse(cleanText);
    setIsSpeaking(true);

    // Stop any ongoing speech
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) { }
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Try Neural TTS API first (Hyper-realistic ChatGPT Voice)
    try {
      const ttsVoice = selectedVoiceURI.startsWith('en-US-')
        ? selectedVoiceURI
        : 'en-US-AvaNeural'; // Default: Ava Neural (ChatGPT Warm Female Voice)

      const response = await fetch(`${API_BASE}/nlp/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: cleanText,
          voice: ttsVoice
        })
      });

      if (response.ok) {
        // Double-check modal hasn't closed during network request
        if (!isTwoWayModeRef.current) {
          setIsSpeaking(false);
          return;
        }

        const blob = await response.blob();
        if (!isTwoWayModeRef.current) {
          setIsSpeaking(false);
          return;
        }

        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          if (onSpeechEnd) onSpeechEnd();
          if (isTwoWayModeRef.current) {
            setTimeout(() => {
              if (isTwoWayModeRef.current) {
                startVoiceInput();
              }
            }, 400);
          }
        };

        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          setIsSpeaking(false);
          if (onSpeechEnd) onSpeechEnd();
        };

        if (isTwoWayModeRef.current) {
          await audio.play();
        } else {
          setIsSpeaking(false);
        }
        return;
      }
    } catch (err) {
      console.warn('Neural TTS endpoint fallback to Web Speech:', err);
    }

    // Browser Web Speech Synthesis Fallback
    if ('speechSynthesis' in window) {
      if (!isTwoWayModeRef.current) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      utterance.rate = 0.96;
      utterance.pitch = 1.05;

      const available = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      const preferred = available.find(v => v.voiceURI === selectedVoiceURI)
        || available.find(v => v.name.includes('Ava') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Jenny') || v.name.includes('Google US English') || v.name.includes('Karen'))
        || available[0];
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => {
        setIsSpeaking(false);
        if (onSpeechEnd) onSpeechEnd();
        if (isTwoWayModeRef.current) {
          setTimeout(() => {
            if (isTwoWayModeRef.current) {
              startVoiceInput();
            }
          }, 600);
        }
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        if (onSpeechEnd) onSpeechEnd();
      };

      if (isTwoWayModeRef.current) {
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    } else {
      setIsSpeaking(false);
      if (onSpeechEnd) onSpeechEnd();
    }
  };


  const speakIfEnabled = (text, onSpeechEnd) => {
    if (isTwoWayModeRef.current) {
      speakText(text, onSpeechEnd);
    } else if (onSpeechEnd) {
      onSpeechEnd();
    }
  };


  const sendMessage = async (messageText = input) => {
    const textToSend = messageText.trim();

    if (!textToSend || !token) return;

    const userMessage = {
      id: generateMessageId(),
      text: textToSend,
      isUser: true,
      timestamp: new Date()
    };

    const updatedMessages = [...messagesRef.current, userMessage];
    setMessages(updatedMessages);
    messagesRef.current = updatedMessages;
    setInput('');
    setIsLoading(true);

    try {
      // Check if this is a navigation request
      const navMatch = textToSend.toLowerCase().match(/^(go to|navigate to|show me|open)\s+(dashboard|schedule|tasks|profile|analytics|integrations)/i);
      if (navMatch) {
        const section = navMatch[2].toLowerCase();
        let path = '/';
        switch (section) {
          case 'dashboard': path = '/'; break;
          case 'schedule': path = '/schedule'; break;
          case 'tasks': path = '/tasks'; break;
          case 'profile': path = '/profile'; break;
          case 'analytics': path = '/analytics'; break;
          case 'integrations': path = '/integrations'; break;
        }
        navigate(path);

        const navResponse = {
          id: generateMessageId(),
          text: `Sure! Taking you to the ${section} section.`,
          isUser: false,
          timestamp: new Date()
        };
        const navUpdated = [...updatedMessages, navResponse];
        setMessages(navUpdated);
        messagesRef.current = navUpdated;
        speakIfEnabled(navResponse.text);
        setIsLoading(false);
        return;
      }

      // Process query through contextual AI Assistant
      await handleQuestion(textToSend, updatedMessages);

    } catch (error) {
      console.error('Error processing message:', error);
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        text: "I apologize, but I encountered an error processing your request. Please try again.",
        isUser: false,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskCreationFlow = async (inputText) => {
    // If we're in the middle of a conversation, continue gathering info
    if (conversationState.step === 'task_creation') {
      // Parse what we can from the current input
      const parsed = await parseTaskFromText(inputText);

      // Merge with existing task data
      const updatedTaskData = { ...conversationState.taskData, ...parsed };

      // Check what's missing
      const missingFields = [];
      if (!updatedTaskData.name) missingFields.push('task name');
      if (!updatedTaskData.earliest_start) missingFields.push('when you would like it to happen');
      if (!updatedTaskData.duration_minutes) missingFields.push('duration');

      // If we have enough info, create the task
      if (missingFields.length === 0) {
        await createTaskFromData(updatedTaskData);
        // Reset conversation state
        setConversationState({
          step: 'initial',
          taskData: {},
          awaitingField: null
        });
      } else {
        // Ask for missing information
        setConversationState({
          step: 'waiting_for_clarification',
          taskData: updatedTaskData,
          awaitingField: missingFields[0] // Ask for first missing field
        });

        let prompt = "To create your task, I need a bit more information:\n";
        if (missingFields.includes('task name')) {
          prompt += "What would you like to name this task?\n";
        } else if (missingFields.includes('when you would like it to happen')) {
          prompt += "When would you like this task to happen? You can say things like 'tomorrow at 2pm', 'next Friday', 'in 3 hours', or just 'tomorrow'.\n";
        } else if (missingFields.includes('duration')) {
          prompt += "How long will this task take? You can say '1 hour', '30 minutes', '2h', etc.\n";
        }

        // Add priority question if not specified
        if (!updatedTaskData.priority || updatedTaskData.priority === 1) {
          prompt += "What priority should this task have? (low, medium, high, or critical)\n";
        }

        const clarificationMessage = {
          id: generateMessageId(),
          text: prompt.trim(),
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, clarificationMessage]);
        speakIfEnabled(clarificationMessage.text);
      }
    } else {
      // Start new task creation flow
      const parsed = await parseTaskFromText(inputText);

      // Check what we have
      const missingFields = [];
      if (!parsed.name) missingFields.push('task name');
      if (!parsed.earliest_start) missingFields.push('when you would like it to happen');
      if (!parsed.duration_minutes) missingFields.push('duration');

      if (missingFields.length === 0) {
        // We have enough to create the task
        await createTaskFromData(parsed);
        setConversationState({
          step: 'initial',
          taskData: {},
          awaitingField: null
        });
      } else {
        // Start conversation to gather missing info
        setConversationState({
          step: 'task_creation',
          taskData: parsed,
          awaitingField: missingFields[0]
        });

        let prompt = "I'd be happy to help you create that task! To get started, I need a few details:\n";
        if (missingFields.includes('task name')) {
          prompt += "What would you like to name this task?\n";
        } else if (missingFields.includes('when you would like it to happen')) {
          prompt += "When would you like this task to happen? You can say things like 'tomorrow at 2pm', 'next Friday', 'in 3 hours', or just 'tomorrow'.\n";
        } else if (missingFields.includes('duration')) {
          prompt += "How long will this task take? You can say '1 hour', '30 minutes', '2h', etc.\n";
        }

        // Add priority question if not specified
        if (!parsed.priority || parsed.priority === 1) {
          prompt += "What priority should this task have? (low, medium, high, or critical)\n";
        }

        const clarificationMessage = {
          id: generateMessageId(),
          text: prompt.trim(),
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, clarificationMessage]);
        speakIfEnabled(clarificationMessage.text);
      }
    }
  };

  const handleClarificationResponse = async (responseText) => {
    // Parse the response for the specific field we're waiting for
    const parsed = await parseTaskFromText(responseText);

    // Update task data based on what we're waiting for
    let updatedTaskData = { ...conversationState.taskData };
    let fieldResolved = false;

    switch (conversationState.awaitingField) {
      case 'task name':
        if (parsed.name) {
          updatedTaskData.name = parsed.name;
          fieldResolved = true;
        }
        break;
      case 'when you would like it to happen':
        if (parsed.earliest_start) {
          updatedTaskData.earliest_start = parsed.earliest_start;
          fieldResolved = true;
        }
        break;
      case 'duration':
        if (parsed.duration_minutes) {
          updatedTaskData.duration_minutes = parsed.duration_minutes;
          fieldResolved = true;
        }
        break;
      default:
        // Handle priority or other fields
        if (parsed.priority && parsed.priority !== 1) {
          updatedTaskData.priority = parsed.priority;
          fieldResolved = true;
        }
        break;
    }

    if (fieldResolved) {
      // Check if we now have all required fields
      const stillMissing = [];
      if (!updatedTaskData.name) stillMissing.push('task name');
      if (!updatedTaskData.earliest_start) stillMissing.push('when you would like it to happen');
      if (!updatedTaskData.duration_minutes) stillMissing.push('duration');

      if (stillMissing.length === 0) {
        // All set! Create the task
        await createTaskFromData(updatedTaskData);
        // Reset conversation state
        setConversationState({
          step: 'initial',
          taskData: {},
          awaitingField: null
        });
      } else {
        // Still missing something, ask for next field
        setConversationState({
          step: 'waiting_for_clarification',
          taskData: updatedTaskData,
          awaitingField: stillMissing[0]
        });

        let prompt = "Thanks! I still need to know:\n";
        if (stillMissing.includes('task name')) {
          prompt += "What would you like to name this task?\n";
        } else if (stillMissing.includes('when you would like it to happen')) {
          prompt += "When would you like this task to happen? You can say things like 'tomorrow at 2pm', 'next Friday', 'in 3 hours', or just 'tomorrow'.\n";
        } else if (stillMissing.includes('duration')) {
          prompt += "How long will this task take? You can say '1 hour', '30 minutes', '2h', etc.\n";
        }

        // Add priority if still needed
        if ((!updatedTaskData.priority || updatedTaskData.priority === 1) &&
          !stillMissing.includes('priority')) {
          prompt += "What priority should this task have? (low, medium, high, or critical)\n";
        }

        const clarificationMessage = {
          id: generateMessageId(),
          text: prompt.trim(),
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, clarificationMessage]);
        speakIfEnabled(clarificationMessage.text);
      }
    } else {
      // Didn't understand the response for the field we needed
      const errorMessage = {
        id: generateMessageId(),
        text: `I'm not sure I understood that. Could you please clarify ${conversationState.awaitingField}? For example:\n• For time: "tomorrow at 3pm", "next Friday", "in 2 hours"\n• For duration: "1 hour", "30 minutes", "2h"\n• For priority: "low", "medium", "high", or "critical"`,
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      speakIfEnabled(errorMessage.text);
    }
  };

  const createTaskFromData = async (taskData) => {
    try {
      // Prepare task for API
      const taskToCreate = {
        name: taskData.name,
        duration_minutes: taskData.duration_minutes || 30,
        earliest_start: taskData.earliest_start, // Should already be ISO string from parsing
        deadline: taskData.deadline || (new Date(new Date(taskData.earliest_start).getTime() + (taskData.duration_minutes || 30) * 60000)).toISOString(),
        priority: taskData.priority || 1,
        fixed: taskData.fixed || false
      };

      // Create the task via API
      const response = await fetch(`${API_BASE}/tasks/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(taskToCreate)
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const data = await response.json();

      // Add to local state optimistically
      addTask(data.task);

      // Success message
      const successMessage = {
        id: generateMessageId(),
        text: `Perfect! I've created your task "${taskData.name}" for ${formatIST(taskData.earliest_start)} lasting ${taskData.duration_minutes} minutes with ${getPriorityLabel(taskData.priority)} priority.`,
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);
      speakIfEnabled(successMessage.text);
    } catch (error) {
      console.error('Error creating task:', error);
      const errorMessage = {
        id: generateMessageId(),
        text: "I'm sorry, but I wasn't able to create the task. Please try again.",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      speakIfEnabled(errorMessage.text);
    }
  };

  const handleQuestion = async (questionText, activeList = null) => {
    try {
      const sourceList = activeList || messagesRef.current;
      const historyPayload = sourceList.slice(-10).map(m => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.text
      }));

      const queryResponse = await fetch(`${API_BASE}/nlp/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: questionText,
          history: historyPayload,
          tasks: tasks
        })
      });

      if (!queryResponse.ok) throw new Error('Failed to process query');
      const queryData = await queryResponse.json();

      let answer = queryData.answer || "I reviewed your message.";

      const responseMessage = {
        id: generateMessageId(),
        text: answer,
        isUser: false,
        timestamp: new Date(),
        ...queryData
      };
      setMessages(prev => {
        const nextList = [...prev, responseMessage];
        messagesRef.current = nextList;
        return nextList;
      });
      speakIfEnabled(responseMessage.text);

      if ((queryData.task_created || queryData.action === 'update_task') && fetchTasks) {
        fetchTasks(true);
      }
    } catch (error) {
      console.error('Error processing question:', error);
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        text: "I apologize, but I encountered an error processing your query. Please try again.",
        isUser: false,
        timestamp: new Date()
      }]);
    }
  };

  const parseTaskFromText = async (text) => {
    try {
      const response = await fetch(`${API_BASE}/nlp/parse-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error('Failed to parse task');
      return await response.json();
    } catch (error) {
      console.error('Error parsing task:', error);
      return {
        name: text.trim(),
        duration_minutes: 30,
        priority: 1
      };
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 4: return 'critical';
      case 3: return 'high';
      case 2: return 'medium';
      case 1: return 'low';
      default: return 'low';
    }
  };

  const cancelSpeech = () => {
    setIsSpeaking(false);
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) { }
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const handleVoiceInput = async (text) => {
    const transcript = text.trim();

    if (!transcript) return;

    // BARGE-IN: Instantly cancel any ongoing AI speech
    cancelSpeech();

    setLatestTranscript(transcript);
    setInput(transcript);
    try {
      await sendMessage(transcript);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const startVoiceInput = async () => {
    // BARGE-IN: Instantly cancel/stop any ongoing AI speech when user interacts!
    cancelSpeech();

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in your browser. Please use Chrome or Edge for voice features.');
      return;
    }

    if (activeRecognitionRef.current) {
      try {
        activeRecognitionRef.current.onresult = null;
        activeRecognitionRef.current.onerror = null;
        activeRecognitionRef.current.onend = null;
        activeRecognitionRef.current.stop();
        activeRecognitionRef.current.abort();
      } catch (e) { }
      activeRecognitionRef.current = null;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    activeRecognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    try {
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0]?.transcript;
      setIsListening(false);
      if (transcript) {
        cancelSpeech();
        handleVoiceInput(transcript);
      }
      try { recognition.stop(); } catch (e) { }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      isProcessingRef.current = false;
      try { recognition.stop(); } catch (e) { }
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  };

  if (isTwoWayMode) {
    return (
      <ChatGPTVoiceOrb
        isListening={isListening}
        isLoading={isLoading}
        isSpeaking={isSpeaking}
        latestTranscript={latestTranscript}
        latestAiResponse={latestAiResponse}
        selectedVoiceURI={selectedVoiceURI}
        onVoiceChange={handleVoiceChange}
        onToggleMic={() => startVoiceInput()}
        onCloseVoiceMode={stopAllVoiceActivity}
        onToggleTextChat={stopAllVoiceActivity}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[var(--bg-panel)]">
      {/* Chat Header */}
      <div className="bg-[var(--bg-panel)] rounded-t-xl shadow-lg border border-[var(--border-subtle)] flex items-center justify-between px-3 sm:px-4 py-2 gap-2 overflow-hidden">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="text-[var(--text-main)] font-semibold flex items-center gap-1.5 text-sm shrink-0">
            <Zap className="h-4 w-4 text-[var(--accent-base)]" />
            <span className="hidden sm:inline">TaskPulse AI</span>
            <span className="sm:hidden">AI</span>
          </h3>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => {
              if (isTwoWayMode) {
                stopAllVoiceActivity();
              } else {
                setIsTwoWayMode(true);
                isTwoWayModeRef.current = true;
                startVoiceInput();
              }
            }}
            className={`text-[10px] font-bold px-2 sm:px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${isTwoWayMode
              ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-200 animate-pulse'
              : 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
              }`}
            title="Launch ChatGPT Voice Mode Orb"
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isTwoWayMode ? 'Voice Mode ON' : 'Voice Mode Orb'}</span>
            <span className="sm:hidden">Voice</span>
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('taskpulse_chat_history');
              setMessages([{
                id: Date.now(),
                text: "Memory cleared! How can I assist you with your day?",
                isUser: false,
                timestamp: new Date()
              }]);
            }}
            className="hidden sm:inline-block text-[10px] text-[var(--text-muted)] hover:text-red-500 font-semibold px-2 py-1 border border-[var(--border-subtle)] rounded transition-colors shrink-0"
            title="Clear Conversation History"
          >
            Clear Memory
          </button>
          <button
            onClick={() => {
              const newState = !voiceEnabled;
              setVoiceEnabled(newState);
              if (!newState && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
            }}
            className="text-[var(--text-muted)] hover:text-[var(--accent-base)] p-1 rounded shrink-0"
            title={voiceEnabled ? 'Disable voice response' : 'Enable voice response'}
          >
            {voiceEnabled ? (
              <Volume2 className="h-4 w-4 text-[var(--accent-base)]" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>



      {/* Chat Messages */}
      <div ref={chatContainerRef} className="flex-1 bg-[var(--bg-panel)] border-l border-r border-[var(--border-subtle)] overflow-y-auto px-4 py-4 space-y-3" aria-live="polite" aria-atomic="false">
        {messages.map(message => (
          <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl ${message.isUser
              ? 'bg-[var(--accent-base)] text-white'
              : 'bg-[var(--bg-hover)] text-[var(--text-main)]'
              }`}>
              <FormattedMessage text={message.text} isUser={message.isUser} />

              {message.timestamp && (
                <p className="text-[10px] text-[var(--text-muted)] mt-1">{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl bg-[var(--bg-hover)] text-[var(--text-muted)]">
              <p>Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] flex items-center gap-2 px-3 sm:px-4 py-3 shrink-0">
        <button
          onClick={startVoiceInput}
          className={`p-2 shrink-0 rounded-lg transition-all flex items-center justify-center ${isListening
            ? 'bg-red-500 text-white animate-pulse shadow-md ring-2 ring-red-300'
            : 'text-[var(--text-muted)] hover:text-[var(--accent-base)] hover:bg-slate-100'
            }`}
          title={isListening ? "Listening... Click to stop" : "Click mic to speak (or Alt+V)"}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 0 1-14 0M12 18v4M8 22h8" /></svg>
        </button>

        <textarea
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!isLoading && input.trim()) {
                sendMessage();
                e.target.style.height = 'auto';
              }
            }
          }}
          placeholder={isListening ? "Listening..." : "Message TaskPulse..."}
          className={`flex-1 min-w-0 px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 text-sm transition-all bg-[var(--bg-app)] text-[var(--text-main)] placeholder-[var(--text-muted)] resize-none overflow-y-auto ${isListening ? 'border-red-400 ring-1 ring-red-300 bg-red-500/10' : 'border-[var(--border-subtle)] focus:ring-[var(--accent-base)]'
            }`}
          style={{ minHeight: '40px', maxHeight: '120px' }}
        />

        <button
          onClick={() => sendMessage()}
          disabled={isLoading || !input.trim()}
          className={`shrink-0 px-4 py-2 rounded-xl font-medium transition-colors ${isLoading || !input.trim()
            ? 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
            : 'bg-[var(--accent-base)] text-white hover:bg-[var(--accent-hover)]'
            }`}
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}