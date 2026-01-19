import React, { useState } from "react";
import Chessboard from "../components/Chessboard";
import { Ticker } from "../components/Ticker";
import styles from "./ChessPage.module.scss";
import { GameProvider, useGame } from "../context/GameContext";
import { ConversationLog } from "../components/ConversationLog";

const LLM_MODELS = [
  { id: "random", name: "Random (No AI)", provider: "local" },
  { id: "gpt-4", name: "GPT-4", provider: "openai" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai" },
  { id: "claude-3-opus", name: "Claude 3 Opus", provider: "anthropic" },
  { id: "claude-3-sonnet", name: "Claude 3 Sonnet", provider: "anthropic" },
  { id: "gemini-pro", name: "Gemini Pro", provider: "google" },
];

const QUERY_FORMATS = [
  { id: "fen", name: "FEN Notation", description: "Standard chess position notation" },
  { id: "pgn", name: "PGN Moves", description: "Portable Game Notation move list" },
  { id: "visual", name: "Visual Grid", description: "ASCII board representation" },
];

const PROMPT_MODES = [
  { id: "full", name: "Full Prompt", description: "Complete position info each turn" },
  { id: "conversation", name: "Conversation", description: "Initial context, then just moves" },
];

const ChessGameContent = () => {
  const {
    playerColor,
    selectedModel,
    setSelectedModel,
    queryFormat,
    setQueryFormat,
    promptMode,
    setPromptMode,
    gameStatus,
    currentPrompt,
    conversation, // New
    resetGame,
    gameKey
  } = useGame();

  const [showSettings, setShowSettings] = useState(false);

  const handleNewGame = (color) => {
    let finalColor = color;
    if (color === "random") {
      finalColor = Math.random() > 0.5 ? "w" : "b";
    }
    resetGame(finalColor);
  };

  const getPromptTypeLabel = () => {
    // If conversation is empty, show label based on settings
    // If conversation is active, show "HISTORY"
    if (conversation.length > 0) return "CONVERSATION";

    if (!currentPrompt.type) return promptMode.toUpperCase();
    if (currentPrompt.type === "initial") return "INITIAL";
    if (currentPrompt.type === "followup") return "FOLLOW-UP";
    return "FULL";
  };

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>ChessLLM</h1>
        <p className={styles.subtitle}>Play against AI models — test their chess reasoning</p>
      </header>

      {/* Game Controls */}
      <div className={styles.controlPanel}>
        <div className={styles.gameButtons}>
          <button
            className={styles.newGameBtn}
            onClick={() => handleNewGame("w")}
          >
            ♔ Play as White
          </button>
          <button
            className={styles.newGameBtn}
            onClick={() => handleNewGame("b")}
          >
            ----Play as Black
          </button>
          <button
            className={`${styles.newGameBtn} ${styles.randomBtn}`}
            onClick={() => handleNewGame("random")}
          >
            --- Random Side
          </button>
          <button
            className={styles.settingsBtn}
            onClick={() => setShowSettings(!showSettings)}
          >
            --- Settings
          </button>
        </div>
      </div>

      {/* Game Status */}
      {gameStatus && (
        <div className={styles.gameStatusBanner}>
          {gameStatus === "checkmate" && "Checkmate!"}
          {gameStatus === "draw" && "Game ended in a draw"}
          <button onClick={() => handleNewGame(playerColor)}>Play Again</button>
        </div>
      )}

      {/* Main Content - Board and Prompt side by side */}
      <div className={styles.mainContent}>
        {/* Left side: Board + Move history */}
        <div className={styles.boardSection}>
          <div className={styles.gameInfo}>
            <span className={styles.infoItem}>
              <strong>{playerColor === "w" ? "White" : "Black"}</strong> vs <strong>{LLM_MODELS.find(m => m.id === selectedModel)?.name}</strong>
            </span>
          </div>

          <Chessboard />

          {/* Ticker moved here as sibling */}
          <Ticker />

        </div>

        {/* Right side: Prompt Display */}
        <div className={styles.promptSection}>
          <div className={styles.promptArea}>
            <div className={styles.promptHeader}>
              <h3>Model Query & Response</h3>
              <div className={styles.promptBadges}>
                <span className={styles.formatBadge}>{queryFormat.toUpperCase()}</span>
                <span className={`${styles.formatBadge} ${styles.typeBadge}`}>{getPromptTypeLabel()}</span>
              </div>
            </div>
            {conversation.length === 0 ? (
              <pre className={styles.promptContent}>
                {currentPrompt.content || "Make a move to start the conversation..."}
              </pre>
            ) : (
              <ConversationLog conversation={conversation} currentPendingPrompt={currentPrompt} />
            )}

          </div>
        </div>
      </div>

      {/* Settings Modal Overlay */}
      {showSettings && (
        <div className={styles.settingsOverlay} onClick={() => setShowSettings(false)}>
          <div className={styles.settingsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Settings</h2>
              <button className={styles.closeBtn} onClick={() => setShowSettings(false)}>
                ✕
              </button>
            </div>

            <div className={styles.settingSection}>
              <h3>LLM Model</h3>
              <div className={styles.modelGrid}>
                {LLM_MODELS.map((model) => (
                  <button
                    key={model.id}
                    className={`${styles.modelOption} ${selectedModel === model.id ? styles.selected : ""}`}
                    onClick={() => setSelectedModel(model.id)}
                  >
                    <span className={styles.modelName}>{model.name}</span>
                    <span className={styles.modelProvider}>{model.provider}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.settingSection}>
              <h3>Prompt Mode</h3>
              <div className={styles.formatOptions}>
                {PROMPT_MODES.map((mode) => (
                  <label
                    key={mode.id}
                    className={`${styles.formatOption} ${promptMode === mode.id ? styles.selected : ""}`}
                  >
                    <input
                      type="radio"
                      name="promptMode"
                      value={mode.id}
                      checked={promptMode === mode.id}
                      onChange={(e) => setPromptMode(e.target.value)}
                    />
                    <div>
                      <span className={styles.formatName}>{mode.name}</span>
                      <span className={styles.formatDesc}>{mode.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.settingSection}>
              <h3>Query Format</h3>
              <div className={styles.formatOptions}>
                {QUERY_FORMATS.map((format) => (
                  <label
                    key={format.id}
                    className={`${styles.formatOption} ${queryFormat === format.id ? styles.selected : ""}`}
                  >
                    <input
                      type="radio"
                      name="queryFormat"
                      value={format.id}
                      checked={queryFormat === format.id}
                      onChange={(e) => setQueryFormat(e.target.value)}
                    />
                    <div>
                      <span className={styles.formatName}>{format.name}</span>
                      <span className={styles.formatDesc}>{format.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ChessPage = () => {
  return (
    <GameProvider>
      <ChessGameContent />
    </GameProvider>
  );
};

export default ChessPage;