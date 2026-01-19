import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { ChessTracker } from '../utils/ChessTracker';
import { getMove, buildSmartPrompt } from '../utils/modelhandler';

const GameContext = createContext(null);

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};

export const GameProvider = ({ children }) => {
    /* -------------------------------------------------------------------------- */
    /*                                State Definition                            */
    /* -------------------------------------------------------------------------- */
    const trackerRef = useRef(new ChessTracker());

    // Game Configuration
    const [playerColor, setPlayerColor] = useState("w"); // 'w' or 'b'
    const [selectedModel, setSelectedModel] = useState("random");
    const [modelStatus, setModelStatus] = useState("ready"); // 'initializing', 'ready', 'error'
    const [queryFormat, setQueryFormat] = useState("fen");
    const [promptMode, setPromptMode] = useState("full");

    // Game State
    const [board, setBoard] = useState(trackerRef.current.getCurrentBoard());
    const [moveHistory, setMoveHistory] = useState([]);
    const [gameStatus, setGameStatus] = useState(null); // 'checkmate', 'draw', or null
    const [conversation, setConversation] = useState([]); // [{ role, content, meta }]
    const [currentPrompt, setCurrentPrompt] = useState({ type: "", content: "" }); // Still used for "Preview"
    const [gameKey, setGameKey] = useState(0); // To force re-renders if needed, or identifying streams

    // UI State
    const [isThinking, setIsThinking] = useState(false);
    const [viewingMoveIndex, setViewingMoveIndex] = useState(null);
    const [lastMove, setLastMove] = useState(null);

    const hasTriggeredInitialAI = useRef(false);

    /* -------------------------------------------------------------------------- */
    /*                                  Helpers                                   */
    /* -------------------------------------------------------------------------- */

    const updateDisplay = useCallback(() => {
        const tracker = trackerRef.current;
        if (viewingMoveIndex !== null) {
            // If we are viewing history, don't update board from 'current' state,
            // but we might want to update history list.
            // Actually, usually we only update display after a move, which implies we are at live.
            // If we are viewing history, we shouldn't be making moves generally.
        } else {
            setBoard(tracker.getCurrentBoard());
        }
        setMoveHistory(tracker.getDetailedMoves());
    }, [viewingMoveIndex]);

    const aiColor = playerColor === "w" ? "b" : "w";

    /* -------------------------------------------------------------------------- */
    /*                                  Effects                                   */
    /* -------------------------------------------------------------------------- */

    // Initialize Model when Changed
    useEffect(() => {
        // Skip optional initialization for 'random' if we want, but sticking to consistency
        const initialize = async () => {
            if (selectedModel === 'random') {
                setModelStatus('ready');
                return;
            }

            setModelStatus('initializing');
            try {
                // In future: pass API keys from env or user settings
                const success = await import('../utils/modelhandler').then(m => m.initModel(selectedModel));
                if (success) {
                    setModelStatus('ready');
                } else {
                    setModelStatus('error');
                }
            } catch (e) {
                console.error("Model init error:", e);
                setModelStatus('error');
            }
        };

        initialize();
    }, [selectedModel]);

    /* -------------------------------------------------------------------------- */
    /*                                  Actions                                   */
    /* -------------------------------------------------------------------------- */

    const makeAIMove = useCallback(async () => {
        const tracker = trackerRef.current;

        // Safety checks
        if (tracker.isGameOver()) return;
        if (tracker.turn() !== aiColor) return;

        // Check Status
        if (modelStatus !== 'ready') {
            console.warn("AI called but model not ready:", modelStatus);
            return;
        }

        setIsThinking(true);

        // Capture the prompt that is being sent
        const promptObj = buildSmartPrompt(tracker, queryFormat, promptMode, aiColor);

        // Add User Prompt to Conversation
        setConversation(prev => [...prev, {
            role: 'user',
            content: promptObj.content,
            timestamp: Date.now()
        }]);

        try {
            // Small delay for UX
            await new Promise(resolve => setTimeout(resolve, 300));

            // getMove now returns { raw, san }
            const moveResult = await getMove(tracker, selectedModel, queryFormat);

            if (moveResult && moveResult.san) {
                const { raw, san } = moveResult;

                // Add Model Response to Conversation
                setConversation(prev => [...prev, {
                    role: 'model',
                    content: raw,
                    meta: { move: san },
                    timestamp: Date.now()
                }]);

                // Try to make the move, forcing it if necessary
                const result = tracker.makeForceMoveFromSan(san);

                if (result && result.move) {
                    const { move, isIllegal } = result;

                    if (isIllegal) {
                        console.warn("AI played illegal move. Forcing:", san);
                        // Optional: Toaster notification here?
                    }

                    // Update last move highlight
                    const files = "abcdefgh";
                    const fromRow = 8 - parseInt(move.from[1]);
                    const fromCol = files.indexOf(move.from[0]);
                    const toRow = 8 - parseInt(move.to[1]);
                    const toCol = files.indexOf(move.to[0]);

                    setLastMove({
                        from: { row: fromRow, col: fromCol },
                        to: { row: toRow, col: toCol }
                    });

                } else {
                    console.error("Failed to execute move:", san);
                    // Treat as error in conversation?
                    setConversation(prev => [...prev, {
                        id: Date.now() + 2,
                        role: 'error',
                        content: `Failed to execute move "${san}". It might be illegal or invalid.`,
                        timestamp: new Date()
                    }]);
                    setModelStatus('error');
                    setIsThinking(false);
                    return;
                }
                // Update last move highlight happens automatically when we set board state via tracker
                // But we want to explicitly set lastMove for UI
                // Note: tracker.makeMove or makeForceMoveFromSan already updates tracker history

            } else {
                // getMove didn't return a valid SAN object.
                // Show the raw response if we have it, so the user knows what the AI said.
                if (moveResult && moveResult.raw) {
                    setConversation(prev => [...prev, {
                        role: 'model',
                        content: moveResult.raw,
                        timestamp: Date.now()
                    }]);
                }

                console.error("AI returned invalid format:", moveResult);

                setConversation(prev => [...prev, {
                    id: Date.now() + 2,
                    role: 'error',
                    content: `AI Response Error: Could not parse a valid move from the response.`,
                    timestamp: new Date()
                }]);

                setModelStatus('error');
                setIsThinking(false);
                return;
            }

            // Update state
            updateDisplay();
            setViewingMoveIndex(null);

            // Check game over
            if (tracker.isGameOver()) {
                setGameStatus(tracker.isCheckmate() ? 'checkmate' : 'draw');
            }
            setModelStatus('ready');

        } catch (error) {
            console.error("AI Model Error:", error);
            setConversation(prev => [...prev, {
                id: Date.now() + 2,
                role: 'error',
                content: `Error: ${error.message || "Failed to get response from model."}`,
                timestamp: new Date()
            }]);
            setModelStatus('error');
        } finally {
            setIsThinking(false);
        }
    }, [aiColor, queryFormat, promptMode, selectedModel, updateDisplay, modelStatus]);


    const makePlayerMove = useCallback((from, to, promotion = null) => {
        if (isThinking || viewingMoveIndex !== null) return false;

        const tracker = trackerRef.current;
        const move = tracker.makeMove(from, to, promotion);

        if (move) {
            const files = "abcdefgh";
            const fromRow = 8 - parseInt(move.from[1]);
            const fromCol = files.indexOf(move.from[0]);
            const toRow = 8 - parseInt(move.to[1]);
            const toCol = files.indexOf(move.to[0]);

            setLastMove({
                from: { row: fromRow, col: fromCol },
                to: { row: toRow, col: toCol }
            });

            updateDisplay();

            if (tracker.isGameOver()) {
                setGameStatus(tracker.isCheckmate() ? 'checkmate' : 'draw');
            } else {
                // Trigger AI
                setTimeout(() => makeAIMove(), 100);
            }
            return true;
        }
        return false;
    }, [isThinking, viewingMoveIndex, aiColor, updateDisplay, makeAIMove]);

    const resetGame = useCallback((newPlayerColor = null) => {
        trackerRef.current.reset();
        setGameStatus(null);
        setLastMove(null);
        setViewingMoveIndex(null);
        setCurrentPrompt({ type: "", content: "" });
        setConversation([]); // Clear conversation
        setIsThinking(false);
        setMoveHistory([]);
        setBoard(trackerRef.current.getCurrentBoard());
        setGameKey(k => k + 1);
        hasTriggeredInitialAI.current = false;

        if (newPlayerColor) {
            setPlayerColor(newPlayerColor);
        }
    }, []);

    const viewMove = useCallback((index) => {
        const tracker = trackerRef.current;
        const boardState = tracker.getStateAtMove(index + 1);
        setBoard(boardState);
        setViewingMoveIndex(index);
    }, []);

    const returnToLive = useCallback(() => {
        setViewingMoveIndex(null);
        setBoard(trackerRef.current.getCurrentBoard());
    }, []);

    // Update Prompt when state changes
    useEffect(() => {
        // We only update prompt if we are not thinking (or maybe we do want to see it change while thinking? usually thinking blocks changes)
        // And if game is not over?
        // The requirement is "update when settings change".
        // Also update when board state changes (which implies turn change).

        // We need to know who's turn it is to generate prompt
        const tracker = trackerRef.current;

        // Only generate prompt if there is a next move to be made by AI?
        // Or just "What WOULD the prompt be?"
        // Usually we show the prompt for the UPCOMING move.
        // If it is player turn, we show prompt for AI? Key is "Model Query".
        // So we should show the prompt that WILL be sent when AI moves.
        // This is most relevant when it IS AI turn or about to be.
        // But user wants to see it to debug.

        const prompt = buildSmartPrompt(tracker, queryFormat, promptMode, aiColor);
        setCurrentPrompt(prompt);

    }, [queryFormat, promptMode, aiColor, board, selectedModel]); // Dependencies that affect prompt content

    // Initial AI Move Effect
    useEffect(() => {
        const tracker = trackerRef.current;
        if (playerColor === 'b' && tracker.turn() === 'w' && !hasTriggeredInitialAI.current && !tracker.isGameOver()) {
            hasTriggeredInitialAI.current = true;
            // Small delay to ensure render
            setTimeout(() => makeAIMove(), 500);
        }
    }, [playerColor, gameKey, makeAIMove]);

    /* -------------------------------------------------------------------------- */
    /*                                  Expose                                    */
    /* -------------------------------------------------------------------------- */

    const value = {
        // State
        playerColor,
        selectedModel,
        modelStatus,
        queryFormat,
        promptMode,
        conversation,
        board,
        moveHistory,
        gameStatus,
        currentPrompt,
        isThinking,
        viewingMoveIndex,
        lastMove,
        gameKey,

        // Setters (Configuration)
        setPlayerColor,
        setSelectedModel,
        setQueryFormat,
        setPromptMode,

        // Actions
        makePlayerMove,
        resetGame,
        viewMove,
        returnToLive,
        trackerRef // exposed if needed for advanced things like getLegalMoves
    };

    return (
        <GameContext.Provider value={value}>
            {children}
        </GameContext.Provider>
    );
};
