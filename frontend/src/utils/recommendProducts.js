export function recommendProducts(
  room,
  currentProductId,
  { budget, priority, mustHave },
) {
  const current = room.products.find((p) => p.id === currentProductId);
  const positives = (p) =>
    Object.values(room.votes?.[p.id] || {}).filter(
      (v) => v === "Love" || v === "Like",
    ).length;
  return room.products
    .filter(
      (p) =>
        (budget === "any" || (p.price != null && p.price <= Number(budget))) &&
        (mustHave !== "category" || p.category === current?.category) &&
        (mustHave !== "feedback" || positives(p) > 0),
    )
    .sort((a, b) => {
      if (priority === "price")
        return (a.price ?? Infinity) - (b.price ?? Infinity);
      if (priority === "brand")
        return (
          Number(b.brand === current?.brand) -
            Number(a.brand === current?.brand) || positives(b) - positives(a)
        );
      return (
        Number(Boolean(b.description)) - Number(Boolean(a.description)) ||
        positives(b) - positives(a)
      );
    })
    .slice(0, 3)
    .map((product) => ({
      product,
      reason:
        priority === "price"
          ? product.price == null
            ? "Price is unknown; check the source."
            : `Listed price: ₹${product.price}, within your chosen budget.`
          : priority === "brand"
            ? `Listed brand: ${product.brand || "unknown"}; compare the source details.`
            : "Compare the available catalog details; quality is not independently verified.",
    }));
}
