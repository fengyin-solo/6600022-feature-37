export interface ApiError {
  type: 'network' | 'server' | 'business' | 'unknown';
  message: string;
  status?: number;
}

export interface GameStateDto {
  id: string;
  board: number[][];
  currentPlayer: number;
  moves: MoveDto[];
  winner: number | null;
  createdAt: string;
}

export interface MoveDto {
  row: number;
  col: number;
  player: number;
  timestamp: number;
}

function createError(response: Response): Promise<ApiError> {
  return response.text().then(text => {
    let message = text;
    try {
      const data = JSON.parse(text);
      if (typeof data === 'string') {
        message = data;
      } else if (data.message) {
        message = data.message;
      }
    } catch {
    }
    return {
      type: response.status >= 500 ? 'server' : 'business',
      message,
      status: response.status,
    };
  });
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await createError(response);
      throw error;
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T;
    }

    return await response.json();
  } catch (err) {
    if ((err as ApiError).type) {
      throw err;
    }
    const error: ApiError = {
      type: 'network',
      message: '网络连接失败，请检查网络后重试',
    };
    throw error;
  }
}

export const gameApi = {
  newGame(): Promise<GameStateDto> {
    return request<GameStateDto>('/api/game/new', { method: 'POST' });
  },

  getGame(id: string): Promise<GameStateDto> {
    return request<GameStateDto>(`/api/game/${id}`);
  },

  makeMove(id: string, row: number, col: number): Promise<GameStateDto> {
    return request<GameStateDto>(`/api/game/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ row, col }),
    });
  },

  aiMove(id: string, player: number, depth: number): Promise<GameStateDto> {
    return request<GameStateDto>(`/api/game/${id}/ai-move`, {
      method: 'POST',
      body: JSON.stringify({ player, depth }),
    });
  },

  getRecords(): Promise<GameStateDto[]> {
    return request<GameStateDto[]>('/api/game/records');
  },

  deleteGame(id: string): Promise<void> {
    return request<void>(`/api/game/${id}`, { method: 'DELETE' });
  },
};

export function getErrorMessage(error: ApiError, context: string): string {
  if (error.type === 'network') {
    return `${context}失败：网络连接失败，请检查网络后重试`;
  }
  if (error.type === 'server') {
    return `${context}失败：服务器出错，请稍后重试`;
  }
  if (error.type === 'business') {
    return `${context}失败：${error.message}`;
  }
  return `${context}失败：未知错误`;
}
