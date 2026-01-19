import React, { useState, useCallback, useEffect } from "react";
import Square from "./Square";
import styles from "./styles/Chessboard.module.scss";
import { useGame } from "../context/GameContext";

const Chessboard = () => {
  const {
    // State
    board,
    playerColor,
    isThinking,
    viewingMoveIndex,
    lastMove,

    // Actions
    makePlayerMove,
    trackerRef,
    returnToLive
  } = useGame();

  const [selected, setSelected] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);

  const getLegalMovesForSquare = useCallback((row, col) => {
    const tracker = trackerRef.current;
    const files = "abcdefgh";
    const from = files[col] + (8 - row);

    const legalMoves = tracker.getLegalMoves();
    return legalMoves
      .filter(m => m.from === from)
      .map(m => ({
        row: 8 - parseInt(m.to[1]),
        col: files.indexOf(m.to[0]),
        isCapture: m.captured !== undefined,
        promotion: m.promotion,
      }));
  }, [trackerRef]);

  const handleSquareClick = useCallback((row, col) => {
    if (viewingMoveIndex !== null || isThinking) return;

    const clickedPiece = board[row][col];
    const files = "abcdefgh";
    // const toSquare = files[col] + (8 - row); // Unused until move

    // If clicking on a possible move, make the move
    if (selected && possibleMoves.some((m) => m.row === row && m.col === col)) {
      const fromSquare = files[selected.col] + (8 - selected.row);
      const toSquare = files[col] + (8 - row);
      const piece = board[selected.row][selected.col];
      const isPawnPromotion = piece?.toLowerCase() === 'p' && (row === 0 || row === 7);

      const success = makePlayerMove(fromSquare, toSquare, isPawnPromotion ? 'q' : null);

      if (success) {
        setSelected(null);
        setPossibleMoves([]);
      }
      return;
    }

    // If clicking on own piece, select it and show moves
    if (clickedPiece) {
      const isWhitePiece = clickedPiece === clickedPiece.toUpperCase();
      const isPlayerPiece = (playerColor === 'w' && isWhitePiece) ||
        (playerColor === 'b' && !isWhitePiece);
      const isPlayerTurn = trackerRef.current.turn() === playerColor;

      if (isPlayerPiece && isPlayerTurn) {
        setSelected({ row, col });
        setPossibleMoves(getLegalMovesForSquare(row, col));
        return;
      }
    }

    // Deselect if clicking elsewhere
    setSelected(null);
    setPossibleMoves([]);
  }, [board, selected, possibleMoves, viewingMoveIndex, isThinking, playerColor, getLegalMovesForSquare, makePlayerMove, trackerRef]);

  // Clear selection if board changes (e.g. AI moved)
  useEffect(() => {
    // Optional: could clear selection here just in case.
    // setSelected(null);
    // setPossibleMoves([]);
  }, [board]);

  return (
    <div className={styles.gameLayout}>
      <div className={styles.boardWrapper}>
        {viewingMoveIndex !== null && (
          <div className={styles.historyBanner}>
            <span>Viewing move {viewingMoveIndex + 1}</span>
            <button onClick={returnToLive}>Return to game</button>
          </div>
        )}
        <div className={styles.boardInner}>
          <div className={styles.chessboard}>
            {board.flatMap((rowData, row) =>
              rowData.map((piece, col) => {
                const isDark = (row + col) % 2 === 1;
                const isSelected = selected && selected.row === row && selected.col === col;
                const isPossibleMove = possibleMoves.some((m) => m.row === row && m.col === col);
                const isCaptureMove = possibleMoves.some(
                  (m) => m.row === row && m.col === col && m.isCapture
                );
                const isLastMoveFrom = lastMove && lastMove.from.row === row && lastMove.from.col === col;
                const isLastMoveTo = lastMove && lastMove.to.row === row && lastMove.to.col === col;

                return (
                  <Square
                    key={`${row}-${col}`}
                    isDark={isDark}
                    piece={piece}
                    isSelected={isSelected}
                    isPossibleMove={isPossibleMove}
                    isCaptureMove={isCaptureMove}
                    isLastMoveFrom={isLastMoveFrom}
                    isLastMoveTo={isLastMoveTo}
                    onClick={() => handleSquareClick(row, col)}
                  />
                );
              })
            )}
          </div>
        </div>
        {isThinking && (
          <div className={styles.thinkingOverlay}>
            <div className={styles.thinkingSpinner} />
            <span>AI is thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chessboard;