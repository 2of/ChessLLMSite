import React, { useRef, useEffect } from "react";
import styles from "./styles/ticker.module.scss";
import { useGame } from "../context/GameContext";

export const Ticker = () => {
  const {
    moveHistory,
    viewingMoveIndex,
    viewMove,
    returnToLive
  } = useGame();

  const scrollRef = useRef(null);

  if (!Array.isArray(moveHistory)) return null;

  const isViewingHistory = viewingMoveIndex !== null;

  // Auto-scroll to latest move
  useEffect(() => {
    if (scrollRef.current && !isViewingHistory) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [moveHistory.length, isViewingHistory]);

  return (
    <div className={styles.moveHistory}>
      <div className={styles.header}>
        <span className={styles.title}>Moves</span>
        {moveHistory.length > 0 && (
          <span className={styles.moveCount}>{moveHistory.length}</span>
        )}
        {isViewingHistory && (
          <button className={styles.returnButton} onClick={returnToLive}>
            ← Live
          </button>
        )}
      </div>

      <div className={styles.moveListWrapper} ref={scrollRef}>
        {moveHistory.length === 0 ? (
          <p className={styles.emptyState}>Make your first move...</p>
        ) : (
          <ul className={styles.moveList}>
            {moveHistory.map((move, i) => {
              const isWhite = move.color === "w";
              const isViewing = viewingMoveIndex === i;
              const isPast = isViewingHistory && i > viewingMoveIndex;

              return (
                <li
                  key={i}
                  className={`
                    ${styles.moveItem} 
                    ${isWhite ? styles.whiteMove : styles.blackMove}
                    ${isViewing ? styles.viewingMove : ''}
                    ${isPast ? styles.futureMove : ''}
                  `}
                  onClick={() => viewMove(i)}
                >
                  <span className={styles.moveNumber}>{Math.floor(i / 2) + 1}{isWhite ? '.' : '...'}</span>
                  <span className={styles.moveText}>{move.san}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};