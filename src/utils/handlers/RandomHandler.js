export const getRandomMove = async (tracker) => {
    const legalMoves = tracker.getLegalMoves();
    if (legalMoves.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * legalMoves.length);
    const selectedMove = legalMoves[randomIndex];

    const phrases = [
        `I'll play ${selectedMove.san}.`,
        `Let's go with ${selectedMove.san}.`,
        `Interesting position. ${selectedMove.san} looks good.`,
        `${selectedMove.san}`,
    ];
    const rawResponse = phrases[Math.floor(Math.random() * phrases.length)];

    console.log(`[RandomHandler] Selected move: ${selectedMove.san}`);

    return {
        raw: rawResponse,
        san: selectedMove.san
    };
};
