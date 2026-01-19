// utils/moveLogic.js

export const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

/**
 * Calculate all possible moves for sliding pieces along given directions.
 * @param {number} row 
 * @param {number} col 
 * @param {Array<Array<string|null>>} board 
 * @param {Array<[number,number]>} directions 
 * @returns {Array<{row:number, col:number, isCapture:boolean}>}
 */
function calculateSlidingMoves(row, col, board, directions) {
  const moves = [];
  const piece = board[row][col];
  const isWhite = piece === piece.toUpperCase();

  for (const [dr, dc] of directions) {
    let r = row + dr;
    let c = col + dc;

    while (onBoard(r, c)) {
      const target = board[r][c];

      if (target === null) {
        moves.push({ row: r, col: c, isCapture: false });
      } else {
        const targetIsWhite = target === target.toUpperCase();
        if (targetIsWhite !== isWhite) {
          moves.push({ row: r, col: c, isCapture: true }); // capture opponent
        }
        break; // blocked
      }

      r += dr;
      c += dc;
    }
  }

  return moves;
}

/**
 * Calculate rook moves (vertical + horizontal)
 */
export function calculateRookMoves(row, col, board) {
  const rookDirections = [
    [1, 0],  // down
    [-1, 0], // up
    [0, 1],  // right
    [0, -1], // left
  ];

  return calculateSlidingMoves(row, col, board, rookDirections);
}

/**
 * Calculate bishop moves (diagonal)
 */
export function calculateBishopMoves(row, col, board) {
  const bishopDirections = [
    [1, 1],   // down-right
    [1, -1],  // down-left
    [-1, 1],  // up-right
    [-1, -1], // up-left
  ];

  return calculateSlidingMoves(row, col, board, bishopDirections);
}

/**
 * Calculate queen moves (rook + bishop)
 */
export function calculateQueenMoves(row, col, board) {
  const queenDirections = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  return calculateSlidingMoves(row, col, board, queenDirections);
}

export function calculateKnightMoves(row, col, board) {
  const knightJumps = [
    [-2, -1], [-2, 1],
    [-1, -2], [-1, 2],
    [1, -2],  [1, 2],
    [2, -1],  [2, 1],
  ];

  const moves = [];
  const piece = board[row][col];
  const isWhite = piece === piece.toUpperCase();

  for (const [dr, dc] of knightJumps) {
    const r = row + dr;
    const c = col + dc;
    if (!onBoard(r, c)) continue;

    const target = board[r][c];
    if (target === null) {
      moves.push({ row: r, col: c, isCapture: false });
    } else {
      const targetIsWhite = target === target.toUpperCase();
      if (targetIsWhite !== isWhite) {
        moves.push({ row: r, col: c, isCapture: true });
      }
    }
  }

  return moves;
}


export function calculateKingMoves(row, col, board, { canCastleKingSide, canCastleQueenSide, isWhite }) {
  const kingMoves = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],          [0, 1],
    [1, -1], [1, 0],  [1, 1],
  ];

  const moves = [];
  const piece = board[row][col];

  for (const [dr, dc] of kingMoves) {
    const r = row + dr;
    const c = col + dc;
    if (!onBoard(r, c)) continue;

    const target = board[r][c];
    if (target === null) {
      moves.push({ row: r, col: c, isCapture: false });
    } else {
      const targetIsWhite = target === target.toUpperCase();
      if (targetIsWhite !== isWhite) {
        moves.push({ row: r, col: c, isCapture: true });
      }
    }
  }

  // Castling (very simplified)
  if (isWhite && row === 7 && col === 4) {
    if (canCastleKingSide && board[7][5] === null && board[7][6] === null) {
      moves.push({ row: 7, col: 6, isCastle: true, kingSide: true });
    }
    if (canCastleQueenSide && board[7][1] === null && board[7][2] === null && board[7][3] === null) {
      moves.push({ row: 7, col: 2, isCastle: true, kingSide: false });
    }
  }

  if (!isWhite && row === 0 && col === 4) {
    if (canCastleKingSide && board[0][5] === null && board[0][6] === null) {
      moves.push({ row: 0, col: 6, isCastle: true, kingSide: true });
    }
    if (canCastleQueenSide && board[0][1] === null && board[0][2] === null && board[0][3] === null) {
      moves.push({ row: 0, col: 2, isCastle: true, kingSide: false });
    }
  }

  return moves;
}

/**
 * Calculate pawn moves
 */
export function calculatePawnMoves(row, col, board) {
  const moves = [];
  const piece = board[row][col];
  const direction = piece === "P" ? -1 : 1;
  const startRow = piece === "P" ? 6 : 1;

  const forwardRow = row + direction;

  // Forward move
  if (board[forwardRow]?.[col] == null) {
    moves.push({ row: forwardRow, col, isCapture: false });

    // Double move
    if (row === startRow && board[forwardRow + direction]?.[col] == null) {
      moves.push({ row: forwardRow + direction, col, isCapture: false });
    }
  }

  // Diagonal captures
  for (let dc of [-1, 1]) {
    const target = board[forwardRow]?.[col + dc];
    if (
      target &&
      (piece === "P" ? target.toLowerCase() === target : target.toUpperCase() === target)
    ) {
      moves.push({ row: forwardRow, col: col + dc, isCapture: true });
    }
  }

  return moves;
}


export const getPossibleMoves = (row, col, board, extra = {}) => {
  const piece = board[row][col];
  if (!piece) return [];

  const lower = piece.toLowerCase();
  switch (lower) {
    case "q":
      return calculateQueenMoves(row, col, board);
    case "r":
      return calculateRookMoves(row, col, board);
    case "b":
      return calculateBishopMoves(row, col, board);
    case "n":
      return calculateKnightMoves(row, col, board);
    case "k":
      return calculateKingMoves(row, col, board, {
        canCastleKingSide: extra.canCastleKingSide,
        canCastleQueenSide: extra.canCastleQueenSide,
        isWhite: piece === piece.toUpperCase(),
      });
    case "p":
      return calculatePawnMoves(row, col, board);
    default:
      return [];
  }
};