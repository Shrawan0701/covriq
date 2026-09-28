import React, { useEffect, useRef, useState } from 'react';
import { Bot, Paperclip, Send, X } from 'lucide-react';
import StructuredResponse from './StructuredResponse';
import { getModeById, DEFAULT_MODE } from '../config/discoverModes';
import { getSportUIConfig } from '../config/sportUIConfig';
import { useSport } from '../context/SportContext';
import './ChatWorkspace.css';

function cleanDisplayText(value) {
  return String(value || '')
    .replace(new RegExp('\\u00c3\\u0192[^\\s]*', 'g'), '')
    .replace(new RegExp('\\u00c3\\u00a2[^\\s]*', 'g'), '')
    .replace(new RegExp('\\u00c3\\u201a[^\\s]*', 'g'), '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function toImageList(images) {
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);
  return [images].filter(Boolean);
}

function readFilesAsDataUrls(files) {
  const imageFiles = Array.from(files || []).filter(file => file.type?.startsWith('image/'));
  return Promise.all(imageFiles.map(file => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, name: file.name || 'Screenshot' });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  }))).then(items => items.filter(Boolean));
}

export default function ChatWorkspace({
  activeMode,
  conversation,
  messages = [],
  isStreaming,
  streamingStatus,
  streamingContent,
  streamingStructured,
  onSendMessage,
  onOpenOddsCalc,
  onSavePick,
  savedItems = []
}) {
  const { sportId, leagueId, displayLabel } = useSport();
  const sportUI = getSportUIConfig(sportId, leagueId);
  const mode = getModeById(activeMode) || DEFAULT_MODE;
  const modeCopy = sportUI.modes?.[mode.id] || sportUI.modes?.[DEFAULT_MODE.id];
  const ModeIcon = mode.icon;

  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingContent, streamingStatus]);

  const addFiles = async (files) => {
    const next = await readFilesAsDataUrls(files);
    if (next.length) setSelectedImages(prev => [...prev, ...next]);
  };

  const submit = () => {
    const text = input.trim();
    const imagePayload = selectedImages.map(img => img.dataUrl);
    if ((!text && imagePayload.length === 0) || isStreaming) return;
    onSendMessage?.(text, imagePayload);
    setInput('');
    setSelectedImages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const onPaste = (event) => {
    const files = Array.from(event.clipboardData?.files || []).filter(file => file.type?.startsWith('image/'));
    if (files.length) addFiles(files);
  };

  const isSaved = (data) => {
    const title = data?.marketCard?.pick || data?.gameHeader?.matchup;
    return !!title && savedItems.some(item => item.title?.toLowerCase() === title.toLowerCase());
  };

  const renderUserImages = (metadata) => {
    const images = toImageList(metadata?.images || metadata?.image);
    if (!images.length) return null;
    return (
      <div className="image-attachment-preview multi">
        <div className="preview-strip">
          {images.map((src, idx) => (
            <div className="preview-item" key={`${src}-${idx}`}>
              <img src={src} alt={`Uploaded screenshot ${idx + 1}`} className="preview-thumb" />
              <span className="preview-name">Screenshot {idx + 1}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const hasConversation = messages.length > 0 || isStreaming;
  const titleText = cleanDisplayText(conversation?.title || mode.label);
  const statusText = cleanDisplayText(streamingStatus);

  return (
    <div className="chat-workspace">
      <div className="workspace-top-bar">
        <div className="mode-indicator-pill">
          <ModeIcon size={14} />
          <span>{mode.label}</span>
        </div>
        {hasConversation && <div className="sport-detected-tag">{displayLabel || titleText}</div>}
      </div>

      <div className="messages-container" ref={scrollRef}>
        {!hasConversation && (
          <div className="empty-workspace-hero">
            <div className="hero-badge"><ModeIcon size={15} /> {mode.label}</div>
            <h1 className="hero-title">{modeCopy?.greeting || `How can I help with today's ${sportUI.displayName} board?`}</h1>
            <div className="hero-filter-bar">
              {(modeCopy?.prompts || []).slice(0, 4).map((prompt) => (
                <button className="filter-pill-btn" key={prompt.label} onClick={() => setInput(prompt.prompt)}>
                  <span className="pill-label">{prompt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, idx) => {
          const isUser = message.role === 'user';
          return (
            <div className={`message-row ${isUser ? 'user' : 'ai'}`} key={message.id || idx}>
              {!isUser && <div className="message-avatar ai"><Bot size={16} /></div>}
              <div className={isUser ? 'message-bubble-user' : 'message-body-ai'}>
                {isUser ? (
                  <>
                    {message.content && <div>{message.content}</div>}
                    {renderUserImages(message.metadata)}
                  </>
                ) : (
                  <StructuredResponse
                    structuredData={message.metadata}
                    rawContent={message.content}
                    onOpenOddsCalc={onOpenOddsCalc}
                    onSavePick={onSavePick}
                    isSaved={isSaved(message.metadata)}
                  />
                )}
              </div>
              {isUser && <div className="message-avatar user">You</div>}
            </div>
          );
        })}

        {isStreaming && (
          <div className="message-row ai">
            <div className="message-avatar ai"><Bot size={16} /></div>
            <div className="message-body-ai">
              {statusText && (
                <div className="streaming-status-card">
                  <span className="status-spinner" />
                  <span>{statusText}</span>
                </div>
              )}
              {streamingContent && (
                <StructuredResponse
                  structuredData={streamingStructured}
                  rawContent={streamingContent}
                  onOpenOddsCalc={onOpenOddsCalc}
                  onSavePick={onSavePick}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-wrapper">
        <div className="chat-input-box">
          {selectedImages.length > 0 && (
            <div className="image-attachment-preview multi">
              <div className="preview-strip">
                {selectedImages.map((img, idx) => (
                  <div className="preview-item" key={`${img.name}-${idx}`}>
                    <img src={img.dataUrl} alt={img.name} className="preview-thumb" />
                    <div className="preview-info">
                      <span className="preview-name">{img.name}</span>
                      <span className="preview-tag">Screenshot {idx + 1}</span>
                    </div>
                    <button className="remove-image-btn" onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))} title="Remove screenshot">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={sportUI.placeholder}
            rows={2}
            disabled={isStreaming}
          />

          <div className="input-toolbar">
            <div className="toolbar-left">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => addFiles(event.target.files)}
              />
              <button className="upload-btn-label" onClick={() => fileInputRef.current?.click()} disabled={isStreaming} title="Attach screenshots">
                <Paperclip size={18} />
              </button>
              <span className="mode-badge-pill">{selectedImages.length ? `${selectedImages.length} screenshots` : mode.label}</span>
            </div>
            <button className="send-btn" onClick={submit} disabled={isStreaming || (!input.trim() && selectedImages.length === 0)} title="Send">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}