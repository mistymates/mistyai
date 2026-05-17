import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { convertToModelMessages, streamText, embed, generateText, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toMemoryEmbedding } from "@/lib/ai/embeddings";
import { logEmbeddingUsage, logLanguageModelUsage } from "@/lib/ai/token-usage";
import { defaultPersonality } from "@/lib/assistant-settings";

const LOW_VALUE_MEMORY_MESSAGES = new Set([
  "ok",
  "okay",
  "k",
  "kk",
  "y",
  "yes",
  "yeah",
  "yep",
  "yup",
  "sure",
  "alright",
  "all right",
  "got it",
  "sounds good",
  "nice",
  "cool",
  "great",
  "awesome",
  "perfect",
  "thanks",
  "thank you",
  "thx",
  "ty",
  "done",
  "done sir",
  "consider it done",
  "of course",
  "handled",
  "yessir",
  "yes sir",
  "no",
  "nope",
  "nah",
  "later",
  "brb",
  "afk",
  "lol",
  "lmao",
  "haha",
  "hehe",
  "hmm",
  "hm",
  "huh",
  "what",
  "wait",
  "hold on",
  "one sec",
  "one second",
  "idk",
  "i dont know",
  "i don't know",
  "maybe",
  "probly",
  "probably",
  "same",
  "same here",
  "me too",
  "nvm",
  "never mind",
  "nevermind",
  "my bad",
  "oops",
  "fine",
  "good",
  "bad",
  "hi",
  "hello",
  "hey",
  "yo",
  "sup",
  "bye",
  "goodbye",
  "gn",
  "good night",
  "morning",
  "good morning",
  "evening",
  "good evening",
  "test",
  "testing",
  "ping",
  "check",
  "works",
  "working",
  "try again",
  "again",
  "whoops",
  "hmm okay",
  "ok thanks",
  "thanks misty",
  "thank you misty",
]);

function normalizeForMemory(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldSkipMemoryExtraction(text: string) {
  const normalized = normalizeForMemory(text);
  if (!normalized) return true;
  if (LOW_VALUE_MEMORY_MESSAGES.has(normalized)) return true;

  const tokenCount = normalized.split(" ").length;
  if (tokenCount <= 2 && normalized.length <= 15) return true;
  if (normalized.endsWith("?")) return true;

  const lowSignalPrefixes = [
    "ok ",
    "okay ",
    "thanks ",
    "thank you ",
    "cool ",
    "great ",
    "nice ",
    "done ",
    "yes ",
    "no ",
    "hmm ",
    "lol ",
    "haha ",
  ];

  if (lowSignalPrefixes.some((prefix) => normalized.startsWith(prefix)) && tokenCount <= 5) {
    return true;
  }

  const highSignalPhrases = [
    "my name is",
    "call me",
    "i am",
    "i m",
    "i work as",
    "i live in",
    "my birthday is",
    "my birth date is",
    "i prefer",
    "i like",
    "i dislike",
    "i love",
    "i hate",
    "my favorite",
    "remember that",
    "dont forget",
    "don't forget",
    "i need to",
    "my goal is",
    "i want to",
    "i plan to",
    "i usually",
    "every day",
    "every week",
    "allergic to",
    "i take",
  ];

  const looksLikeFactWithValue =
    /\b(my|i)\b/.test(normalized) &&
    /( is | are | prefer | like | love | hate | need | want | plan | work | live )/.test(
      normalized,
    ) &&
    tokenCount >= 5;

  const hasDateLikeInfo =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(
      normalized,
    ) || /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/.test(normalized);

  const hasHighSignalPhrase = highSignalPhrases.some((phrase) => normalized.includes(phrase));

  // Default deny: only allow extraction for clear long-term personal facts/preferences.
  if (!(hasHighSignalPhrase || looksLikeFactWithValue || hasDateLikeInfo)) {
    return true;
  }

  // Keep memory cleaner by rejecting short statements unless they clearly include dates/facts.
  if (tokenCount < 4 && !hasDateLikeInfo) return true;

  return false;
}

function getTextFromMessage(message: UIMessage | undefined) {
  if (!message) return "";

  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}

function isFridayStylePrompt(prompt?: string) {
  if (!prompt) return false;
  const p = prompt.toLowerCase();
  return (
    p.includes("jarvis") ||
    p.includes("friday") ||
    p.includes("genius inventor") ||
    p.includes("luxury ai assistant")
  );
}

function isShortCommandLike(text: string) {
  const normalized = normalizeForMemory(text);
  if (!normalized) return false;
  const tokens = normalized.split(" ");
  if (tokens.length <= 6) return true;
  const commandStarters = [
    "add ",
    "set ",
    "create ",
    "open ",
    "show ",
    "save ",
    "remember ",
    "log ",
    "summarize ",
    "refresh ",
    "delete ",
    "remove ",
    "update ",
    "start ",
    "stop ",
  ];
  return commandStarters.some((prefix) => normalized.startsWith(prefix)) && tokens.length <= 12;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractMemory(text: string, google: any) {
  try {
    const modelName =
      process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || "gemini-3-flash-preview";
    const result = await generateText({
      model: google(modelName),
      prompt: `Analyze this message for long-term facts about the user.
Categories: Me, People, Preferences, Goals, Health, Relationships.
Output JSON ONLY: { "is_memory": boolean, "category": string, "content": string, "metadata": {}, "importance": number }
Importance is a scale of 1-5 (1: trivial, 5: life-changing).
Do NOT include markdown code blocks, output only raw JSON.

User message: "${text}"`,
      responseFormat: { type: "json_object" },
    });
    logLanguageModelUsage("[API/Chat] Extract memory", result.totalUsage, { model: modelName });

    return JSON.parse(result.text.trim());
  } catch (e) {
    console.error("Memory extraction failed:", e);
    return { is_memory: false };
  }
}

async function getSavedPersonalityPrompt() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return defaultPersonality.prompt;

  const { data, error } = await supabase
    .from("assistant_settings")
    .select("personality_prompt")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load assistant personality:", error);
    return defaultPersonality.prompt;
  }

  return data?.personality_prompt || defaultPersonality.prompt;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { messages, system, personalityPrompt } = (await request.json()) as {
          messages: UIMessage[];
          system?: string;
          personalityPrompt?: string;
        };

        const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!geminiKey) {
          return new Response("Missing GEMINI_API_KEY", { status: 500 });
        }

        const google = createGoogleGenerativeAI({ apiKey: geminiKey });

        const lastMessage = messages[messages.length - 1];
        const userText = getTextFromMessage(lastMessage);
        let relevantMemories = "";

        if (userText) {
          const supabase = createSupabaseAdminClient();

          try {
            if (!supabase) throw new Error("Supabase configuration missing");

            const embeddingResult = await embed({
              model: google.textEmbeddingModel("gemini-embedding-2", {
                outputDimensionality: 768,
              }),
              value: userText,
            });
            const { embedding: rawEmbedding } = embeddingResult;
            const embedding = toMemoryEmbedding(rawEmbedding);
            logEmbeddingUsage("[API/Chat] Search embed", embeddingResult.usage, {
              model: "gemini-embedding-2",
            });

            const { data: matchedMemories } = await supabase.rpc("search_memories_advanced", {
              query_embedding: embedding,
              match_threshold: 0.5,
              match_count: 8,
            });

            if (matchedMemories && matchedMemories.length > 0) {
              // Update access stats in background
              matchedMemories.forEach((m: { id: string }) => {
                supabase.rpc("mark_memory_accessed", { memory_id: m.id }).then();
              });

              relevantMemories =
                "\n\nRelevant past memories (prioritized by importance and recency):\n" +
                matchedMemories
                  .map((m: { content: string; category: string }) => `[${m.category}] ${m.content}`)
                  .join("\n");
            }

            // Auto-extract and save long-term memories in the background.
            // Skip low-signal replies to reduce token spend.
            if (!shouldSkipMemoryExtraction(userText)) {
              extractMemory(userText, google).then(async (memoryData) => {
                if (memoryData && memoryData.is_memory) {
                  try {
                    const memoryEmbeddingResult = await embed({
                      model: google.textEmbeddingModel("gemini-embedding-2", {
                        outputDimensionality: 768,
                      }),
                      value: memoryData.content,
                    });
                    const { embedding: rawMemoryEmbedding } = memoryEmbeddingResult;
                    const memoryEmbedding = toMemoryEmbedding(rawMemoryEmbedding);
                    logEmbeddingUsage("[API/Chat] Save memory embed", memoryEmbeddingResult.usage, {
                      model: "gemini-embedding-2",
                    });

                    const { error } = await supabase.from("memories").insert({
                      content: memoryData.content,
                      category: memoryData.category,
                      importance: memoryData.importance || 3,
                      metadata: {
                        ...(memoryData.metadata || {}),
                        source: "auto_extracted",
                        review_status: "pending",
                        extracted_at: new Date().toISOString(),
                      },
                      embedding: memoryEmbedding,
                    });

                    if (error) console.error("Failed to save extracted memory:", error);
                  } catch (e) {
                    console.error("Embedding or saving extracted memory failed:", e);
                  }
                }
              });
            }
          } catch (e) {
            console.error("Embedding or search failed", e);
          }
        }

        const modelName =
          process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || "gemini-3-flash-preview";
        console.log(`[API/Chat] Using model: ${modelName}`);

        const googleProvider = google(modelName);
        const activePersonality = personalityPrompt || (await getSavedPersonalityPrompt());
        const fridayMode = isFridayStylePrompt(activePersonality);
        const shortCommand = isShortCommandLike(userText);
        const conciseGuardrail = fridayMode
          ? `\n\nFriday mode response contract:
- Default to brevity. Do not write long replies unless the user asks for detail.
- Routine commands/settings/memory/navigation: one sentence under 12 words.
- Normal questions: 1-3 concise sentences.
- Complex answers: compact bullets only, no recap, no motivational padding.
- If action is completed or accepted, prefer: "Done, sir.", "Handled.", "Of course.", or "Consider it done."`
          : shortCommand
            ? `\n\nResponse style guardrail:
- Keep it concise and direct.
- No recap unless asked.
- For short commands, respond in one short sentence.`
            : "";
        const enhancedSystem = `${activePersonality}

Use markdown only when it improves clarity.${system ? `\n\n${system}` : ""}${relevantMemories}${conciseGuardrail}`;

        const result = streamText({
          model: googleProvider,
          system: enhancedSystem,
          messages: await convertToModelMessages(messages),
          onFinish({ totalUsage }) {
            logLanguageModelUsage("[API/Chat] Reply", totalUsage, { model: modelName });
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
