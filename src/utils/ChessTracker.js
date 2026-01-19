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

    // Deep clone the chess.js board representation
    _cloneBoard(board) {
        return board.map(row => row.map(cell => cell ? { ...cell } : null));
    }

    // Convert a board to simple letter format (uppercase=white, lowercase=black)
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

    // Make move using algebraic notation (e.g., "e4", "Nf3")
    makeMoveFromSan(san) {
        const move = this.chess.move(san);
        if (!move) return null;

        this.boardHistory.push(this._cloneBoard(this.chess.board()));
        this.moves.push(move);
        return move;
    }

    // Get board at specific move number (0 = starting position)
    getStateAtMove(moveNumber) {
        if (moveNumber < 0) moveNumber = 0;
        if (moveNumber >= this.boardHistory.length) moveNumber = this.boardHistory.length - 1;
        return this._boardToLetters(this.boardHistory[moveNumber]);
    }

    // Get current board
    getCurrentBoard() {
        return this._boardToLetters(this.boardHistory[this.boardHistory.length - 1]);
    }

    // Reset to starting position
    reset() {
        this.chess.reset();
        this.boardHistory = [this._cloneBoard(this.chess.board())];
        this.moves = [];
    }

    // Get whose turn it is
    turn() {
        return this.chess.turn(); // 'w' or 'b'
    }

    // Get FEN string for current position
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
        // 1. Try legal move first
        const legalMove = this.makeMoveFromSan(san);
        if (legalMove) return { move: legalMove, isIllegal: false };

        // 2. Parse SAN manually
        const parsed = this._parseSan(san);
        if (!parsed) return null; // Can't even parse it

        // 3. Find candidate pieces
        const candidates = this._findCandidates(parsed);
        if (candidates.length === 0) return null;

        // 4. Pick best candidate (first one for now, or use disambiguation)
        const bestMove = candidates[0]; // { from: 'e2', to: 'e4', piece: 'p' }

        // 5. Force the move on the board
        return this._forceMove(bestMove.from, bestMove.to, parsed.promotion);
    }

    _parseSan(san) {
        // Clean SAN
        const cleanSan = san.replace(/[+#?!=]/g, '');

        // Castling
        if (cleanSan === 'O-O' || cleanSan === '0-0') return { type: 'castle', side: 'k' };
        if (cleanSan === 'O-O-O' || cleanSan === '0-0-0') return { type: 'castle', side: 'q' };

        // Regex for standard moves: [Piece][Disambig][x][Target][Promotion]
        // Matches: Nf3, Nbd7, R1e2, exd5, e4, Qh4e1
        // Note: Pawn moves usually don't have Piece letter (unless explicitly P, which is rare in SAN but possible)
        const regex = /^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(=[NBRQ])?$/;
        const match = cleanSan.match(regex);

        if (!match) return null;

        return {
            piece: match[1] || 'P', // Default to Pawn
            fromFile: match[2],
            fromRank: match[3],
            to: match[4],
            promotion: match[5] ? match[5][1].toLowerCase() : null // =Q -> q
        };
    }

    _findCandidates(parsed) {
        const turn = this.chess.turn(); // 'w' or 'b'
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

        // Scan board for matching pieces of correct color
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const cell = board[row][col];
                if (cell && cell.color === turn && cell.type === pieceType) {
                    const file = 'abcdefgh'[col];
                    const rank = (8 - row).toString();
                    const square = file + rank;

                    // Filter by disambiguation if provided
                    if (parsed.fromFile && parsed.fromFile !== file) continue;
                    if (parsed.fromRank && parsed.fromRank !== rank) continue;

                    // Check geometric plausibility
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
            case 'p': // Pawn: Forward 1 or 2, or Diagonal capture
                // Basic direction check
                // This is loose, allows "illegal" backward pawn moves if AI hallucinates them? 
                // Let's enforce direction at least.
                // Assuming white moves up (row index decreases), black moves down.
                // But fromRow is 0-7, 0 is rank 8.
                // White pieces are at high rows (6,7), target lower rows.
                // Wait, board[0] is rank 8. board[7] is rank 1.
                // White pawns move from row 6 -> 5 -> 4...
                // Black pawns move from row 1 -> 2 -> 3...
                // Actually, let's just trust the geometric 'nearby' logic or standard moves.
                // Let's just return true for pawns if they are "close enough" to target to be a move.
                // Generally dx <= 1 and dy <= 2.
                return dx <= 1 && dy <= 2 && dy > 0;
            default:
                return false;
        }
    }

    _forceMove(from, to, promotion) {
        // This is the "God Mode" move.
        // We manipulate the board directly.

        // 1. Get current FEN
        // 2. Modify internal state of chess.js via put/remove?

        const piece = this.chess.get(from);
        if (!piece) return null; // Should exist if we found candidate

        // Handle capture
        const captured = this.chess.get(to);

        // Execute move in memory
        this.chess.remove(from);
        if (captured) this.chess.remove(to);

        let newPiece = { type: piece.type, color: piece.color };
        if (promotion) newPiece.type = promotion;

        this.chess.put(newPiece, to);

        // Handle Castling (Simulated)
        // If king moved 2 squares, move the rook too
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
        // chess.js doesn't expose `setTurn`. We must use FEN.
        // FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
        let fen = this.chess.fen();
        let fenParts = fen.split(' ');

        // Toggle turn
        fenParts[1] = fenParts[1] === 'w' ? 'b' : 'w';

        // Increment fullmove number if black moved
        if (piece.color === 'b') {
            fenParts[5] = (parseInt(fenParts[5]) + 1).toString();
        }

        // Clear en passant? (Probably, unless we calc it, but let's clear to be safe from invalid states)
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
            // Let's try to reconstruct basic SAN
        };

        // Simple SAN reconstruction
        // If we want real SAN we have to generate it before moving, but since it's illegal, standard generators fail.
        // We'll use a basic notation: "Nf3*" or just "Nf3"
        // Let's use the input SAN or generate simple one
        let simpleSan = "";
        if (piece.type !== 'p') simpleSan += piece.type.toUpperCase();
        if (captured) simpleSan += 'x';
        simpleSan += to;
        if (promotion) simpleSan += '=' + promotion.toUpperCase();

        moveObj.san = simpleSan;

        this.moves.push(moveObj);

        return { move: moveObj, isIllegal: true };
    }

    // Get legal moves for current position
    getLegalMoves() {
        return this.chess.moves({ verbose: true });
    }

    // Check if a move is legal
    isLegalMove(from, to) {
        const moves = this.chess.moves({ verbose: true });
        return moves.some(m => m.from === from && m.to === to);
    }
}
