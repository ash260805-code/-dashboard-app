import OpenAI from "openai";

const apiKey = process.env.OPENROUTER_API_KEY;
const baseURL = "https://openrouter.ai/api/v1";

if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not defined");
}

const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
});

// Using 'text-embedding-3-small' which is often available via OpenRouter proxies
const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "google/gemini-2.0-flash-001";

export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const response = await client.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text,
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("OpenRouter Embedding Error:", error);
        throw error;
    }
}

export async function generateAnswer(prompt: string) {
    try {
        const response = await client.chat.completions.create({
            model: CHAT_MODEL,
            messages: [{ role: "user", content: prompt }],
        });
        return response.choices[0].message.content || "No response generated.";
    } catch (error) {
        console.error("OpenRouter Chat Error:", error);
        return "Sorry, I encountered an error generating the answer.";
    }
}

