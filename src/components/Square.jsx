import React from "react";
import Piece from "./Piece";
import styles from "./styles/Square.module.scss";

const Square = ({
  isDark,
  piece,
  isSelected,
  isPossibleMove,
  isCaptureMove,
  isLastMoveFrom,
  isLastMoveTo,
  onClick,
}) => {
  const classNames = [
    styles.square,
    isDark ? styles.dark : styles.light,
    isSelected && styles.selected,
    isLastMoveFrom && styles.lastMoveFrom,
    isLastMoveTo && styles.lastMoveTo,
  ].filter(Boolean).join(' ');

  return (
    <div onClick={onClick} className={classNames}>
      {isPossibleMove && !isCaptureMove && <div className={styles.possibleMoveIndicator} />}
      {isCaptureMove && <div className={styles.captureMoveIndicator} />}
      {piece && <Piece type={piece} />}
    </div>
  );
};

export default Square;