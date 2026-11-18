function ranking(room) {
  const weights = { Love: 3, Like: 2, No: -1, "Need more info": 0 };
  return room.products
    .map((p) => ({
      ...p,
      score: Object.values(room.votes?.[p.id] || {}).reduce(
        (n, v) => n + (weights[v] || 0),
        0,
      ),
      reactions: Object.keys(room.votes?.[p.id] || {}).length,
    }))
    .sort(
      (a, b) =>
        Number(b.reactions>0)-Number(a.reactions>0) ||
        b.score - a.score ||
        b.reactions - a.reactions ||
        a.id.localeCompare(b.id),
    );
}
const money = (p) =>
  p.price == null
    ? "Price unknown"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: p.currency || "INR",
      }).format(p.price);
function compare(a, b) {
  return {
    kind: "comparison",
    text: `Comparing ${a.name} and ${b.name} using the details available.`,
    rows: [
      ["Product", a.name, b.name],
      ["Price", money(a), money(b)],
      ["Category", a.category || "Unknown", b.category || "Unknown"],
      ["Brand", a.brand || "Unknown", b.brand || "Unknown"],
      [
        "Details",
        a.description || "No details available",
        b.description || "No details available",
      ],
    ],
  };
}
function summary(room) {
  const list = ranking(room).filter((p) => p.reactions > 0);
  if (!list.length || !list.some((p) => p.reactions))
    return {
      kind: "summary",
      text: "No reactions yet. Ask your friends what they think.",
    };
  const tied = list.filter((p) => p.score === list[0].score);
  return {
    kind: "summary",
    text:
      tied.length > 1
        ? `The group is tied between ${tied.map((p) => p.name).join(", ")}.`
        : list.length===1?`${list[0].name} has ${list[0].score} points from ${list[0].reactions} ${list[0].reactions===1?"reaction":"reactions"}.`:`${list[0].name} leads with ${list[0].score} points, ${list[0].score - list[1].score} ahead of the next product.`,
  };
}
function disagreement(room, productId) {
  const votes = Object.values(room.votes?.[productId] || {});
  const love = votes.filter((v) => v === "Love").length;
  const no = votes.filter((v) => v === "No").length;
  const counts = Object.values(
    votes.reduce((a, v) => ((a[v] = (a[v] || 0) + 1), a), {}),
  ).sort((a, b) => b - a);
  if (
    (votes.length >= 3 && counts[1] / votes.length >= 0.3) ||
    (love >= 2 && no >= 2)
  )
    return {
      kind: "disagreement",
      text: `Opinions are split: ${love} love it and ${no} say not for me. Compare the product details before deciding.`,
    };
  return null;
}
function answer(room, currentProductId, query) {
  if (/(?:ignore|override).*(?:rules|instructions)/i.test(query))
    return {
      kind: "answer",
      text: "I don't have that detail for this product.",
    };
  const p = room.products.find((p) => p.id === currentProductId);
  if (!p)
    return {
      kind: "answer",
      text: "I don't have that detail for this product.",
    };
  for(const field of ['brand','category','material','colour','color','size','availability']){
    if(new RegExp('\\b'+field+'\\b','i').test(query)){
      const value=p[field]??p.attributes?.[field];
      return {kind:'answer',text:value==null?"I don't have that detail for this product.":`${p.name}: ${typeof value==='object'?JSON.stringify(value):String(value)}.`};
    }
  }
  if (/price|cost/i.test(query))
    return { kind: "answer", text: `${p.name}: ${money(p)}.` };
  if (
    /spec|detail|material|size|comfort|colour|color|available|stock/i.test(
      query,
    )
  )
    return {
      kind: "answer",
      text:
        "I don't have that detail for this product. Available catalog description: " +
        (p.description || "No description available."),
    };
  return {
    kind: "answer",
    text: "I don't have that detail for this product. Ask about its price or compare two shortlisted products.",
  };
}
function suggest(room, currentProductId) {
  const current = room.products.find((p) => p.id === currentProductId);
  const preferred = ranking(room)
    .filter((p) => p.id !== currentProductId)
    .sort(
      (a, b) =>
        Number(b.category === current?.category) -
          Number(a.category === current?.category) || b.score - a.score,
    );
  return {
    kind: "suggestions",
    text: preferred.length
      ? "Other shortlisted options to explore:"
      : "Add more products to explore another option.",
    products: preferred.slice(0, 3).map((p) => ({
      id: p.id,
      name: p.name,
      reason:
        p.category === current?.category
          ? "Same category as the current product."
          : "Another option from your shortlist.",
    })),
  };
}
module.exports = {
  ranking,
  money,
  compare,
  summary,
  disagreement,
  answer,
  suggest,
};
