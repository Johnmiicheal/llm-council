import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Search, ArrowUp } from 'lucide-react';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import './ChatInterface.css';

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
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
      onSendMessage(input);
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
                  placeholder="What do you want to know?"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  rows={1}
                />
                <button
                  type="submit"
                  className="send-button"
                  disabled={!input.trim() || isLoading}
                  aria-label="Send message"
                >
                  <ArrowUp size={18} />
                </button>
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
                  placeholder="What do you want to know?"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  rows={1}
                />
                <button
                  type="submit"
                  className="send-button"
                  disabled={!input.trim() || isLoading}
                  aria-label="Send message"
                >
                  <ArrowUp size={18} />
                </button>
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
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="assistant-message">
                  <div className="message-label">LLM Council</div>

                  {/* Stage 1 */}
                  {msg.loading?.stage1 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>Running Stage 1: Collecting individual responses...</span>
                    </div>
                  )}
                  {msg.stage1 && <Stage1 responses={msg.stage1} />}

                  {/* Stage 2 */}
                  {msg.loading?.stage2 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>Running Stage 2: Peer rankings...</span>
                    </div>
                  )}
                  {msg.stage2 && (
                    <Stage2
                      rankings={msg.stage2}
                      labelToModel={msg.metadata?.label_to_model}
                      aggregateRankings={msg.metadata?.aggregate_rankings}
                    />
                  )}

                  {/* Stage 3 */}
                  {msg.loading?.stage3 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>Running Stage 3: Final synthesis...</span>
                    </div>
                  )}
                  {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}
                </div>
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
              placeholder="Ask a follow-up question..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
            />
            <button
              type="submit"
              className="send-button"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              <ArrowUp size={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
