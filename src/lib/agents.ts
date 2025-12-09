'use server';

const mockResponses = {
  gpt: [
    "GPT here. I think the answer is 42, but I'll need to crunch the numbers again. It's a complex multi-faceted issue with a lot of nuance.",
    "As a large language model, I've processed vast amounts of text. My analysis indicates a high probability of success if we proceed with the proposed strategy.",
    "I've analyzed the data, and the most likely outcome is positive. The key performance indicators are all trending in the right direction. We should feel confident.",
    "The core concept revolves around synergy and leveraging core competencies to achieve a paradigm shift in the marketplace. It's about thinking outside the box.",
  ],
  gemini: [
    "Gemini responding. My analysis suggests a different approach might yield better results. Have we considered the ethical implications of this path?",
    "Based on my training data, I'd recommend exploring alternative solutions. The current model has several potential failure points that need to be addressed.",
    "That's an interesting perspective. Let's break it down further. The foundational assumptions seem solid, but the implementation details are where the risk lies.",
    "From my perspective, the key is to focus on user-centric design principles. If the user experience is flawed, the entire project is at risk.",
  ],
};

const simulateDelay = (min = 500, max = 2000) => {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
};

export async function callGptAgent(message: string): Promise<string> {
  await simulateDelay();
  const responses = mockResponses.gpt;
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  return message ? `Regarding "${message}", my assessment is as follows:\n\n${randomResponse}` : randomResponse;
}

export async function callGeminiAgent(message: string): Promise<string> {
  await simulateDelay();
  const responses = mockResponses.gemini;
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  return message ? `In response to "${message}", here is my analysis:\n\n${randomResponse}` : randomResponse;
}
