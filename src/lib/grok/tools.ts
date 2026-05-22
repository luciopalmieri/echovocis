export interface GrokTool {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const KNOWN_FUNCTIONS = new Set([
  "save_mistake",
  "get_user_history",
  "generate_exercise",
  "save_progress",
]);

export function isKnownFunction(name: string): boolean {
  return KNOWN_FUNCTIONS.has(name);
}

export const GROK_TOOLS: GrokTool[] = [
  {
    type: "function",
    name: "save_mistake",
    description:
      "Save a language mistake identified during conversation. Call this when you correct a significant error in the user's speech — grammar mistakes, wrong word choices, or unnatural phrasing. Do not save minor pronunciation variations.",
    parameters: {
      type: "object",
      properties: {
        original: {
          type: "string",
          description: "What the user actually said (their version)",
        },
        corrected: {
          type: "string",
          description: "The corrected, natural version",
        },
        type: {
          type: "string",
          enum: ["grammar", "vocabulary", "pronunciation", "fluency"],
          description: "Category of the mistake",
        },
        targetLanguage: {
          type: "string",
          description: "ISO language code of the target language (e.g. 'en', 'it')",
        },
      },
      required: ["original", "corrected", "type", "targetLanguage"],
    },
  },
  {
    type: "function",
    name: "get_user_history",
    description:
      "Retrieve the user's recent mistakes and recurring patterns. Call this at the start of a session or when you want to check what the user has been struggling with, to personalize your coaching.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Max number of recent mistakes to return (default 10, max 50)",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "generate_exercise",
    description:
      "Create a personalized exercise based on the user's past mistakes. Call this when the user asks for practice or when you want to reinforce a weak point you've noticed.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["drill", "repetition", "translation_prompt", "fluency_booster"],
          description: "Type of exercise to generate",
        },
        basedOnMistakeIds: {
          type: "array",
          items: { type: "string" },
          description:
            "IDs of mistakes to base the exercise on. If empty, the backend selects the most recent recurring mistakes.",
        },
      },
      required: ["type"],
    },
  },
  {
    type: "function",
    name: "save_progress",
    description:
      "Update the user's session progress counters. Call this periodically during conversation (roughly every few exchanges) to track how much the user has spoken and how many mistakes were made.",
    parameters: {
      type: "object",
      properties: {
        sentencesSpoken: {
          type: "integer",
          description: "Number of sentences the user has spoken so far this session",
        },
        mistakesCount: {
          type: "integer",
          description: "Number of mistakes identified so far this session",
        },
        correctionsAccepted: {
          type: "integer",
          description:
            "Number of times the user repeated the corrected version",
        },
        targetLanguage: {
          type: "string",
          description: "ISO language code of the target language (e.g. 'en', 'it')",
        },
      },
      required: ["sentencesSpoken", "mistakesCount", "correctionsAccepted", "targetLanguage"],
    },
  },
];
