export interface SocketMessage {
  type: string;
  [key: string]: any;
}

export class RoomSocket {
  private ws: WebSocket | null = null;
  private listeners: Set<(msg: SocketMessage) => void> = new Set();
  private reconnectInterval: any = null;

  roomId: string;
  userId: string;
  userName: string;
  onOpen?: () => void;
  onClose?: () => void;

  constructor(
    roomId: string,
    userId: string,
    userName: string,
    onOpen?: () => void,
    onClose?: () => void
  ) {
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.connect();
  }

  private connect() {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const wsBase = apiBase.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/api/ws/${this.roomId}?userId=${encodeURIComponent(this.userId)}&userName=${encodeURIComponent(this.userName)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected to room:', this.roomId);
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }
      this.onOpen?.();
      // Request full sync immediately on connect/reconnect
      this.send({ type: 'ROOM_SYNC_REQUEST' });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.listeners.forEach((listener) => listener(msg));
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed. Attempting reconnect...');
      this.onClose?.();
      this.ws = null;
      if (!this.reconnectInterval) {
        this.reconnectInterval = setInterval(() => {
          this.connect();
        }, 3000);
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  public subscribe(callback: (msg: SocketMessage) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public send(msg: SocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('Socket not open. Cannot send message:', msg);
    }
  }

  public close() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }
}
