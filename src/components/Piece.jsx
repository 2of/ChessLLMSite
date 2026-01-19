import React from "react";
import { PieceSVGs, PIECES } from "../utils/pieces";
import styles from "./styles/Piece.module.scss";

const Piece = ({ type }) => {
  const isWhite = type === type.toUpperCase();

  // Use SVG pieces for better quality
  const SvgPiece = PieceSVGs[type];

  if (SvgPiece) {
    return (
      <div className={`${styles.piece} ${styles.svgPiece} ${isWhite ? styles.white : styles.black}`}>
        {SvgPiece}
      </div>
    );
  }

  // Fallback to unicode
  return (
    <span className={`${styles.piece} ${isWhite ? styles.white : styles.black}`}>
      {PIECES[type]}
    </span>
  );
};

export default Piece;