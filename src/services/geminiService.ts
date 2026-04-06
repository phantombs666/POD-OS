import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export async function runAutomation(prompt: string, systemInstruction?: string): Promise<string> {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || "You are a scientific automation assistant. Provide clear, data-driven, and actionable insights.",
      },
    });
    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini Automation Error:", error);
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

export async function runSearchGrounding(query: string): Promise<string> {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text || "No search results found.";
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
