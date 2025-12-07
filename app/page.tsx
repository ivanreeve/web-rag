'use client';


import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Bot,
  User,
  Database,
  Plus,
  Trash2,
  MessageSquare,
  Search,
  X,
  ChevronLeft,
  BookOpen
} from 'lucide-react';

// --- Types ---

interface KnowledgeBase {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  usedContext?: string[]; // IDs of KBs used
}

// --- Mock AI Logic ---

const MOCK_AI_RESPONSES = [
  "That's an interesting point. Tell me more.",
  "I can certainly help with that based on the context provided.",
  "Here's a summary of what I found in your knowledge base.",
  "Could you clarify exactly what you mean?",
  "Let me analyze that information for you."
];

const generateResponse = async (
  userMessage: string,
  knowledgeBases: KnowledgeBase[]
): Promise<{ text: string; usedContext: string[] }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // 1. Detect mentions in format @[Title]
      const mentionRegex = /@\[([^\]]+)\]/g;
      const matches = [...userMessage.matchAll(mentionRegex)];
      const mentionedTitles = matches.map(m => m[1]);

      const usedKBs = knowledgeBases.filter(kb => mentionedTitles.includes(kb.title));

      let responseText = "";

      if (usedKBs.length > 0) {
        const contextSummary = usedKBs.map(kb => `"${kb.title}"`).join(' and ');
        responseText = `I've analyzed the content from ${contextSummary}. \n\nBased on that knowledge: ${MOCK_AI_RESPONSES[Math.floor(Math.random() * MOCK_AI_RESPONSES.length)]}\n\n(Context used: ${usedKBs[0].content.substring(0, 50)}...)`;
      } else {
        responseText = `I received your message: "${userMessage}". I didn't see any specific knowledge base tagged, so I'm answering with my general training.`;
      }

      resolve({
        text: responseText,
        usedContext: usedKBs.map(kb => kb.id)
      });
    }, 1000 + Math.random() * 1000); // Random delay 1-2s
  });
};

// --- Components ---

export default function App() {
  const [view, setView] = useState<'chat' | 'knowledge'>('chat');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([
    { id: '1', title: 'Product Docs', content: 'The product allows users to chat with documents. It supports markdown and exports.', tags: ['docs', 'manual'] },
    { id: '2', title: 'Marketing Copy', content: 'Our brand voice is friendly, professional, and concise. We use blue and white as primary colors.', tags: ['brand', 'marketing'] },
    { id: '3', title: 'Q3 Financials', content: 'Revenue up 20% QoQ. Operating expenses stable. Key growth in enterprise sector.', tags: ['finance', 'private'] }
  ]);

  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: "Hello! You can chat with me normally, or type '@' to reference a Knowledge Base.", timestamp: Date.now() }
  ]);

  const handleCreateKB = (kb: KnowledgeBase) => {
    setKnowledgeBases(prev => [...prev, kb]);
    setView('knowledge'); // Stay in KB view or switch back?
  };

  const handleDeleteKB = (id: string) => {
    setKnowledgeBases(prev => prev.filter(k => k.id !== id));
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-16 md:w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 transition-all duration-300">
        <div className="p-4 flex items-center gap-3 font-bold text-xl border-b border-slate-800">
          <Bot className="text-blue-400 w-8 h-8" />
          <span className="hidden md:block">NexusChat</span>
        </div>

        <nav className="flex-1 p-2 space-y-2 mt-4">
          <button
            onClick={() => setView('chat')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${view === 'chat' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <MessageSquare size={20} />
            <span className="hidden md:block">Chat</span>
          </button>

          <button
            onClick={() => setView('knowledge')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${view === 'knowledge' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Database size={20} />
            <span className="hidden md:block">Knowledge</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 hidden md:block">
          <p>v1.0.4 Beta</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {view === 'chat' ? (
          <ChatInterface
            knowledgeBases={knowledgeBases}
            messages={messages}
            setMessages={setMessages}
          />
        ) : (
          <KnowledgeManager
            knowledgeBases={knowledgeBases}
            onCreate={handleCreateKB}
            onDelete={handleDeleteKB}
          />
        )}
      </div>
    </div>
  );
}

// --- Chat Interface Component ---

function ChatInterface({
  knowledgeBases,
  messages,
  setMessages
}: {
  knowledgeBases: KnowledgeBase[],
  messages: Message[],
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
}) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Handle Input Change to detect '@'
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setInput(newVal);

    // Simple logic: Look for @ symbol at the end or followed by text without spaces
    const lastAtPos = newVal.lastIndexOf('@');

    if (lastAtPos !== -1) {
      const textAfterAt = newVal.slice(lastAtPos + 1);
      // Only trigger if no spaces after @ (simple username/tag style detection)
      // or if it's the very last thing typed
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt);
        setMentionIndex(lastAtPos);
        return;
      }
    }

    setMentionQuery(null);
    setMentionIndex(-1);
  };

  const handleSelectKB = (kb: KnowledgeBase) => {
    if (mentionIndex === -1) return;

    const before = input.slice(0, mentionIndex);
    // Visual format: @[Title]
    const after = input.slice(mentionIndex + mentionQuery!.length + 1);
    const newText = `${before}@[${kb.title}] ${after}`;

    setInput(newText);
    setMentionQuery(null);
    setMentionIndex(-1);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await generateResponse(userMsg.content, knowledgeBases);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        usedContext: response.usedContext
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Error generating response", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If mention popup is open, maybe let them select? For now, we'll just prioritize sending unless they press Tab/Enter on the list (handled in list)
      // Ideally we would trap Enter if the menu is open, but for simplicity let's just send
      if (mentionQuery === null) {
        handleSend();
      }
    }
  };

  // Filter KBs for the popup
  const filteredKBs = useMemo(() => {
    if (mentionQuery === null) return [];
    return knowledgeBases.filter(kb =>
      kb.title.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [knowledgeBases, mentionQuery]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 shadow-sm flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">New Conversation</h2>
        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">
          {knowledgeBases.length} Sources Available
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 border border-blue-200">
                <Bot size={16} className="text-blue-600" />
              </div>
            )}

            <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`p-4 rounded-2xl shadow-sm text-sm whitespace-pre-wrap ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm'
                  }`}
              >
                {/* Basic Highlighting for mentions in output */}
                {msg.content.split(/(@\[[^\]]+\])/g).map((part, i) => {
                  if (part.startsWith('@[') && part.endsWith(']')) {
                    return <span key={i} className="font-bold text-yellow-300 mx-1">{part.slice(2, -1)}</span>;
                  }
                  return part;
                })}
              </div>

              {/* Context Indicator */}
              {msg.usedContext && msg.usedContext.length > 0 && (
                <div className="flex items-center gap-2 mt-2 ml-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Sources:</span>
                  <div className="flex gap-1">
                    {msg.usedContext.map(id => {
                      const kb = knowledgeBases.find(k => k.id === id);
                      return kb ? (
                        <span key={id} className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded border border-slate-300">
                          {kb.title}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 border border-slate-300">
                <User size={16} className="text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-4 max-w-4xl mx-auto justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200">
              <Bot size={16} className="text-blue-600" />
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-sm shadow-sm flex gap-2 items-center">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200 relative">
        <div className="max-w-4xl mx-auto relative">

          {/* Mention Popup */}
          {mentionQuery !== null && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-10 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
                <span>Knowledge Base</span>
                <span className="text-[10px] font-normal">Esc to close</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredKBs.length === 0 ? (
                  <div className="p-3 text-sm text-slate-400 italic">No matches found...</div>
                ) : (
                  filteredKBs.map(kb => (
                    <button
                      key={kb.id}
                      onClick={() => handleSelectKB(kb)}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2 group"
                    >
                      <BookOpen size={14} className="text-slate-400 group-hover:text-blue-500" />
                      <div>
                        <div className="text-sm font-medium">{kb.title}</div>
                        {kb.tags.length > 0 && (
                          <div className="text-[10px] text-slate-400">{kb.tags.join(', ')}</div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (use '@' to add knowledge)"
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl pl-4 pr-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none h-14 max-h-32 shadow-sm"
              style={{ minHeight: '56px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="text-center mt-2">
            <p className="text-[10px] text-slate-400">
              Tip: Type <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-bold">@</code> to open the knowledge base selector.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Knowledge Manager Component ---

function KnowledgeManager({
  knowledgeBases,
  onCreate,
  onDelete
}: {
  knowledgeBases: KnowledgeBase[],
  onCreate: (kb: KnowledgeBase) => void,
  onDelete: (id: string) => void
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    onCreate({
      id: Date.now().toString(),
      title: newTitle,
      content: newContent,
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean)
    });

    setIsCreating(false);
    setNewTitle('');
    setNewContent('');
    setNewTags('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
        <div className="flex justify-between items-center max-w-5xl mx-auto w-full">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Knowledge Base</h2>
            <p className="text-slate-500 mt-1">Manage external context for your AI assistant.</p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span>Add Source</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto w-full">

          {/* Create Modal/Card */}
          {isCreating && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-semibold text-lg">Add New Knowledge</h3>
                  <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="e.g., Project Alpha Specs"
                      className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={newTags}
                      onChange={e => setNewTags(e.target.value)}
                      placeholder="e.g., tech, internal, draft"
                      className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                    <textarea
                      value={newContent}
                      onChange={e => setNewContent(e.target.value)}
                      placeholder="Paste the context text here..."
                      className="w-full border border-slate-300 rounded-lg px-4 py-2 h-40 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newTitle || !newContent}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      Create Knowledge Base
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {knowledgeBases.map(kb => (
              <div key={kb.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <BookOpen size={20} />
                    </div>
                    <button
                      onClick={() => onDelete(kb.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1 truncate" title={kb.title}>{kb.title}</h3>
                  <p className="text-slate-500 text-sm line-clamp-3 leading-relaxed">
                    {kb.content}
                  </p>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl flex items-center gap-2 overflow-x-auto">
                  {kb.tags.length > 0 ? (
                    kb.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-medium uppercase tracking-wider text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-full whitespace-nowrap">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">No tags</span>
                  )}
                </div>
              </div>
            ))}

            {/* Empty State Helper */}
            {knowledgeBases.length === 0 && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <Search size={48} className="mb-4 opacity-20" />
                <p>No knowledge bases found.</p>
                <button
                  onClick={() => setIsCreating(true)}
                  className="mt-2 text-blue-600 font-medium hover:underline"
                >
                  Create your first one
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
