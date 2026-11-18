const { generateJson, SUMMARY_SCHEMA } = require('./llmGateway');

async function generateAiSummary(room, summary, gateway = generateJson) {
  if (!process.env.OLLAMA_URL || !summary || !Array.isArray(summary.rankings)) return null;
  const byProduct = room.comments || {};
  const input = {
    totalParticipants: summary.totalParticipants,
    options: summary.rankings.map((item, index) => ({
      position: index + 1,
      voteCounts: item.breakdown,
      comments: (byProduct[item.product.id] || []).map((comment) => comment.text),
    })),
  };
  const prompt = `Write one concise paragraph and up to 3 short reasons from this supplied vote-count and comment data. Do not recalculate counts, name or identify products, invent product facts, or claim certainty when the counts or comments do not support it. Refer only to option positions. Return only JSON matching the requested schema.\n${JSON.stringify(input)}`;
  try {
    const result = await gateway(prompt, SUMMARY_SCHEMA);
    if (!result) return null;
    return { paragraph: result.paragraph, topReasons: result.topReasons, label: 'AI-generated summary' };
  } catch {
    return null;
  }
}

module.exports = { generateAiSummary };
