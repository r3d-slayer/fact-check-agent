import {
  GoogleGenAI,
  Type,
} from "@google/genai";

import {
  FactCheckResult,
  ClaimStatus,
} from "../types";

const ai = new GoogleGenAI({
  apiKey:
    import.meta.env.VITE_GEMINI_API_KEY,
});

// ======================================================
// HELPERS
// ======================================================

function cleanJSON(text: string) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

// SAFE JSON PARSER

function safeParseJSON(
  text: string
) {
  try {
    const cleaned = text
      .replace(
        /[\u0000-\u001F]+/g,
        " "
      )
      .replace(/\n/g, " ")
      .replace(/\r/g, " ")
      .replace(/\t/g, " ")
      .trim();

    return JSON.parse(cleaned);
  } catch (error) {
    console.error(
      "Safe JSON parse failed:",
      error
    );

    console.log(
      "BROKEN JSON:",
      text
    );

    return null;
  }
}

function chunkText(
  text: string,
  chunkSize = 15000
): string[] {
  const chunks: string[] = [];

  for (
    let i = 0;
    i < text.length;
    i += chunkSize
  ) {
    chunks.push(
      text.slice(i, i + chunkSize)
    );
  }

  return chunks;
}

function chunkArray<T>(
  array: T[],
  size: number
): T[][] {
  const chunks: T[][] = [];

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {
    chunks.push(
      array.slice(i, i + size)
    );
  }

  return chunks;
}

// ======================================================
// EXTRACT CLAIMS
// ======================================================

export async function extractClaims(
  text: string
): Promise<string[]> {
  try {
    const chunks = chunkText(text);

    const allClaims: string[] = [];

    for (const chunk of chunks) {
      const response =
        await ai.models.generateContent({
          model: "gemini-2.5-flash",

          contents: `
Extract ALL factual claims from this text.

Focus on:
- dates
- statistics
- historical claims
- scientific claims
- measurable statements
- political claims
- technical claims
- financial claims

Ignore:
- opinions
- greetings
- emotional statements
- vague statements

IMPORTANT:
Return ONLY a JSON array.

Example:
[
  "Google was founded in 1998",
  "The Earth revolves around the Sun"
]

TEXT:
${chunk}
`,

          config: {
            responseMimeType:
              "application/json",

            responseSchema: {
              type: Type.ARRAY,

              items: {
                type: Type.STRING,
              },
            },

            temperature: 0,
          },
        });

      const raw =
        response.text || "[]";

      const cleaned =
        cleanJSON(raw);

      const parsed =
        safeParseJSON(cleaned);

      if (
        parsed &&
        Array.isArray(parsed)
      ) {
        allClaims.push(...parsed);
      }
    }

    return [...new Set(allClaims)];
  } catch (error) {
    console.error(
      "Claim extraction failed:",
      error
    );

    return [];
  }
}

// ======================================================
// VERIFY CLAIMS WITH LIVE STREAMING
// ======================================================

export async function verifyClaimsBatch(
  claims: string[],

  onBatchComplete?: (
    results: FactCheckResult[]
  ) => void
): Promise<FactCheckResult[]> {
  try {
    // SMALLER BATCHES
    // BETTER JSON STABILITY

    const batches = chunkArray(
      claims,
      2
    );

    const allResults: FactCheckResult[] =
      [];

    for (const batch of batches) {
      const response =
        await ai.models.generateContent({
          model: "gemini-2.5-flash",

          contents: `
Fact check these claims using live web search.

Claims:
${batch
  .map(
    (claim, index) =>
      `${index + 1}. ${claim}`
  )
  .join("\n")}

Instructions:
- Search the live internet
- Prefer official sources
- Keep explanations SHORT
- Maximum 2 short sentences
- Maximum 3 sources per claim

Allowed statuses:
- verified
- false
- inaccurate
- unknown

IMPORTANT:
Return ONLY valid JSON array.

Format:
[
  {
    "claim": "Claim text",
    "status": "verified",
    "explanation": "Short reason",
    "confidence": 0.91,
    "sources": [
      {
        "title": "NASA",
        "url": "https://nasa.gov"
      }
    ]
  }
]
`,

          config: {
            tools: [
              {
                googleSearch: {},
              },
            ],

            temperature: 0,
          },
        });

      const raw =
        response.text || "[]";

      const cleaned =
        cleanJSON(raw);

      const match =
        cleaned.match(
          /\[[\s\S]*\]/
        );

      if (!match) {
        console.log(
          "No JSON array found"
        );

        continue;
      }

      const parsed =
        safeParseJSON(
          match[0]
        );

      if (
        !parsed ||
        !Array.isArray(parsed)
      ) {
        continue;
      }

      // ======================================
      // CURRENT BATCH RESULTS
      // ======================================

      const batchResults: FactCheckResult[] =
        [];

      for (const item of parsed) {
        try {
          const validStatuses: ClaimStatus[] =
            [
              "verified",
              "false",
              "inaccurate",
              "unknown",
            ];

          const status: ClaimStatus =
            validStatuses.includes(
              item?.status
            )
              ? item.status
              : "unknown";

          const result: FactCheckResult =
            {
              claim:
                typeof item?.claim ===
                "string"
                  ? item.claim
                  : "Unknown claim",

              originalText:
                typeof item?.claim ===
                "string"
                  ? item.claim
                  : "Unknown claim",

              status,

              explanation:
                typeof item?.explanation ===
                "string"
                  ? item.explanation
                  : "No explanation provided.",

              confidence:
                typeof item?.confidence ===
                "number"
                  ? item.confidence
                  : 0.5,

              sources: Array.isArray(
                item?.sources
              )
                ? item.sources
                    .filter(
                      (
                        source: {
                          title?: string;
                          url?: string;
                        }
                      ) =>
                        source?.url
                    )
                    .slice(0, 3)
                    .map(
                      (
                        source: {
                          title?: string;
                          url?: string;
                        }
                      ) => ({
                        title:
                          source.title ||
                          "Unknown Source",

                        url:
                          source.url ||
                          "",
                      })
                    )
                : [],
            };

          batchResults.push(
            result
          );

          allResults.push(
            result
          );
        } catch (error) {
          console.error(
            "Result parse failed:",
            error
          );
        }
      }

      // ======================================
      // STREAM RESULTS
      // ======================================

      if (
        onBatchComplete
      ) {
        onBatchComplete(
          batchResults
        );
      }
    }

    return allResults;
  } catch (error) {
    console.error(
      "Batch verification failed:",
      error
    );

    return [];
  }
}
