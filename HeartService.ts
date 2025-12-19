// services/HeartService.ts
import type { HeartAnalysisResult, ChatMessage } from "../types";

// Qwen API endpoint
const QWEN_API_URL = "https://api.qwen.ai/v1/chat/completions";
const API_KEY = process.env.REACT_APP_QWEN_API_KEY;

// Helper: call Qwen API
async function callQwenAPI(prompt: string, history?: ChatMessage[]): Promise<string> {
  const messages = [
    { role: "system", content: "तपाईं एक सहानुभूतिपूर्ण, गहिरो, मनोवैज्ञानिक विशेषज्ञ हुनुहुन्छ जसले प्रयोगकर्ताको हृदय पढ्छ।" },
    ...(history?.map(h => ({
      role: h.role === "user" ? "user" : "assistant",
      content: h.text
    })) || []),
    { role: "user", content: prompt }
  ];

  const response = await fetch(QWEN_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "qwen-7b-chat", // or qwen-7b for smaller
      messages,
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "म मौन छु...";
}

// Analyze heart content
export const analyzeHeartContent = async (
  text: string,
  imageBase64?: string,
  audioBase64?: string
): Promise<HeartAnalysisResult> => {
  // Convert image/audio to textual description for Qwen
  let extraDescription = "";
  if (imageBase64) extraDescription += "उपयोगकर्ताले अपलोड गरेको तस्बिरमा भावनात्मक संकेतहरू छन्। ";
  if (audioBase64) extraDescription += "उपयोगकर्ताको आवाजमा टोन, स्पन्दन, र भावनाहरूको संकेत छ। ";

  const prompt = `
  निम्न विवरणको आधारमा प्रयोगकर्ताको हृदयको अवस्था विश्लेषण गर्नुहोस्:
  Text: "${text}"
  ${extraDescription}

  कृपया विश्लेषण निम्न कुरामा समावेश गर्नुहोस्:
  1. Summary: 2-3 वाक्यहरूमा प्रयोगकर्ताको भावनात्मक अवस्था
  2. Dominant emotion: प्रमुख भावना
  3. Emotions: 4-6 प्रमुख भावनाहरूको सूची (label, score 0-100, color)
  4. Hidden desire: अन्तर्निहित चाहना
  5. Guidance: कोमल, प्रतीकात्मक सुझाव
  6. Spirit archetype: प्रयोगकर्ताको वर्तमान मानसिक अवस्था
  7. Healing gemstone: ऊर्जा सन्तुलनका लागि उपयुक्त रत्न
  8. Soul poem: 4 पंक्तिहरूको लघु कविता

  सबै उत्तरहरू **नेपाली भाषामा** दिनुहोस्। JSON फर्म्याटमा दिनुहोस्।
  `;

  const resultText = await callQwenAPI(prompt);

  try {
    return JSON.parse(resultText) as HeartAnalysisResult;
  } catch (e) {
    console.error("Parsing Qwen response failed:", e, resultText);
    throw new Error("विश्लेषण JSON मा परिणत गर्न सकेन।");
  }
};

// Chat with heart
export const chatWithHeart = async (
  history: ChatMessage[],
  currentAnalysis: HeartAnalysisResult,
  newMessage: string
): Promise<string> => {
  const prompt = `
तपाईं प्रयोगकर्ताको हृदयको प्रतिमूर्ति हुनुहुन्छ। 
तपाईंले निम्न विश्लेषण गर्नु भएको छ:
- Summary: ${currentAnalysis.summary}
- Dominant Emotion: ${currentAnalysis.dominant_emotion}
- Hidden Desire: ${currentAnalysis.hidden_desire}
- Guidance: ${currentAnalysis.guidance}

प्रयोगकर्तासँग कोमल, प्रतीकात्मक, र गहिरो संवाद गर्नुहोस्। उत्तर छोटो (३-४ वाक्य) र नेपाली भाषामा दिनुहोस्। 

प्रयोगकर्ताको नयाँ सन्देश: "${newMessage}"
`;

  return callQwenAPI(prompt, history);
};
