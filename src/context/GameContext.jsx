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

    const trackerRef = useRef(new ChessTracker());

    
    const [playerColor, setPlayerColor] = useState("w"); 
    const [selectedModel, setSelectedModel] = useState("random");
    const [modelStatus, setModelStatus] = useState("ready"); 
    const [queryFormat, setQueryFormat] = useState("fen");
    const [promptMode, setPromptMode] = useState("full");

    
    const [board, setBoard] = useState(trackerRef.current.getCurrentBoard());
    const [moveHistory, setMoveHistory] = useState([]);
    const [gameStatus, setGameStatus] = useState(null); 
    const [conversation, setConversation] = useState([]); 
    const [currentPrompt, setCurrentPrompt] = useState({ type: "", content: "" }); 
    const [gameKey, setGameKey] = useState(0); 

    
    const [isThinking, setIsThinking] = useState(false);
    const [viewingMoveIndex, setViewingMoveIndex] = useState(null);
    const [lastMove, setLastMove] = useState(null);

    const hasTriggeredInitialAI = useRef(false);


    const updateDisplay = useCallback(() => {
        const tracker = trackerRef.current;
        if (viewingMoveIndex !== null) {
          
        } else {
            setBoard(tracker.getCurrentBoard());
        }
        setMoveHistory(tracker.getDetailedMoves());
    }, [viewingMoveIndex]);

    const aiColor = playerColor === "w" ? "b" : "w";

    useEffect(() => {
        
        const initialize = async () => {
            if (selectedModel === 'random') {
                setModelStatus('ready');
                return;
            }

            setModelStatus('initializing');
            try {
                
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

   
   
   

    const makeAIMove = useCallback(async () => {
        const tracker = trackerRef.current;

        
        if (tracker.isGameOver()) return;
        if (tracker.turn() !== aiColor) return;

        
        if (modelStatus !== 'ready') {
            console.warn("AI called but model not ready:", modelStatus);
            return;
        }

        setIsThinking(true);

        
        const promptObj = buildSmartPrompt(tracker, queryFormat, promptMode, aiColor);

        
        setConversation(prev => [...prev, {
            role: 'user',
            content: promptObj.content,
            timestamp: Date.now()
        }]);

        try {
            
            await new Promise(resolve => setTimeout(resolve, 300));

            
            const moveResult = await getMove(tracker, selectedModel, queryFormat);

            if (moveResult && moveResult.san) {
                const { raw, san } = moveResult;

                
                setConversation(prev => [...prev, {
                    role: 'model',
                    content: raw,
                    meta: { move: san },
                    timestamp: Date.now()
                }]);

                
                const result = tracker.makeForceMoveFromSan(san);

                if (result && result.move) {
                    const { move, isIllegal } = result;

                    if (isIllegal) {
                        console.warn("AI played illegal move. Forcing:", san);
                        
                    }

                    
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
                
                
                

            } else {
                
                
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

            
            updateDisplay();
            setViewingMoveIndex(null);

            
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
        setConversation([]); 
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


    useEffect(() => {

        const tracker = trackerRef.current;


        const prompt = buildSmartPrompt(tracker, queryFormat, promptMode, aiColor);
        setCurrentPrompt(prompt);

    }, [queryFormat, promptMode, aiColor, board, selectedModel]); 

    
    useEffect(() => {
        const tracker = trackerRef.current;
        if (playerColor === 'b' && tracker.turn() === 'w' && !hasTriggeredInitialAI.current && !tracker.isGameOver()) {
            hasTriggeredInitialAI.current = true;
            
            setTimeout(() => makeAIMove(), 500);
        }
    }, [playerColor, gameKey, makeAIMove]);

   
   
   

    const value = {
        
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

        
        setPlayerColor,
        setSelectedModel,
        setQueryFormat,
        setPromptMode,

        
        makePlayerMove,
        resetGame,
        viewMove,
        returnToLive,
        trackerRef 
    };

    return (
        <GameContext.Provider value={value}>
            {children}
        </GameContext.Provider>
    );
};
