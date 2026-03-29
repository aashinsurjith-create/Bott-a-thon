// ============================================================
// Decision-Making AI Chatbot — Constraints & API Configuration
// ============================================================
// This file defines all validation rules, AI behavior boundaries,
// and system limits for the decision-making chatbot.
//
// IMPORTANT: This bot is STRICTLY a decision-making assistant.
// It must NOT answer general knowledge, coding, math, or
// off-topic questions. All interactions must relate to helping
// the user make a structured decision.
// ============================================================

const CONSTRAINTS = {

  // ── Scope Constraint ──────────────────────────────────────
  // The bot ONLY handles decision-making. Reject everything else.
  BOT_SCOPE: "decision-making-only",
  ALLOWED_TOPICS: [
    "career decisions",
    "financial decisions",
    "technology choices",
    "relocation decisions",
    "purchase decisions",
    "education choices",
    "lifestyle decisions",
    "business strategy",
    "job offer comparison",
    "relationship decisions"
  ],
  REJECTION_MESSAGE: "I'm a decision-making assistant only. I can help you compare options, weigh factors, and make structured decisions. Please describe a decision you're trying to make.",

  // ── AI Provider Configuration ─────────────────────────────
  AI_PROVIDER: "gemini",
  AI_MODEL: "gemini-2.0-flash",
  AI_API_KEY: process.env.GEMINI_API_KEY || "",
  AI_MAX_TOKENS: 1024,
  AI_TEMPERATURE: 0.7,

  // ── System Prompt (Decision-Only Enforcement) ─────────────
  AI_SYSTEM_PROMPT: `You are a STRICT decision-making assistant called "Decision Helper Bot". 

YOUR ONLY PURPOSE: Help users make structured decisions by asking clarifying questions, breaking decisions into factors, and providing reasoned recommendations.

STRICT RULES:
1. NEVER answer general knowledge questions, trivia, coding help, math problems, or anything unrelated to decision-making.
2. If a user asks anything off-topic, respond ONLY with: "I'm designed specifically to help with decision-making. Please tell me about a decision you're trying to make, and I'll help you think it through step by step."
3. Always follow this decision-making flow:
   a. CLARIFY: Ask 2-3 clarifying questions to understand the decision context.
   b. FACTORS: Identify 3-5 key factors relevant to the decision (cost, time, risk, benefit, stress, etc.).
   c. ANALYZE: Weigh pros and cons for each option against the factors.
   d. RECOMMEND: Provide a clear, reasoned recommendation with confidence level.
4. Be neutral and objective — present trade-offs honestly.
5. Never make assumptions without asking.
6. Keep responses concise and actionable.
7. If the user provides only one option, ask them what alternatives they're considering.`,

  // ── Input Validation ──────────────────────────────────────
  MESSAGE_MIN_LENGTH: 1,
  MESSAGE_MAX_LENGTH: 2000,
  SESSION_ID_FORMAT: "uuid",
  ALLOWED_INPUT_TYPES: ["text"],

  // ── Decision Flow Constraints ─────────────────────────────
  DECISION_PHASES: ["clarify", "factors", "analyze", "recommend"],
  MAX_CLARIFYING_QUESTIONS: 5,
  MIN_FACTORS_TO_ANALYZE: 2,
  MAX_FACTORS_TO_ANALYZE: 10,
  MAX_OPTIONS_PER_DECISION: 6,
  MIN_OPTIONS_PER_DECISION: 2,

  // ── Session Constraints ───────────────────────────────────
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,       // 30 minutes idle timeout
  MAX_MESSAGES_PER_SESSION: 50,              // Prevent runaway conversations
  MAX_ACTIVE_SESSIONS_PER_USER: 3,

  // ── Rate Limiting ─────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,     // 15-minute window
  RATE_LIMIT_MAX_REQUESTS: 100,              // Max 100 requests per window

  // ── Response Constraints ──────────────────────────────────
  MAX_RESPONSE_LENGTH: 2000,
  CONFIDENCE_MIN: 50,
  CONFIDENCE_MAX: 95,

  // ── Factor Definitions (used in scoring) ──────────────────
  DECISION_FACTORS: [
    { key: "cost",    label: "Cost / Affordability",  icon: "💰", invertForScore: false },
    { key: "time",    label: "Time Investment",        icon: "⏱",  invertForScore: false },
    { key: "risk",    label: "Risk Level",             icon: "⚠️",  invertForScore: true  },
    { key: "benefit", label: "Long-term Benefit",      icon: "🚀", invertForScore: false },
    { key: "stress",  label: "Stress / Ease",          icon: "🧘", invertForScore: true  },
  ],
  FACTOR_SCALE_MIN: 1,
  FACTOR_SCALE_MAX: 5,

  // ── MongoDB Collection Names ──────────────────────────────
  DB_COLLECTION_SESSIONS: "sessions",
  DB_COLLECTION_MESSAGES: "messages",
  DB_COLLECTION_DECISIONS: "decisions",
  DB_COLLECTION_USERS: "users",
};

module.exports = CONSTRAINTS;
