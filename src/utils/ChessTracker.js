import { Chess } from "chess.js";

export class ChessTracker {
    constructor(moves = []) {
        this.chess = new Chess();
        this.boardHistory = [this._cloneBoard(this.chess.board())];
        this.moves = [];
        if (moves.length > 0) this.setMoves(moves);
    }

    getState() {
        return JSON.stringify({ moves: this.moves.map(m => m.san) });
    }

    static fromState(serialized) {
        const { moves } = JSON.parse(serialized);
        return new ChessTracker(moves);
    }

    _cloneBoard(board) {
        return board.map(row => row.map(cell => cell ? { ...cell } : null));
    }

    _boardToLetters(board) {
        return board.map(row =>
            row.map(cell => {
                if (!cell) return null;
                return cell.color === "w" ? cell.type.toUpperCase() : cell.type.toLowerCase();
            })
        );
    }

    _applyMove(moveStr) {
        const move = this.chess.move(moveStr, { sloppy: true });
        if (!move) {
            console.warn("Invalid move skipped:", moveStr);
            return false;
        }
        this.boardHistory.push(this._cloneBoard(this.chess.board()));
        this.moves.push(move);
        return true;
    }

    setMoves(moveStrings) {
        this.chess.reset();
        this.boardHistory = [this._cloneBoard(this.chess.board())];
        this.moves = [];
        for (let moveStr of moveStrings) {
            this._applyMove(moveStr);
        }
    }

    // Make a move from current position
    makeMove(from, to, promotion = null) {
        const moveObj = { from, to };
        if (promotion) moveObj.promotion = promotion;

        const move = this.chess.move(moveObj);
        if (!move) return null;

        this.boardHistory.push(this._cloneBoard(this.chess.board()));
        this.moves.push(move);
        return move;
    }

  
    makeMoveFromSan(san) {
        const move = this.chess.move(san);
        if (!move) return null;

        this.boardHistory.push(this._cloneBoard(this.chess.board()));
        this.moves.push(move);
        return move;
    }

    getStateAtMove(moveNumber) {
        if (moveNumber < 0) moveNumber = 0;
        if (moveNumber >= this.boardHistory.length) moveNumber = this.boardHistory.length - 1;
        return this._boardToLetters(this.boardHistory[moveNumber]);
    }

    // Get curr board
    getCurrentBoard() {
        return this._boardToLetters(this.boardHistory[this.boardHistory.length - 1]);
    }

    // Reset 
    reset() {
        this.chess.reset();
        this.boardHistory = [this._cloneBoard(this.chess.board())];
        this.moves = [];
    }


    turn() {
        return this.chess.turn(); // 'w' or 'b'
    }

    // Get FEN 
    fen() {
        return this.chess.fen();
    }

    // Get PGN string
    pgn() {
        return this.chess.pgn();
    }

    // Check game status
    isGameOver() {
        return this.chess.isGameOver();
    }

    isCheckmate() {
        return this.chess.isCheckmate();
    }

    isDraw() {
        return this.chess.isDraw();
    }

    isCheck() {
        return this.chess.isCheck();
    }

    get totalMoves() {
        return this.moves.length;
    }

    getDetailedMoves() {
        return this.moves.map((m, index) => ({
            index,
            from: m.from,
            to: m.to,
            san: m.san,
            promotion: m.promotion || null,
            flags: m.flags,
            piece: m.piece,
            captured: m.captured || null,
            color: m.color,
        }));
    }

    // Force a move from SAN even if illegal (for AI hallucinations)
    makeForceMoveFromSan(san) {
      
        const legalMove = this.makeMoveFromSan(san);
        if (legalMove) return { move: legalMove, isIllegal: false };


        const parsed = this._parseSan(san);
        if (!parsed) return null; 

  
        const candidates = this._findCandidates(parsed);
        if (candidates.length === 0) return null;

      
        const bestMove = candidates[0]; 

        // 5. Force !!!!!!
        return this._forceMove(bestMove.from, bestMove.to, parsed.promotion);
    }

    _parseSan(san) {
     
        const cleanSan = san.replace(/[+#?!=]/g, '');

        // Castlaeing
        if (cleanSan === 'O-O' || cleanSan === '0-0') return { type: 'castle', side: 'k' };
        if (cleanSan === 'O-O-O' || cleanSan === '0-0-0') return { type: 'castle', side: 'q' };


        const regex = /^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(=[NBRQ])?$/;
        const match = cleanSan.match(regex);

        if (!match) return null;

        return {
            piece: match[1] || 'P', // Default to pawns
            fromFile: match[2],
            fromRank: match[3],
            to: match[4],
            promotion: match[5] ? match[5][1].toLowerCase() : null 
        };
    }

    _findCandidates(parsed) {
        const turn = this.chess.turn(); 
        const pieceType = parsed.piece.toLowerCase();
        const target = parsed.to;

        // Handle Castling (special case)
        if (parsed.type === 'castle') {
            const rank = turn === 'w' ? '1' : '8';
            return [{
                from: 'e' + rank,
                to: parsed.side === 'k' ? 'g' + rank : 'c' + rank,
                isCastle: true
            }];
        }

        const board = this.chess.board(); // 2D array
        const candidates = [];


        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const cell = board[row][col];
                if (cell && cell.color === turn && cell.type === pieceType) {
                    const file = 'abcdefgh'[col];
                    const rank = (8 - row).toString();
                    const square = file + rank;

   
                    if (parsed.fromFile && parsed.fromFile !== file) continue;
                    if (parsed.fromRank && parsed.fromRank !== rank) continue;

        
                    if (this._isGeometricallyPossible(pieceType, col, row, target)) {
                        candidates.push({ from: square, to: target });
                    }
                }
            }
        }
        return candidates;
    }

    _isGeometricallyPossible(piece, fromCol, fromRow, targetSquare) {
        const files = "abcdefgh";
        const targetCol = files.indexOf(targetSquare[0]);
        const targetRow = 8 - parseInt(targetSquare[1]);

        const dx = Math.abs(targetCol - fromCol);
        const dy = Math.abs(targetRow - fromRow);

        switch (piece) {
            case 'n': // Knight: L-shape 2+1
                return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
            case 'b': // Bishop: Diagonal
                return dx === dy;
            case 'r': // Rook: Straight line
                return dx === 0 || dy === 0;
            case 'q': // Queen: Both
                return dx === dy || dx === 0 || dy === 0;
            case 'k': // King: Adjacent (or 2 for castle, but handled separately)
                return dx <= 1 && dy <= 1;
            case 'p': 
                return dx <= 1 && dy <= 2 && dy > 0;
            default:
                return false;
        }
    }

    _forceMove(from, to, promotion) {
        // This is the "God Mode" move.


        const piece = this.chess.get(from);
        if (!piece) return null; 

        
        const captured = this.chess.get(to);

        // Execute move in memory ! 
        this.chess.remove(from);
        if (captured) this.chess.remove(to);

        let newPiece = { type: piece.type, color: piece.color };
        if (promotion) newPiece.type = promotion;

        this.chess.put(newPiece, to);

        if (piece.type === 'k' && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2) {
            const rank = from[1];
            if (to[0] === 'g') { // Short castle
                this.chess.remove('h' + rank);
                this.chess.put({ type: 'r', color: piece.color }, 'f' + rank);
            } else if (to[0] === 'c') { // Long castle
                this.chess.remove('a' + rank);
                this.chess.put({ type: 'r', color: piece.color }, 'd' + rank);
            }
        }

        // FORCE SWITCH TURN
        // chess.js doesn't expose `setTurn`. We must use FEN. Sneaky sneaky sneak
        let fen = this.chess.fen();
        let fenParts = fen.split(' ');

        // Toggle turn
        fenParts[1] = fenParts[1] === 'w' ? 'b' : 'w';

        // Increment fullmove number if black moved
        if (piece.color === 'b') {
            fenParts[5] = (parseInt(fenParts[5]) + 1).toString();
        }


        fenParts[3] = '-';

        const newFen = fenParts.join(' ');
        this.chess.load(newFen);

        // Push to history
        this.boardHistory.push(this._cloneBoard(this.chess.board()));

        const moveObj = {
            color: piece.color,
            from,
            to,
            piece: piece.type,
            captured: captured ? captured.type : undefined,
            promotion: promotion,
            flags: 'f', // custom flag for forced
            san: to.toUpperCase() + "*" // Mark as forced in SAN? Or try to keep clean? 
  
        };

  
        let simpleSan = "";
        if (piece.type !== 'p') simpleSan += piece.type.toUpperCase();
        if (captured) simpleSan += 'x';
        simpleSan += to;
        if (promotion) simpleSan += '=' + promotion.toUpperCase();

        moveObj.san = simpleSan;

        this.moves.push(moveObj);

        return { move: moveObj, isIllegal: true };
    }


    getLegalMoves() {
        return this.chess.moves({ verbose: true });
    }

    isLegalMove(from, to) {
        const moves = this.chess.moves({ verbose: true });
        return moves.some(m => m.from === from && m.to === to);
    }
}
