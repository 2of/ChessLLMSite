import React, { useEffect, useRef } from "react";
import styles from "./styles/ConversationLog.module.scss";

export const ConversationLog = ({ conversation, currentPendingPrompt }) => {
    const endRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversation.length, currentPendingPrompt]);

    return (
        <div className={styles.container}>
            {conversation.map((msg, i) => {
                const isError = msg.role === 'error';
                const roleClass = isError ? 'error' : msg.role; // Maps to .user, .model, or .error in CSS

                return (
                    <div key={msg.id || i} className={`${styles.message} ${styles[roleClass]}`}>
                        <div className={styles.roleLabel}>
                            {isError ? "System Error" : (msg.role === "user" ? "Query Sent" : "Model Response")}
                        </div>

                        <div className={`${styles.bubble} ${isError ? styles.errorBubble : ''}`}>
                            <div className={styles.content}>{msg.content}</div>

                            {msg.derivedMove && (
                                <div className={styles.metaInfo}>
                                    <span className={styles.moveLabel}>Derived Move:</span>
                                    <span className={styles.moveValue}>{msg.derivedMove}</span>
                                </div>
                            )}

                            {/* Compatibility for old meta format if exists */}
                            {msg.meta && msg.meta.move && !msg.derivedMove && (
                                <div className={styles.metaInfo}>
                                    <span className={styles.moveLabel}>Derived Move:</span>
                                    <span className={styles.moveValue}>{msg.meta.move}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            
            <div ref={endRef} />
        </div>
    );
};
