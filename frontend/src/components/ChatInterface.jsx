import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { useNavigate } from 'react-router-dom';
import { localInputToIST, formatIST, formatDateIST } from '../utils/time';
import { Zap, Volume2, VolumeX } from 'lucide-react';

export default function ChatInterface() {
  const { token, API_BASE } = useAuth();
  const { tasks, addTask } = useTasks();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationState, setConversationState] = useState({
    step: 'initial', // initial, task_creation, question_asked, waiting_for_clarification
    taskData: {}, // stores partial task info during conversation
    awaitingField: null // which field we're waiting for (date, priority, etc.)
  });
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  // Ref for message ID generation to avoid impure functions in render
  const messageIdRef = useRef(0);

  // Add a welcome message using useEffect properly
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage = {
        id: generateMessageId(),
        text: "Hello! I'm your TaskPulse assistant. I can help you:\n• Create tasks: Just tell me what you want to schedule\n• Answer questions: Ask about your tasks, schedule, or profile\n• Navigate: Say 'go to schedule' or 'show my tasks'\n• Use voice input with the microphone button\n\nHow can I assist you today?",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, welcomeMessage]);
    }
  }, [messages.length]);

  // Generate unique message ID
  const generateMessageId = () => {
    return Date.now() + messageIdRef.current++;
  };

  // Speech synthesis
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // cancel any ongoing
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const speakIfEnabled = (text) => {
    if (voiceEnabled) {
      speakText(text);
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

    setMessages(prev => [...prev, userMessage]);
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
        setMessages(prev => [...prev, navResponse]);
        speakIfEnabled(navResponse.text);
        setIsLoading(false);
        return;
      }

      // Check if user wants to see their tasks
      const showTasksMatch = textToSend.toLowerCase().match(/(show|list|what.*are).*my\s+(tasks|task list)/i);
      if (showTasksMatch) {
        const tasksResponse = {
          id: generateMessageId(),
          text: `You currently have ${tasks.length} task(s). Would you like me to show you your task list or help you with something specific?`,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, tasksResponse]);
        speakIfEnabled(tasksResponse.text);
        setIsLoading(false);
        return;
      }

      // Determine if this is a task creation request or a question
      const isTaskRequest = /^(schedule|add|create|i want to|i need to|make|set up)\s+/i.test(textToSend);

      // Handle conversational flow for task creation
      if (conversationState.step === 'waiting_for_clarification' && conversationState.awaitingField) {
        // User is providing missing information
        await handleClarificationResponse(textToSend);
      } else if (isTaskRequest || conversationState.step === 'task_creation') {
        // Handle task creation flow
        await handleTaskCreationFlow(textToSend);
      } else {
        // Treat as a question
        await handleQuestion(textToSend);
      }
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

  const handleQuestion = async (questionText) => {
    try {
      const queryResponse = await fetch(`${API_BASE}/nlp/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: questionText,
          tasks: tasks
        })
      });

      if (!queryResponse.ok) throw new Error('Failed to process query');
      const queryData = await queryResponse.json();

      let answer = queryData.answer;
      // Customize out-of-scope response
      if (queryData.type === 'unknown') {
        answer = "I'm here to help you with task scheduling, managing your profile, and navigating the app. I can't help with shopping or other unrelated topics.";
      }

      const responseMessage = {
        id: generateMessageId(),
        text: answer,
        isUser: false,
        timestamp: new Date(),
        ...queryData
      };
      setMessages(prev => [...prev, responseMessage]);
      speakIfEnabled(responseMessage.text);

      // Refresh tasks if needed
      if (questionText.toLowerCase().includes('task') &&
        (questionText.toLowerCase().includes('count') ||
          questionText.toLowerCase().includes('how many'))) {
        // Fetch fresh task count
        // Note: We don't have a direct refetch function here, but the UI might update via other means
      }
    } catch (error) {
      console.error('Error processing question:', error);
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        text: "I'm sorry, but I wasn't able to understand your question. Could you please rephrase it?",
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
      // Return basic fallback
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

  const handleVoiceInput = async (text) => {
    const transcript = text.trim();

    if (!transcript) return;

    setInput(transcript);
    // Send the transcript directly so we don't depend on async state updates.
    await sendMessage(transcript);
  };

  const startVoiceInput = async () => {
    // Check if browser supports Speech Recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in your browser. Please use Chrome or Edge for voice features.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleVoiceInput(transcript);
      recognition.stop();
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      let errorMessage = 'Sorry, there was an error with voice recognition. Please try again.';

      switch (event.error) {
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings and try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your microphone settings and try again.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your internet connection and try again.';
          break;
        case 'not-supported':
          errorMessage = 'Speech recognition not supported in your browser. Please use Chrome or Edge.';
          break;
        case 'aborted':
          errorMessage = 'Speech recognition was aborted. Please try speaking again.';
          break;
        case 'language-not-supported':
          errorMessage = 'Language not supported. Please try speaking in English.';
          break;
        case 'no-speech':
          errorMessage = 'No speech detected. Please try speaking more clearly or closer to the microphone.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}. Please try again.`;
      }

      alert(errorMessage);
      recognition.stop();
    };

    recognition.onend = () => {
      // Recognition ended
    };
  };

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Chat Header */}
      <div className="bg-white rounded-t-xl shadow-lg border border-[var(--border-subtle)] flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[var(--text-main)] font-semibold">
            <Zap className="h-4 w-4 text-[var(--accent-base)]" />
            Assistant
          </h3>
        </div>
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className="text-[var(--text-muted)] hover:text-[var(--accent-base)] p-1 rounded"
          title={voiceEnabled ? 'Disable voice response' : 'Enable voice response'}
        >
          {voiceEnabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 bg-white border-l border-r border-[var(--border-subtle)] overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(message => (
          <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl ${message.isUser
              ? 'bg-[var(--accent-base)] text-white'
              : 'bg-[var(--bg-hover)] text-[var(--text-main)]'
              }`}>
              <p className="whitespace-pre-wrap">{message.text}</p>
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
      </div>

      {/* Chat Input */}
      <div className="bg-white border-b border-[var(--border-subtle)] flex items-center px-4 py-2">
        <button
          onClick={startVoiceInput}
          className="text-[var(--text-muted)] hover:text-[var(--accent-base)] p-1 rounded"
          title="Voice input"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 0 1-14 0M12 18v4M8 22h8" /></svg>
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask me to schedule a task or answer a question..."
          className="flex-1 px-3 py-2 border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-base)] text-sm"
        />

        <button
          onClick={() => sendMessage()}
          disabled={isLoading || !input.trim()}
          className={`ml-2 px-4 py-2 rounded-lg ${isLoading || !input.trim()
            ? 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
            : 'bg-[var(--accent-base)] text-white'
            }`}
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}