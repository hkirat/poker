import { createContext, useContext, useEffect, useRef, useCallback, useState, ReactNode } from 'react';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import { globalSoundPlayer } from '@/hooks/useSound';
import type { PlayerAction, Card, Player, GamePhase } from '@poker/types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

interface WebSocketContextType {
  isConnected: boolean;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  sendAction: (action: PlayerAction, amount?: number) => void;
  sendChatMessage: (message: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const token = useAuthStore((s) => s.token);
  const { updateGameState, setMyCards, setTimeRemaining, setConnected, setHandResult, setBustedPlayer, addChatMessage } = useGameStore();

  const handleMessage = useCallback((message: { type: string; payload: Record<string, unknown> }) => {
    console.log('WS Message:', message.type, message.payload);

    switch (message.type) {
      case 'auth_success':
        console.log('Authenticated:', message.payload);
        break;

      case 'joined_room':
        console.log('Joined room:', message.payload);
        break;

      case 'game_state':
      case 'new_round': {
        const payload = message.payload as {
          phase?: string;
          pot?: number;
          communityCards?: Card[];
          players?: Player[];
          currentPlayerIndex?: number;
          dealerIndex?: number;
          currentBet?: number;
          minRaise?: number;
          yourCards?: Card[];
        };

        // Play sounds for game events
        const currentState = useGameStore.getState();
        if (message.type === 'new_round') {
          // New hand - play card deal sound
          globalSoundPlayer.play('cardDeal');
        } else if (payload.communityCards && payload.communityCards.length > (currentState.communityCards?.length || 0)) {
          // New community cards dealt (flop/turn/river)
          globalSoundPlayer.play('cardFlip');
        }

        // Check if it's our turn now
        const currentUser = useAuthStore.getState().user;
        if (
          payload.players &&
          payload.currentPlayerIndex !== undefined &&
          payload.players[payload.currentPlayerIndex]?.userId === currentUser?.id &&
          currentState.players[currentState.currentPlayerIndex]?.userId !== currentUser?.id
        ) {
          globalSoundPlayer.play('yourTurn');
        }

        updateGameState({
          phase: payload.phase as GamePhase,
          pot: payload.pot,
          communityCards: payload.communityCards,
          players: payload.players,
          currentPlayerIndex: payload.currentPlayerIndex,
          dealerIndex: payload.dealerIndex,
          currentBet: payload.currentBet,
          minRaise: payload.minRaise,
        });

        if (payload.yourCards) {
          setMyCards(payload.yourCards);
        }

        setTimeRemaining(30);
        break;
      }

      case 'player_joined':
        console.log('Player joined:', message.payload);
        break;

      case 'player_left': {
        console.log('Player left:', message.payload);
        const leftPayload = message.payload as {
          userId: string;
          reason?: string;
        };
        // Update players list to remove the player
        const currentPlayers = useGameStore.getState().players;
        const leftPlayer = currentPlayers.find(p => p.userId === leftPayload.userId);
        updateGameState({
          players: currentPlayers.filter(p => p.userId !== leftPayload.userId),
        });
        // Show busted notification if the player ran out of chips
        if (leftPayload.reason === 'busted' && leftPlayer) {
          setBustedPlayer({
            userId: leftPayload.userId,
            username: leftPlayer.username,
          });
          // Clear notification after 3 seconds
          setTimeout(() => {
            setBustedPlayer(null);
          }, 3000);
        }
        break;
      }

      case 'player_sat_out': {
        const satOutPayload = message.payload as {
          userId: string;
          username: string;
          reason: string;
          chipsReturned: number;
        };
        console.log(`Player ${satOutPayload.username} was sat out (${satOutPayload.reason}), ${satOutPayload.chipsReturned} chips returned`);
        break;
      }

      case 'player_turn':
        setTimeRemaining(30);
        break;

      case 'action_result': {
        console.log('Action result:', message.payload);
        const actionPayload = message.payload as {
          userId: string;
          action: string;
          amount?: number;
        };
        // Play sound based on action
        switch (actionPayload.action) {
          case 'fold':
            globalSoundPlayer.play('fold');
            break;
          case 'check':
            globalSoundPlayer.play('check');
            break;
          case 'call':
          case 'raise':
          case 'all-in':
            globalSoundPlayer.play('chipsBet');
            break;
        }
        break;
      }

      case 'timer_update': {
        const timerPayload = message.payload as { remaining?: number; timedOut?: boolean; userId?: string };
        if (timerPayload.remaining !== undefined) {
          const seconds = Math.floor(timerPayload.remaining / 1000);
          setTimeRemaining(seconds);
          // Play warning sound when time is low and it's our turn
          const currentUserId = useAuthStore.getState().user?.id;
          if (seconds <= 10 && seconds > 0 && timerPayload.userId === currentUserId) {
            globalSoundPlayer.play('timerWarning');
          }
        }
        break;
      }

      case 'hand_result': {
        console.log('Hand result:', message.payload);
        const resultPayload = message.payload as {
          winners: Array<{ userId: string; username: string; amount: number }>;
          pot: number;
        };
        // Play win sound
        globalSoundPlayer.play('chipsWin');
        // Set the hand result to display winner
        setHandResult(resultPayload);
        // Reset phase to waiting so action buttons are hidden until new hand starts
        updateGameState({
          phase: 'waiting',
        });
        // Clear result and cards after delay to allow viewing
        setTimeout(() => {
          setHandResult(null);
          setMyCards([]);
        }, 4000);
        break;
      }

      case 'chat_message': {
        const chatPayload = message.payload as {
          id: string;
          userId: string;
          username: string;
          message: string;
          timestamp: number;
        };
        addChatMessage(chatPayload);
        globalSoundPlayer.play('message');
        break;
      }

      case 'error':
        console.error('WebSocket error:', message.payload);
        break;
    }
  }, [updateGameState, setMyCards, setTimeRemaining, setHandResult, setBustedPlayer, addChatMessage]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('Connecting to WebSocket...');
    wsRef.current = new WebSocket(WS_URL);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnected(true);

      // Authenticate
      if (token) {
        console.log('Sending auth token');
        wsRef.current?.send(JSON.stringify({ type: 'auth', payload: { token } }));
      }
    };

    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setConnected(false);

      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [token, handleMessage, setConnected]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const joinRoom = useCallback((roomId: string) => {
    console.log('Joining room:', roomId, 'WS state:', wsRef.current?.readyState);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'join_room',
          payload: { roomId },
        })
      );
    }
  }, []);

  const leaveRoom = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_room', payload: {} }));
    }
  }, []);

  const sendAction = useCallback((action: PlayerAction, amount?: number) => {
    console.log('Sending action:', action, amount, 'WS state:', wsRef.current?.readyState);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'player_action',
          payload: { action, amount },
        })
      );
    } else {
      console.error('WebSocket not connected!');
    }
  }, []);

  const sendChatMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && message.trim()) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat_message',
          payload: { message: message.trim() },
        })
      );
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, joinRoom, leaveRoom, sendAction, sendChatMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
