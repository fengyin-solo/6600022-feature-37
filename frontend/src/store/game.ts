import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { BoardState, Move, GameRecord, AIConfig, GameStatus } from '../types';
import { gameApi, type ApiError, type GameStateDto, type MoveDto } from '../api/game';

const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

function createEmptyBoard(): BoardState {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

function dtoToMove(dto: MoveDto): Move {
  return {
    row: dto.row,
    col: dto.col,
    player: dto.player,
    timestamp: dto.timestamp,
  };
}

function dtoToRecord(dto: GameStateDto): GameRecord {
  return {
    id: dto.id,
    moves: dto.moves.map(dtoToMove),
    winner: dto.winner,
    createdAt: dto.createdAt,
    duration: dto.moves.length > 0 ? dto.moves[dto.moves.length - 1].timestamp - dto.moves[0].timestamp : 0,
  };
}

export interface OperationError {
  message: string;
  retry?: () => void;
}

export const useGameStore = defineStore('game', () => {
  const board = ref<BoardState>(createEmptyBoard());
  const currentPlayer = ref<number>(BLACK);
  const moves = ref<Move[]>([]);
  const status = ref<GameStatus>('idle');
  const winner = ref<number | null>(null);
  const gameRecords = ref<GameRecord[]>([]);
  const aiConfig = ref<AIConfig>({ depth: 3, enabled: true, playerColor: WHITE });
  const isAiThinking = ref(false);
  const gameId = ref<string | null>(null);

  const createGameError = ref<OperationError | null>(null);
  const aiMoveError = ref<OperationError | null>(null);
  const loadRecordsError = ref<OperationError | null>(null);

  const isCreatingGame = ref(false);
  const isLoadingRecords = ref(false);

  const replayMoves = ref<Move[]>([]);
  const replayIndex = ref(0);
  const replayBoard = ref<BoardState>(createEmptyBoard());
  const isReplayPlaying = ref(false);
  const replaySpeed = ref(1000);

  const currentMoveCount = computed(() => moves.value.length);
  const isGameOver = computed(() => status.value === 'finished');

  function applyGameState(dto: GameStateDto) {
    gameId.value = dto.id;
    board.value = dto.board.map(row => [...row]);
    currentPlayer.value = dto.currentPlayer;
    moves.value = dto.moves.map(dtoToMove);
    winner.value = dto.winner;
    if (dto.winner !== null) {
      status.value = 'finished';
    } else {
      status.value = 'playing';
    }
  }

  async function startGame() {
    createGameError.value = null;
    isCreatingGame.value = true;

    try {
      const dto = await gameApi.newGame();
      applyGameState(dto);
      isAiThinking.value = false;
    } catch (err) {
      const apiError = err as ApiError;
      createGameError.value = {
        message: getCreateGameErrorMessage(apiError),
        retry: () => startGame(),
      };
      status.value = 'idle';
    } finally {
      isCreatingGame.value = false;
    }
  }

  function getCreateGameErrorMessage(error: ApiError): string {
    if (error.type === 'network') {
      return '无法连接到服务器，请检查网络连接后重试';
    }
    if (error.type === 'server') {
      return '服务器繁忙，无法创建对局，请稍后重试';
    }
    if (error.type === 'business') {
      return `创建对局失败：${error.message}`;
    }
    return '创建对局失败，请重试';
  }

  function placeStone(row: number, col: number): boolean {
    if (status.value !== 'playing') return false;
    if (board.value[row][col] !== EMPTY) return false;
    if (isAiThinking.value) return false;

    board.value[row][col] = currentPlayer.value;
    const move: Move = { row, col, player: currentPlayer.value, timestamp: Date.now() };
    moves.value.push(move);

    if (checkWinAt(board.value, row, col, currentPlayer.value)) {
      winner.value = currentPlayer.value;
      status.value = 'finished';
      saveRecord();
      return true;
    }

    if (moves.value.length === BOARD_SIZE * BOARD_SIZE) {
      winner.value = 0;
      status.value = 'finished';
      saveRecord();
      return true;
    }

    currentPlayer.value = currentPlayer.value === BLACK ? WHITE : BLACK;
    return true;
  }

  async function makeMove(row: number, col: number): Promise<boolean> {
    if (!gameId.value) return false;
    if (status.value !== 'playing') return false;
    if (board.value[row][col] !== EMPTY) return false;
    if (isAiThinking.value) return false;

    try {
      const dto = await gameApi.makeMove(gameId.value, row, col);
      applyGameState(dto);
      if (status.value === 'finished') {
        saveRecord();
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  async function aiMove() {
    if (!aiConfig.value.enabled || status.value !== 'playing') return;
    if (currentPlayer.value !== aiConfig.value.playerColor) return;
    if (!gameId.value) return;

    aiMoveError.value = null;
    isAiThinking.value = true;

    try {
      const dto = await gameApi.aiMove(gameId.value, aiConfig.value.playerColor, aiConfig.value.depth);
      applyGameState(dto);
      if (status.value === 'finished') {
        saveRecord();
      }
    } catch (err) {
      const apiError = err as ApiError;
      aiMoveError.value = {
        message: getAiMoveErrorMessage(apiError),
        retry: () => aiMove(),
      };
    } finally {
      isAiThinking.value = false;
    }
  }

  function getAiMoveErrorMessage(error: ApiError): string {
    if (error.type === 'network') {
      return 'AI 落子失败：网络连接中断，请检查网络后重试';
    }
    if (error.type === 'server') {
      return 'AI 思考超时，请稍后重试';
    }
    if (error.type === 'business') {
      if (error.message === 'Game is over') {
        return '对局已结束，无法继续落子';
      }
      if (error.message === 'No valid move') {
        return '棋盘已满，没有可落子的位置';
      }
      return `AI 落子失败：${error.message}`;
    }
    return 'AI 落子失败，请重试';
  }

  function saveRecord() {
    const record: GameRecord = {
      id: gameId.value || Date.now().toString(),
      moves: [...moves.value],
      winner: winner.value,
      createdAt: new Date().toLocaleString('zh-CN'),
      duration: moves.value.length > 0 ? moves.value[moves.value.length - 1].timestamp - moves.value[0].timestamp : 0,
    };
    const existingIndex = gameRecords.value.findIndex(r => r.id === record.id);
    if (existingIndex >= 0) {
      gameRecords.value[existingIndex] = record;
    } else {
      gameRecords.value.unshift(record);
    }
  }

  async function loadRecords() {
    loadRecordsError.value = null;
    isLoadingRecords.value = true;

    try {
      const dtos = await gameApi.getRecords();
      gameRecords.value = dtos.map(dtoToRecord);
    } catch (err) {
      const apiError = err as ApiError;
      loadRecordsError.value = {
        message: getLoadRecordsErrorMessage(apiError),
        retry: () => loadRecords(),
      };
    } finally {
      isLoadingRecords.value = false;
    }
  }

  function getLoadRecordsErrorMessage(error: ApiError): string {
    if (error.type === 'network') {
      return '加载棋谱失败：网络连接中断，请检查网络后重试';
    }
    if (error.type === 'server') {
      return '加载棋谱失败：服务器繁忙，请稍后重试';
    }
    if (error.type === 'business') {
      return `加载棋谱失败：${error.message}`;
    }
    return '加载棋谱失败，请重试';
  }

  function startReplay(record: GameRecord) {
    replayMoves.value = [...record.moves];
    replayIndex.value = 0;
    replayBoard.value = createEmptyBoard();
    status.value = 'replaying';
    isReplayPlaying.value = false;
  }

  function replayStepForward() {
    if (replayIndex.value >= replayMoves.value.length) return;
    const move = replayMoves.value[replayIndex.value];
    replayBoard.value[move.row][move.col] = move.player;
    replayIndex.value++;
  }

  function replayStepBack() {
    if (replayIndex.value <= 0) return;
    replayIndex.value--;
    const move = replayMoves.value[replayIndex.value];
    replayBoard.value[move.row][move.col] = EMPTY;
  }

  function replayGoToStart() {
    replayBoard.value = createEmptyBoard();
    replayIndex.value = 0;
  }

  function replayGoToEnd() {
    replayBoard.value = createEmptyBoard();
    for (let i = 0; i < replayMoves.value.length; i++) {
      const m = replayMoves.value[i];
      replayBoard.value[m.row][m.col] = m.player;
    }
    replayIndex.value = replayMoves.value.length;
  }

  let replayTimer: ReturnType<typeof setInterval> | null = null;

  function toggleReplayPlay() {
    isReplayPlaying.value = !isReplayPlaying.value;
    if (isReplayPlaying.value) {
      replayTimer = setInterval(() => {
        if (replayIndex.value >= replayMoves.value.length) {
          isReplayPlaying.value = false;
          if (replayTimer) clearInterval(replayTimer);
          replayTimer = null;
          return;
        }
        replayStepForward();
      }, replaySpeed.value);
    } else {
      if (replayTimer) clearInterval(replayTimer);
      replayTimer = null;
    }
  }

  function setReplaySpeed(ms: number) {
    replaySpeed.value = ms;
    if (isReplayPlaying.value) {
      if (replayTimer) clearInterval(replayTimer);
      replayTimer = setInterval(() => {
        if (replayIndex.value >= replayMoves.value.length) {
          isReplayPlaying.value = false;
          if (replayTimer) clearInterval(replayTimer);
          replayTimer = null;
          return;
        }
        replayStepForward();
      }, replaySpeed.value);
    }
  }

  function stopReplay() {
    isReplayPlaying.value = false;
    if (replayTimer) clearInterval(replayTimer);
    replayTimer = null;
    status.value = 'idle';
  }

  function checkWin(row: number, col: number): boolean {
    return checkWinAt(board.value, row, col, board.value[row][col]);
  }

  const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  function countDirection(board: BoardState, row: number, col: number, dr: number, dc: number, player: number): number {
    let count = 0;
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
      count++;
      r += dr;
      c += dc;
    }
    return count;
  }

  function checkWinAt(board: BoardState, row: number, col: number, player: number): boolean {
    for (const [dr, dc] of DIRECTIONS) {
      const count = 1 + countDirection(board, row, col, dr, dc, player) + countDirection(board, row, col, -dr, -dc, player);
      if (count >= 5) return true;
    }
    return false;
  }

  function clearCreateGameError() {
    createGameError.value = null;
  }

  function clearAiMoveError() {
    aiMoveError.value = null;
  }

  function clearLoadRecordsError() {
    loadRecordsError.value = null;
  }

  return {
    board, currentPlayer, moves, status, winner, gameRecords, aiConfig, isAiThinking, gameId,
    createGameError, aiMoveError, loadRecordsError,
    isCreatingGame, isLoadingRecords,
    replayMoves, replayIndex, replayBoard, isReplayPlaying, replaySpeed,
    currentMoveCount, isGameOver,
    startGame, placeStone, makeMove, aiMove, saveRecord, loadRecords,
    startReplay, replayStepForward, replayStepBack, replayGoToStart, replayGoToEnd,
    toggleReplayPlay, setReplaySpeed, stopReplay, checkWin,
    clearCreateGameError, clearAiMoveError, clearLoadRecordsError,
  };
});
