import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Stage1.css';

export default function Stage1({ responses, isWingman = false }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!responses || responses.length === 0) {
    return null;
  }

  const currentResponse = responses[activeTab];

  return (
    <div className={`stage stage1 ${isWingman ? 'wingman-stage' : ''}`}>
      <div className="tabs">
        {responses.map((resp, index) => (
          <button
            key={index}
            className={`tab ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {resp.model.split('/')[1] || resp.model}
          </button>
        ))}
      </div>

      <div className="tab-content">
        <div className="model-name">{currentResponse.model}</div>
        {isWingman && currentResponse.suggestions && currentResponse.suggestions.length > 0 ? (
          <div className="wingman-suggestions">
            {currentResponse.suggestions.map((suggestion, idx) => (
              <div key={idx} className="suggestion-item">
                <span className="suggestion-number">{idx + 1}</span>
                <span className="suggestion-text">{suggestion}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="response-text markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentResponse.response}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
