import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, AtSign, ChevronDown, ChevronUp, MoreHorizontal, Search, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './CommunityView.css';

const API_BASE = '/api/community';
const SORTS = [['new', 'New']];
const REACTIONS = ['??', '??', '??', '??', '??', 'LOCK'];

function initials(name) {
  return String(name || 'C').slice(0, 1).toUpperCase();
}

function timeAgo(input) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(input).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

function authHeaders(token, extra = {}) {
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

function renderText(text) {
  return String(text || '').split(/(@[a-zA-Z0-9_.-]+)/g).map((part, index) => (
    part.startsWith('@') ? <span key={index} className="chat-mention">{part}</span> : part
  ));
}


function isMediaUrl(value) {
  return /^data:image\//i.test(value) || /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(?:\?\S*)?$/i.test(value);
}

function splitMessageContent(content) {
  const parts = String(content || '').split(/\s+/).filter(Boolean);
  const media = parts.filter(isMediaUrl);
  const text = String(content || '').split(/\s+/).filter((part) => !isMediaUrl(part)).join(' ').trim();
  return { text, media };
}

function MessageContent({ content }) {
  const { text, media } = splitMessageContent(content);
  return (
    <>
      {text && <p className="message-text">{renderText(text)}</p>}
      {media.length > 0 && (
        <div className="message-media-grid">
          {media.map((src, index) => <img key={`${src}-${index}`} src={src} alt="Shared media" loading="lazy" />)}
        </div>
      )}
    </>
  );
}
function ReactionPicker({ onPick }) {
  return (
    <div className="chat-reaction-popover">
      {REACTIONS.map((reaction) => (
        <button key={reaction} onClick={() => onPick(reaction)}>{reaction}</button>
      ))}
    </div>
  );
}

function Composer({ placeholder, onSubmit, requireAuth, compact = false, autoFocus = false }) {
  const [text, setText] = useState('');
  const [media, setMedia] = useState([]);
  const fileRef = useRef(null);

  const addFile = (file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    if (file.size > 350 * 1024) {
      alert('Image is too large for chat preview. Use a GIF/image link for bigger media.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setMedia((items) => [...items, String(reader.result)]);
    reader.readAsDataURL(file);
  };

  const submit = () => {
    const clean = [text.trim(), ...media].filter(Boolean).join('\n').trim();
    if (!clean) return;
    onSubmit(clean);
    setText('');
    setMedia([]);
  };

  return (
    <div className={`discord-composer ${compact ? 'compact' : ''}`}>
      <input ref={fileRef} type="file" accept="image/*,.gif" hidden onChange={(event) => { addFile(event.target.files?.[0]); event.target.value = ''; }} />
      <button className="composer-icon" type="button" onClick={() => { requireAuth(); fileRef.current?.click(); }} aria-label="Attach image"><span>+</span></button>
      <div className="composer-input-stack">
        {media.length > 0 && (
          <div className="composer-media-preview">
            {media.map((src, index) => (
              <div key={src} className="composer-media-item">
                <img src={src} alt="Upload preview" />
                <button type="button" onClick={() => setMedia((items) => items.filter((_, i) => i !== index))}>x</button>
              </div>
            ))}
          </div>
        )}
        <textarea
          autoFocus={autoFocus}
          value={text}
          onFocus={requireAuth}
          onPaste={(event) => {
            const file = Array.from(event.clipboardData?.files || []).find((item) => item.type?.startsWith('image/'));
            if (file) addFile(file);
          }}
          onChange={(event) => setText(event.target.value.slice(0, 1800))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          rows={compact ? 1 : 2}
        />
      </div>
      <div className="composer-right-tools">
        <button type="button" onClick={() => setText((value) => `${value}@`)} aria-label="Mention"><AtSign size={18} /></button>
        <button className="send-btn" type="button" onClick={submit} aria-label="Send"><Send size={17} /></button>
      </div>
    </div>
  );
}

function MessageActions({ item, type, actions, requireAuth, onReply }) {
  const { user } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const own = user?.id && user.id === item.user?.id;
  const guard = (fn) => (user ? fn() : requireAuth());

  return (
    <div className="message-actions">
      <button className={item.viewerVote === 1 ? 'active' : ''} onClick={() => guard(() => actions.onVote(type, item.id, item.viewerVote === 1 ? 0 : 1))}>
        <ChevronUp size={15} />{item.score || 0}
      </button>
      <button className={item.viewerVote === -1 ? 'active danger' : ''} onClick={() => guard(() => actions.onVote(type, item.id, item.viewerVote === -1 ? 0 : -1))}>
        <ChevronDown size={15} />
      </button>
      <button className="reply-btn" onClick={() => guard(onReply)}>Reply</button>
      {(item.reactions || []).map((reaction) => (
        <button key={reaction.reaction} className={`reaction-chip ${reaction.reacted ? 'active' : ''}`} onClick={() => guard(() => actions.onReact(type, item.id, reaction.reaction))}>
          {reaction.reaction} {reaction.count}
        </button>
      ))}
      {own && (
        <div className="message-menu-wrap">
          <button onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal size={16} /></button>
          {menuOpen && (
            <div className="message-menu">
              <button className="danger" onClick={() => actions.onDelete(type, item.id)}><Trash2 size={14} />Delete</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChatMessage({ post, thread, repliesOpen, onToggleReplies, actions, requireAuth, onReplySubmit }) {
  const replies = thread?.comments || [];

  return (
    <article className="discord-message">
      <div className="chat-avatar">{initials(post.user?.name)}</div>
      <div className="chat-message-body">
        <div className="message-head">
          <button className="message-author">@{post.user?.name || 'Member'}</button>
          <span>{timeAgo(post.created_at)}</span>

        </div>
        <MessageContent content={post.content} />
        <MessageActions item={post} type="posts" actions={actions} requireAuth={requireAuth} onReply={onToggleReplies} />
        {post.replyCount > 0 && (
          <button className="view-replies-btn" onClick={onToggleReplies}>
            {repliesOpen ? 'Hide replies' : `View ${post.replyCount} ${post.replyCount === 1 ? 'reply' : 'replies'}`}
          </button>
        )}
        {repliesOpen && (
          <div className="reply-thread">
            {replies.map((reply) => (
              <div className="discord-reply" key={reply.id}>
                <div className="reply-line" />
                <div className="chat-avatar small">{initials(reply.user?.name)}</div>
                <div className="chat-message-body">
                  <div className="message-head"><strong>@{reply.user?.name || 'Member'}</strong><span>{timeAgo(reply.created_at)}</span></div>
                  <MessageContent content={reply.content} />
                  <MessageActions item={reply} type="comments" actions={actions} requireAuth={requireAuth} onReply={() => { }} />
                </div>
              </div>
            ))}
            <Composer compact autoFocus placeholder={`Reply to @${post.user?.name || 'Member'}...`} requireAuth={requireAuth} onSubmit={(content) => onReplySubmit(post, content)} />
          </div>
        )}
      </div>
    </article>
  );
}

export default function CommunityView({ onOpenAuth }) {
  const { token, user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [sport, setSport] = useState(null);
  const [posts, setPosts] = useState([]);
  const [sort, setSort] = useState('new');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openReplies, setOpenReplies] = useState(null);
  const [threadCache, setThreadCache] = useState({});
  const bottomRef = useRef(null);
  const currentRoom = rooms.find((room) => room.sport === sport);
  const requireAuth = () => { if (!user) onOpenAuth?.('login'); };

  const loadRooms = useCallback(async () => {
    const response = await fetch(`${API_BASE}/rooms`, { headers: authHeaders(token) });
    const data = await response.json();
    setRooms(data.rooms || []);
    if (!sport && data.rooms?.[0]) setSport(data.rooms[0].sport);
  }, [sport, token]);

  const loadPosts = useCallback(async (quiet = false) => {
    if (!sport) return;
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams({ sort });
      if (query.trim()) params.set('q', query.trim());
      const response = await fetch(`${API_BASE}/rooms/${sport}/posts?${params}`, { headers: authHeaders(token) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Load failed');
      setPosts([...(data.posts || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      setError('');
    } catch {
      setError("Couldn't load chat right now.");
    } finally {
      setLoading(false);
    }
  }, [sport, sort, query, token]);

  const loadThread = async (postId) => {
    const response = await fetch(`${API_BASE}/posts/${postId}/thread`, { headers: authHeaders(token) });
    const data = await response.json();
    if (response.ok) setThreadCache((prev) => ({ ...prev, [postId]: data }));
  };

  const apiAction = async (url, options = {}) => {
    if (!token) return requireAuth();
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: authHeaders(token, { 'Content-Type': 'application/json', ...(options.headers || {}) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Action failed');
    return data;
  };

  useEffect(() => { loadRooms().finally(() => setLoading(false)); }, [loadRooms]);
  useEffect(() => { loadPosts(); }, [loadPosts]);
  useEffect(() => {
    if (!sport) return undefined;
    const interval = setInterval(() => loadPosts(true), 5000);
    return () => clearInterval(interval);
  }, [sport, loadPosts]);
  useEffect(() => {
    if (posts.length) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [posts.length]);

  const createPost = async (content) => {
    await apiAction(`/rooms/${sport}/posts`, { method: 'POST', body: JSON.stringify({ content }) });
    await loadPosts(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  };

  const createReply = async (post, content) => {
    await apiAction(`/posts/${post.id}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
    await loadThread(post.id);
    await loadPosts(true);
  };

  const refreshAfterAction = async () => {
    if (openReplies) await loadThread(openReplies);
    await loadPosts(true);
  };

  const actions = {
    onVote: async (type, id, value) => { await apiAction(`/${type}/${id}/vote`, { method: 'POST', body: JSON.stringify({ value }) }); await refreshAfterAction(); },
    onReact: async (type, id, reaction) => { await apiAction(`/${type}/${id}/reactions`, { method: 'POST', body: JSON.stringify({ reaction }) }); await refreshAfterAction(); },
    onDelete: async (type, id) => { await apiAction(`/${type}/${id}`, { method: 'DELETE' }); await loadPosts(true); }
  };

  return (
    <section className="discord-community">
      <aside className="room-rail">
        <div className="room-rail-title">Rooms</div>
        {rooms.map((room) => (
          <button key={room.sport} className={room.sport === sport ? 'active' : ''} onClick={() => setSport(room.sport)} title={room.title}>
            <span>{room.emoji}</span>
            <strong>{room.sport.toUpperCase()}</strong>
          </button>
        ))}
      </aside>

      <div className="discord-channel">
        <header className="discord-channel-header">
          <div className="channel-title-line">
            <button className="back-link" onClick={() => setSport(null)}><ArrowLeft size={15} /></button>
            <span className="channel-hash">#</span>
            <div>
              <h1>{currentRoom?.emoji} {currentRoom?.title || 'Community'}</h1>
              <p>{currentRoom?.description || 'Live sports discussion'}</p>
            </div>
          </div>
        </header>

        <div className="discord-tabs">
          {SORTS.map(([id, label]) => <button key={id} className={sort === id ? 'active' : ''} onClick={() => setSort(id)}>{label}</button>)}
        </div>

        {error && <div className="chat-error">{error}</div>}

        <main className="discord-feed">
          {loading ? (
            <div className="chat-empty">Loading chat...</div>
          ) : posts.length === 0 ? (
            <div className="chat-empty"><h3>Welcome to {currentRoom?.title}</h3><p>Start the conversation.</p></div>
          ) : posts.map((post) => (
            <ChatMessage
              key={post.id}
              post={post}
              thread={threadCache[post.id]}
              repliesOpen={openReplies === post.id}
              requireAuth={requireAuth}
              actions={actions}
              onReplySubmit={createReply}
              onToggleReplies={async () => {
                const next = openReplies === post.id ? null : post.id;
                setOpenReplies(next);
                if (next) await loadThread(post.id);
              }}
            />
          ))}
          <div ref={bottomRef} />
        </main>

        <footer className="discord-composer-shell">
          <Composer placeholder={`Message #${currentRoom?.sport || 'chat'}`} requireAuth={requireAuth} onSubmit={createPost} />
        </footer>
      </div>
    </section>
  );
}







