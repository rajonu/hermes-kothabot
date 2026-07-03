import { GoogleGenerativeAI } from "@google/generative-ai";

// Server-only: never import this in client components
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export function getGeminiModel(modelName = "gemini-2.5-flash-lite") {
  return genAI.getGenerativeModel({ model: modelName });
}

export async function generateText(prompt: string, systemInstruction?: string) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction,
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export { genAI };
