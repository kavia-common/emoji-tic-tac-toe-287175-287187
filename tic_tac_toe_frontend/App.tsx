import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/**
 * App.tsx - Emoji Tic Tac Toe
 *
 * Implements:
 * - Centered single-page layout
 * - Status text
 * - 3x3 emoji grid using ⬜️ (empty), ❌ (X), ⭕️ (O)
 * - Reset button
 * - State: gameId, board[9], nextPlayer, winner, isDraw, isLoading, statusMessage
 * - API integration:
 *    GET  /api/health
 *    POST /api/games/
 *    POST /api/games/{id}/move/  { index }
 *    POST /api/games/{id}/reset/
 * - Base URL from env EXPO_PUBLIC_BACKEND_URL with fallback to http://localhost:3001/api
 * - Disables moves when winner/draw or cell occupied
 * - Light error handling via inline status
 */

// PUBLIC_INTERFACE
export default function App() {
  // Theme (from provided style guide)
  const theme = {
    primary: '#374149',
    secondary: '#d7ad2d',
    success: '#d7ad2d',
    error: '#F44336',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#212121',
  };

  // Derive API base
  const API_BASE = useMemo(() => {
    const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
    const base = (fromEnv && fromEnv.trim().length > 0 ? fromEnv : 'http://localhost:3001') as string;
    // Ensure trailing /api path
    return base.endsWith('/api') ? base : `${base.replace(/\/+$/, '')}/api`;
  }, []);

  // App state
  const [gameId, setGameId] = useState<string | null>(null);
  const [board, setBoard] = useState<Array<'X' | 'O' | null>>(Array(9).fill(null));
  const [nextPlayer, setNextPlayer] = useState<'X' | 'O'>('X');
  const [winner, setWinner] = useState<'X' | 'O' | null>(null);
  const [isDraw, setIsDraw] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing...');

  // Helpers to map symbol to emoji
  const toEmoji = (v: 'X' | 'O' | null) => {
    if (v === 'X') return '❌';
    if (v === 'O') return '⭕️';
    return '⬜️';
  };

  // Compute user-friendly status
  const computedStatus = useMemo(() => {
    if (isLoading) return 'Loading...';
    if (winner) return `Winner: ${winner === 'X' ? '❌' : '⭕️'}`;
    if (isDraw) return 'Draw!';
    return `Turn: ${nextPlayer === 'X' ? '❌' : '⭕️'}`;
  }, [isLoading, winner, isDraw, nextPlayer]);

  type GameStatePayload = {
    id: string;
    board: Array<'X' | 'O' | null>;
    nextPlayer: 'X' | 'O';
    winner: 'X' | 'O' | null;
    isDraw: boolean;
  };

  const updateFromPayload = (payload: Partial<GameStatePayload>) => {
    // Expecting a payload like:
    // {
    //   id: string,
    //   board: Array<'X'|'O'|null> length 9,
    //   nextPlayer: 'X'|'O',
    //   winner: 'X'|'O'|null,
    //   isDraw: boolean
    // }
    try {
      if (payload?.id) setGameId(String(payload.id));
      if (Array.isArray(payload?.board) && payload.board.length === 9) {
        setBoard(payload.board);
      }
      if (payload?.nextPlayer === 'X' || payload?.nextPlayer === 'O') setNextPlayer(payload.nextPlayer);
      setWinner(payload?.winner ?? null);
      setIsDraw(Boolean(payload?.isDraw));
    } catch {
      // Swallow to avoid crashing on unexpected payloads
    }
  };

  // Initialize: health check and create game
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setIsLoading(true);
      setStatusMessage('Pinging server...');
      try {
        const healthResp = await fetch(`${API_BASE}/health`, { method: 'GET' });
        if (!healthResp.ok) {
          throw new Error(`Health check failed: ${healthResp.status}`);
        }
        // Create new game
        setStatusMessage('Creating game...');
        const createResp = await fetch(`${API_BASE}/games/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!createResp.ok) {
          throw new Error(`Failed to create game: ${createResp.status}`);
        }
        const data = await createResp.json();
        if (!isMounted) return;
        updateFromPayload(data);
        setStatusMessage('Game ready!');
      } catch (e: unknown) {
        if (!isMounted) return;
        const msg = (typeof e === 'object' && e && 'message' in e) ? String((e as { message?: string }).message) : 'Unable to connect to backend';
        setStatusMessage(`Error: ${msg}`);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [API_BASE]);

  const canPlay = useMemo(() => !isLoading && !winner && !isDraw, [isLoading, winner, isDraw]);

  const onCellPress = useCallback(
    async (index: number) => {
      if (!canPlay) return;
      if (!gameId) return;
      if (board[index] !== null) return;

      try {
        setIsLoading(true);
        setStatusMessage('Submitting move...');
        const resp = await fetch(`${API_BASE}/games/${gameId}/move/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index }),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`Move failed: ${resp.status} ${text}`.trim());
        }
        const data = await resp.json();
        updateFromPayload(data);
        setStatusMessage('Move accepted.');
      } catch (e: unknown) {
        const msg = (typeof e === 'object' && e && 'message' in e) ? String((e as { message?: string }).message) : 'Move failed';
        setStatusMessage(`Error: ${msg}`);
      } finally {
        setIsLoading(false);
      }
    },
    [API_BASE, gameId, board, canPlay]
  );

  const onReset = useCallback(async () => {
    if (!gameId) return;
    try {
      setIsLoading(true);
      setStatusMessage('Resetting game...');
      const resp = await fetch(`${API_BASE}/games/${gameId}/reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Reset failed: ${resp.status} ${text}`.trim());
      }
      const data = await resp.json();
      updateFromPayload(data);
      setStatusMessage('Game reset.');
    } catch (e: unknown) {
      const msg = (typeof e === 'object' && e && 'message' in e) ? String((e as { message?: string }).message) : 'Reset failed';
      setStatusMessage(`Error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE, gameId]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.primary }]}>Emoji Tic Tac Toe</Text>

        <View style={[styles.statusWrapper, { backgroundColor: theme.surface, borderColor: '#E0E0E0' }]}>
          <Text style={[styles.statusText, { color: winner ? theme.success : theme.text }]}>
            {computedStatus}
          </Text>
          {!!statusMessage && !isLoading && (
            <Text style={[styles.subStatusText, { color: statusMessage.startsWith('Error') ? theme.error : theme.text }]}>
              {statusMessage}
            </Text>
          )}
          {isLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.secondary} />
              <Text style={[styles.loadingText, { color: theme.text }]}>Please wait...</Text>
            </View>
          )}
        </View>

        <View style={styles.grid}>
          {board.map((cell, idx) => {
            const disabled = isLoading || !canPlay || cell !== null;
            return (
              <Pressable
                key={idx}
                onPress={() => onCellPress(idx)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    backgroundColor: theme.surface,
                    borderColor: '#E0E0E0',
                    opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={styles.cellEmoji}>{toEmoji(cell)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={onReset}
          disabled={isLoading || !gameId}
          style={({ pressed }) => [
            styles.resetButton,
            {
              backgroundColor: theme.secondary,
              opacity: isLoading || !gameId ? 0.6 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.resetButtonText}>Reset</Text>
        </Pressable>

        <Text style={[styles.footer, { color: '#9E9E9E' }]}>
          Backend: {API_BASE}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusWrapper: {
    width: '100%',
    maxWidth: 360,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  subStatusText: {
    fontSize: 12,
    textAlign: 'center',
  },
  loadingRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 12,
  },
  grid: {
    width: 312,
    height: 312,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  cell: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmoji: {
    fontSize: 40,
  },
  resetButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  resetButtonText: {
    color: '#212121',
    fontWeight: '700',
    letterSpacing: 0.5,
    fontSize: 16,
  },
  footer: {
    marginTop: 12,
    fontSize: 12,
  },
});
