# **App Name**: MultaMind

## Core Features:

- Dual-Agent Display: Display GPT and Gemini responses side-by-side. Two-column layout on desktop. On mobile, use tabs to switch between GPT and Gemini.
- Chat Input: Single shared chat input at the bottom. Sending a message triggers both mock functions: callGptAgent() and callGeminiAgent(). Use placeholder mock responses for now.
- Slash Commands: Support the following slash commands: /gpt (only GPT responds), /gemini (only Gemini responds), /gemini review gpt (Gemini critiques the last GPT answer), and /multa summarize (Summarize the most recent GPT + Gemini answers).
- GPT Agent Interaction: Handle messages directed specifically to the GPT agent via slash commands, including a 'review' command where Gemini critiques GPT's answer. (Placeholder implementation).
- Gemini Agent Interaction: Handle messages directed specifically to the Gemini agent via slash commands. (Placeholder implementation).
- Summarization Tool: Compare GPT and Gemini responses using /multa summarize.
- Quick Action Buttons: Offer UI helpers for pre-filling common slash commands to speed up interaction.
- Message Model: Implement ChatMessage interface.
- Components: Split components: ChatLayout, ChatColumn, ChatInput, MessageBubble. Use React + TypeScript + Tailwind. Keep mock agent functions isolated in /lib/agents.ts.

## Style Guidelines:

- Theme: Minimalist, dark, monochrome.
- Primary background: #0D0D0D (deep black).
- Surface elements: #1A1A1A (dark gray).
- Borders/dividers: #2A2A2A.
- Text primary: #FFFFFF (white).
- Text secondary: #C4C4C4 (soft gray).
- Accent: #EAEAEA (white-gray) for input fields and subtle highlights.
- Font: Inter.
- UI: Flat, minimal, low-radius corners (4–6px), no bright colors.
- Buttons: Ghost/outline style, white or gray text.
- Indicators: Minimal three-dot typing indicator in soft gray.
- Layout: Two-column on desktop, stacked tabs on mobile.