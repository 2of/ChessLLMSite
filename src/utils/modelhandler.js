import { initGemini, getGeminiMove } from "./handlers/GeminiHandler";
import { initOpenAI, getOpenAIMove } from "./handlers/OpenAIHandler";
import { initClaude, getClaudeMove } from "./handlers/ClaudeHandler";
import { getRandomMove } from "./handlers/RandomHandler";

export const getMove = async (tracker, model = "random", queryFormat = "fen") => {
  const legalMoves = tracker.getLegalMoves();
  if (legalMoves.length === 0) return null;

  switch (model) {
    case "gemini-pro": 
      return getGeminiMove(tracker, model, queryFormat);

    case "gpt-4":
    case "gpt-3.5-turbo":
      return getOpenAIMove(tracker, model, queryFormat);

    case "claude-3-opus":
    case "claude-3-sonnet":
      return getClaudeMove(tracker, model, queryFormat);

    case "random":
    default:
      return getRandomMove(tracker);
  }
};

// Dispatcher for init 
export const initModel = async (model, apiKey) => {
  console.log(`[ModelHandler] Initializing ${model}...`);
  
  if (model === 'random') return true;

  if (model === "gemini-pro") {
      return initGemini();
  }
  
  if (model.startsWith("gpt")) {
      return initOpenAI();
  }

  if (model.startsWith("claude")) {
      return initClaude();
  }

  return true;
};



export const formatBoardState = (tracker, format = "fen") => {
  switch (format) {
    case "fen": return tracker.fen();
    case "pgn": return tracker.pgn();
    case "visual": return formatVisualBoard(tracker.getCurrentBoard());
    default: return tracker.fen();
  }
};

const formatVisualBoard = (board) => {
  const lines = [];
  lines.push("  a b c d e f g h");
  lines.push("  ---------------");
  for (let row = 0; row < 8; row++) {
    const rank = 8 - row;
    const pieces = board[row].map(p => p || ".").join(" ");
    lines.push(`${rank}|${pieces}|${rank}`);
  }
  lines.push("  ---------------");
  lines.push("  a b c d e f g h");
  return lines.join("\n");
};

export const buildPrompt = (tracker, format = "fen") => {
  const boardState = formatBoardState(tracker, format);
  const turn = tracker.turn() === "w" ? "White" : "Black";
  const moveNumber = Math.floor(tracker.totalMoves / 2) + 1;

  return `You are playing chess as ${turn}. It is move ${moveNumber}.

Current position:
${boardState}

Legal moves: ${tracker.getLegalMoves().map(m => m.san).join(", ")}

Respond with ONLY your chosen move in standard algebraic notation (e.g., "e4", "Nf3", "O-O").`;
};

export const buildInitialConversationPrompt = (aiColor, format = "fen") => {
  const colorName = aiColor === "w" ? "White" : "Black";
  const formatDesc = format === "fen" ? "FEN notation" : format === "pgn" ? "PGN move list" : "ASCII board";

  return `You are playing chess as ${colorName}. 

I will send you the game state in ${formatDesc} format. After each of my moves, you should respond with ONLY your chosen move in standard algebraic notation (e.g., "e4", "Nf3", "O-O", "Bxe5").

Do not include any explanation or commentary - just the move. Let's begin!`;
};

export const buildConversationFollowUp = (tracker, format = "fen") => {
  const moves = tracker.getDetailedMoves();
  const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;

  if (!lastMove) return `It's your move.`;

  const recentMoves = moves.slice(-2).map(m => m.san).join(" ");
  return `${recentMoves}

Your move.`;
};

export const buildSmartPrompt = (tracker, format = "fen", promptMode = "full", aiColor = "b") => {
  if (promptMode === "full") {
    return {
      type: "full",
      content: buildPrompt(tracker, format)
    };
  }

  const totalMoves = tracker.totalMoves;
  const isFirstAITurn = (aiColor === "w" && totalMoves === 0) || (aiColor === "b" && totalMoves === 1);

  if (isFirstAITurn) {
    const initial = buildInitialConversationPrompt(aiColor, format);
    const boardState = formatBoardState(tracker, format);

    return {
      type: "initial",
      content: `${initial}

Current position:
${boardState}`
    };
  }

  return {
    type: "followup",
    content: buildConversationFollowUp(tracker, format)
  };
};

