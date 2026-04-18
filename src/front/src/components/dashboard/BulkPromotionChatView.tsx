import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { MessageSquare, Send, Loader2, Pencil, Trash2, X, Check, ShieldAlert } from 'lucide-react';
import { mitAPI, apiClient } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';
import { encodeWire, decodeWire, WIRE } from '../../services/chatWire';

const MAX_MESSAGE_LENGTH = 2000;
const WS_PATH = '/ws/chat';

interface ChatMessage {
  id: number;
  user_id: number;
  username: string | null;
  message: string;
  created_at: string;
}

function formatMessageTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (isToday) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    if (isYesterday) return `Dün ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function getInitial(name: string | null, fallbackId: number): string {
  if (name && name.length > 0) return name.charAt(0).toUpperCase();
  return String(fallbackId % 10);
}

function getChatWsUrl(): string {
  const base = apiClient.defaults.baseURL || import.meta.env.VITE_API_URL || 'https://api.habbojoh.com.tr/v1';
  const wsBase = String(base).replace(/^https/, 'wss').replace(/^http/, 'ws');
  return wsBase + WS_PATH;
}

export function BulkPromotionChatView() {
  const { user } = useAppStore();
  const currentUserId = user?.id != null ? String(user.id) : null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'>('idle');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    const newCount = messages.length;
    const hadMessages = prevMessagesLengthRef.current > 0;
    prevMessagesLengthRef.current = newCount;
    if (newCount === 0) return;
    if (!hadMessages || isNearBottom) scrollToBottom(hadMessages);
  }, [messages, scrollToBottom]);

  useEffect(() => {
    let mounted = true;
    let ws: WebSocket | null = null;

    const connect = async () => {
      setConnectionStatus('connecting');
      try {
        const res = await mitAPI.getChatWsToken();
        if (!mounted || res.success !== 1 || !res.token) {
          setConnectionStatus('error');
          toast.error('Sohbet token alınamadı');
          return;
        }
        const url = getChatWsUrl();
        ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mounted || !ws) return;
          ws.send(encodeWire(WIRE.AUTH, { token: res.token }));
        };

        ws.onmessage = (event) => {
          if (!mounted) return;
          try {
            const data = event.data instanceof ArrayBuffer ? event.data : new Uint8Array(event.data).buffer;
            const { type, payload } = decodeWire(data);
            switch (type) {
              case WIRE.AUTH_OK:
                setConnectionStatus('connected');
                break;
              case WIRE.HISTORY:
                if (Array.isArray(payload?.messages)) setMessages(payload.messages);
                break;
              case WIRE.MESSAGE:
                setMessages((prev) => {
                  const next = prev.filter((m) => m.id !== (payload?.id));
                  next.push(payload);
                  next.sort((a, b) => a.id - b.id);
                  return next;
                });
                break;
              case WIRE.EDIT_BROADCAST:
                if (payload?.id != null) {
                  setMessages((prev) => prev.map((m) => (m.id === payload.id ? { ...m, ...payload } : m)));
                }
                break;
              case WIRE.DELETE_BROADCAST:
                if (payload?.id != null) setMessages((prev) => prev.filter((m) => m.id !== payload.id));
                break;
              case WIRE.ERROR:
                toast.error(payload?.error || 'Sunucu hatası');
                break;
              case WIRE.PONG:
                break;
              default:
                break;
            }
          } catch (e) {
            console.error('Chat wire decode:', e);
          }
        };

        ws.onclose = () => {
          if (mounted) setConnectionStatus('disconnected');
          wsRef.current = null;
        };

        ws.onerror = () => {
          if (mounted) setConnectionStatus('error');
        };
      } catch (e: any) {
        if (mounted) {
          setConnectionStatus('error');
          toast.error(e.response?.data?.error || e.message || 'Bağlantı kurulamadı');
        }
      }
    };

    connect();
    return () => {
      mounted = false;
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      wsRef.current = null;
    };
  }, []);

  const sendPacket = useCallback((type: number, payload: object) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(encodeWire(type, payload));
    return true;
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sending) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      toast.error(`En fazla ${MAX_MESSAGE_LENGTH} karakter yazabilirsiniz.`);
      return;
    }
    setSending(true);
    if (sendPacket(WIRE.SEND, { message: text })) {
      setInput('');
    } else {
      toast.error('Bağlantı yok');
    }
    setSending(false);
  };

  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id);
    setEditText(m.message);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = () => {
    const text = editText.trim();
    if (editingId == null || !text) {
      cancelEdit();
      return;
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      toast.error(`En fazla ${MAX_MESSAGE_LENGTH} karakter.`);
      return;
    }
    if (!sendPacket(WIRE.EDIT, { message_id: editingId, message: text })) {
      toast.error('Bağlantı yok');
      return;
    }
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;
    if (!sendPacket(WIRE.DELETE, { message_id: id })) toast.error('Bağlantı yok');
  };

  const loading = connectionStatus === 'connecting' || connectionStatus === 'idle';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-100">Toplu Terfi Sohbet</h1>
            <p className="text-sm text-gray-500">Yüksek rütbe oyuncuları burada genel sohbet yapabilir.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500' : connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-gray-500'}`} title={connectionStatus} />
          <span className="text-xs text-gray-500">
            {connectionStatus === 'connected' ? 'Bağlı' : connectionStatus === 'connecting' ? 'Bağlanıyor...' : connectionStatus === 'error' ? 'Hata' : 'Bağlantı yok'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
        <span>Bu sohbet şifrelenmemiştir. Özel veya gizli bilgilerinizi paylaşmayınız.</span>
      </div>

      <Card className="flex flex-col overflow-hidden border border-gray-700/80 bg-gray-900/50 shadow-xl" style={{ minHeight: '480px' }}>
        <div ref={listRef} className="flex-1 overflow-y-auto min-h-[320px] max-h-[55vh] scroll-smooth">
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500/70" />
                <span className="text-sm text-gray-500">Bağlanıyor...</span>
              </div>
            ) : connectionStatus !== 'connected' && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-gray-500">Bağlantı kurulduğunda mesajlar burada görünecek.</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-700/50 text-gray-500">
                  <MessageSquare className="h-8 w-8" />
                </div>
                <p className="text-gray-400 font-medium">Henüz mesaj yok</p>
                <p className="mt-1 text-sm text-gray-500 max-w-xs">İlk mesajı siz yazarak sohbeti başlatın.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isOwn = currentUserId != null && String(m.user_id) === currentUserId;
                const displayName = m.username || `Kullanıcı #${m.user_id}`;
                const isEditing = editingId === m.id;

                return (
                  <div key={m.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${isOwn ? 'bg-emerald-500/30 text-emerald-300' : 'bg-gray-600/60 text-gray-300'}`} title={displayName}>
                      {getInitial(m.username, m.user_id)}
                    </div>
                    <div className={`flex min-w-0 max-w-[85%] flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${isOwn ? 'text-emerald-400/90' : 'text-gray-400'}`}>{displayName}</span>
                        <span className="text-xs text-gray-600">{formatMessageTime(m.created_at)}</span>
                        {isOwn && !isEditing && (
                          <span className="flex gap-1">
                            <button type="button" onClick={() => startEdit(m)} className="p-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-600/50" title="Düzenle">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => handleDelete(m.id)} className="p-0.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-600/50" title="Sil">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="mt-0.5 flex flex-col gap-2 w-full max-w-md">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            maxLength={MAX_MESSAGE_LENGTH}
                            className="rounded-xl border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={cancelEdit}>
                              <X className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={saveEdit}>
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className={`mt-0.5 rounded-2xl px-4 py-2.5 text-[15px] leading-snug break-words ${isOwn ? 'bg-emerald-500/25 text-gray-100 border border-emerald-500/20 rounded-br-md' : 'bg-gray-700/50 text-gray-200 border border-gray-600/50 rounded-bl-md'}`}>
                          {m.message}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-gray-700/80 bg-gray-800/30 p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Mesajınızı yazın..."
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={connectionStatus !== 'connected'}
                className="w-full rounded-xl border border-gray-600 bg-gray-800/80 px-4 py-3 pr-16 text-gray-100 placeholder-gray-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors disabled:opacity-60"
              />
              {input.length > 1800 && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">{input.length}/{MAX_MESSAGE_LENGTH}</span>
              )}
            </div>
            <Button
              onClick={handleSend}
              disabled={sending || !input.trim() || connectionStatus !== 'connected'}
              title="Gönder"
              className="shrink-0 rounded-xl px-4 bg-emerald-600 hover:bg-emerald-500 text-white border-0 focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
