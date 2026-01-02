import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Search, ArrowUp, ChevronDown, ChevronUp, Brain, Heart } from 'lucide-react';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import { COUNCIL_MODES } from '../api';
import './ChatInterface.css';

function WingmanMessage({ msg }) {
  const [expandedStage, setExpandedStage] = useState(null);
  const stage1Ref = useRef(null);

  const toggleStage = (stage) => {
    setExpandedStage(prev => {
      const newState = prev === stage ? null : stage;
      if (newState) {
        setTimeout(() => {
          if (stage1Ref.current) {
            stage1Ref.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            });
          }
        }, 50);
      }
      return newState;
    });
  };

  return (
    <div className="assistant-message wingman-message">
      <div className="message-label">
        <Heart size={14} className="label-icon wingman-icon" />
        Wingman Council
      </div>

      {msg.loading?.stage2 && (
        <div className="stage-loading">
          <div className="spinner"></div>
          <span>Curating best recommendations...</span>
        </div>
      )}
      
      {msg.stage2 && msg.stage2.response && (
        <div className="wingman-response">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {msg.stage2.response}
          </ReactMarkdown>
        </div>
      )}
      
      {msg.stage2 && !msg.stage2.response && (
        <div className="wingman-response error">
          <p>No response was generated. Please try again.</p>
        </div>
      )}

      {msg.stage1 && (
        <div className="collapsible-stage" ref={stage1Ref}>
          <button
            className="stage-toggle"
            onClick={() => toggleStage('stage1')}
            aria-expanded={expandedStage === 'stage1'}
          >
            <span className="stage-toggle-title">
              <Heart size={16} /> View All Suggestions ({msg.metadata?.total_suggestions_collected || msg.stage1.length * 5} from {msg.stage1.length} models)
            </span>
            {expandedStage === 'stage1' ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </button>
          <div className={`stage-content ${expandedStage === 'stage1' ? 'expanded' : 'collapsed'}`}>
            <Stage1 responses={msg.stage1} isWingman={true} />
          </div>
        </div>
      )}
      {msg.loading?.stage1 && !msg.stage1 && (
        <div className="stage-loading">
          <div className="spinner"></div>
          <span>Gathering wingman suggestions...</span>
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ msg }) {
  const [expandedStage, setExpandedStage] = useState(null);
  const stage1Ref = useRef(null);
  const stage2Ref = useRef(null);

  if (msg.mode === 'wingman') {
    return <WingmanMessage msg={msg} />;
  }

  const toggleStage = (stage) => {
    setExpandedStage(prev => {
      const newState = prev === stage ? null : stage;
      
      if (newState) {
        setTimeout(() => {
          const ref = stage === 'stage1' ? stage1Ref : stage2Ref;
          if (ref.current) {
            ref.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            });
          }
        }, 50);
      }
      
      return newState;
    });
  };

  return (
    <div className="assistant-message">
      <div className="message-label">
        <Brain size={14} className="label-icon" />
        LLM Council
      </div>

      {msg.loading?.stage3 && (
        <div className="stage-loading">
          <div className="spinner"></div>
          <span>Synthesizing final answer...</span>
        </div>
      )}
      {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}

      {msg.stage1 && (
        <div className="collapsible-stage" ref={stage1Ref}>
          <button
            className="stage-toggle"
            onClick={() => toggleStage('stage1')}
            aria-expanded={expandedStage === 'stage1'}
          >
            <span className="stage-toggle-title">
              <Brain size={16} /> View Individual Responses ({msg.stage1.length} models)
            </span>
            {expandedStage === 'stage1' ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </button>
          <div className={`stage-content ${expandedStage === 'stage1' ? 'expanded' : 'collapsed'}`}>
            <Stage1 responses={msg.stage1} />
          </div>
        </div>
      )}
      {msg.loading?.stage1 && !msg.stage1 && (
        <div className="stage-loading">
          <div className="spinner"></div>
          <span>Collecting individual responses...</span>
        </div>
      )}

      {msg.stage2 && (
        <div className="collapsible-stage" ref={stage2Ref}>
          <button
            className="stage-toggle"
            onClick={() => toggleStage('stage2')}
            aria-expanded={expandedStage === 'stage2'}
          >
            <span className="stage-toggle-title">
              <Brain size={16} /> View Peer Rankings & Analysis
            </span>
            {expandedStage === 'stage2' ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </button>
          <div className={`stage-content ${expandedStage === 'stage2' ? 'expanded' : 'collapsed'}`}>
            <Stage2
              rankings={msg.stage2}
              labelToModel={msg.metadata?.label_to_model}
              aggregateRankings={msg.metadata?.aggregate_rankings}
            />
          </div>
        </div>
      )}
      {msg.loading?.stage2 && !msg.stage2 && (
        <div className="stage-loading">
          <div className="spinner"></div>
          <span>Collecting peer rankings...</span>
        </div>
      )}
    </div>
  );
}

function ModeSelector({ mode, onModeChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const modes = [
    { id: COUNCIL_MODES.THINKING, label: 'Analytical', icon: Brain },
    { id: COUNCIL_MODES.WINGMAN, label: 'Wingman', icon: Heart },
  ];

  const currentMode = modes.find(m => m.id === mode) || modes[0];
  const CurrentIcon = currentMode.icon;

  return (
    <div className="mode-selector" ref={dropdownRef}>
      <button
        type="button"
        className="mode-selector-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label="Select mode"
      >
        <CurrentIcon size={16} />
        <ChevronDown size={14} className={`mode-chevron ${isOpen ? 'open' : ''}`} />
      </button>
      {isOpen && (
        <div className="mode-dropdown">
          {modes.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                className={`mode-option ${mode === m.id ? 'active' : ''}`}
                onClick={() => {
                  onModeChange(m.id);
                  setIsOpen(false);
                }}
              >
                <Icon size={16} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
  mode,
  onModeChange,
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '24px';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input, mode);
      setInput('');
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = '24px';
        }
      }, 0);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!conversation) {
    return (
      <div className="chat-interface">
        <div className="messages-container">
          <div className="empty-state">
            <div className="empty-state-header">
              <div className="empty-state-logo">
                <Sparkles />
                LLM Council
              </div>
            </div>
            <div className="input-form-wrapper">
              <form className="input-form" onSubmit={handleSubmit}>
                <div className="input-icon">
                  <Search size={20} />
                </div>
                <textarea
                  ref={textareaRef}
                  className="message-input"
                  placeholder={mode === COUNCIL_MODES.WINGMAN ? "Describe your situation..." : "What do you want to know?"}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  rows={1}
                />
                <div className="input-actions">
                  <ModeSelector mode={mode} onModeChange={onModeChange} disabled={isLoading} />
                  <button
                    type="submit"
                    className="send-button"
                    disabled={!input.trim() || isLoading}
                    aria-label="Send message"
                  >
                    <ArrowUp size={18} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {conversation.messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-header">
              <div className="empty-state-logo">
                <Sparkles />
                LLM Council
              </div>
            </div>
            <div className="input-form-wrapper">
              <form className="input-form" onSubmit={handleSubmit}>
                <div className="input-icon">
                  <Search size={20} />
                </div>
                <textarea
                  ref={textareaRef}
                  className="message-input"
                  placeholder={mode === COUNCIL_MODES.WINGMAN ? "Describe your situation..." : "What do you want to know?"}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  rows={1}
                />
                <div className="input-actions">
                  <ModeSelector mode={mode} onModeChange={onModeChange} disabled={isLoading} />
                  <button
                    type="submit"
                    className="send-button"
                    disabled={!input.trim() || isLoading}
                    aria-label="Send message"
                  >
                    <ArrowUp size={18} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          conversation.messages.map((msg, index) => (
            <div key={index} className="message-group">
              {msg.role === 'user' ? (
                <div className="user-message">
                  <div className="message-label">You</div>
                  <div className="message-content">
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <AssistantMessage msg={msg} />
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>Consulting the council...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {conversation.messages.length > 0 && (
        <div className="input-form-wrapper">
          <form className="input-form" onSubmit={handleSubmit}>
            <div className="input-icon">
              <Search size={20} />
            </div>
            <textarea
              ref={textareaRef}
              className="message-input"
              placeholder={mode === COUNCIL_MODES.WINGMAN ? "Describe your situation..." : "Ask a follow-up question..."}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
            />
            <div className="input-actions">
              <ModeSelector mode={mode} onModeChange={onModeChange} disabled={isLoading} />
              <button
                type="submit"
                className="send-button"
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
