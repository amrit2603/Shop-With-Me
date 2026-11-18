import { useState } from "react";
import { recommendProducts } from "../../utils/recommendProducts";
import { productLink } from "../../utils/savedProducts";
const questions = [
  [
    "budget",
    "Your budget",
    [
      ["any", "Any budget"],
      ["100", "Up to ₹100"],
      ["1000", "Up to ₹1,000"],
    ],
  ],
  [
    "priority",
    "Your priority",
    [
      ["price", "Price"],
      ["quality", "Quality"],
      ["brand", "Brand"],
    ],
  ],
  [
    "mustHave",
    "Your must-have",
    [
      ["any", "No preference"],
      ["category", "Current category"],
      ["feedback", "Positive group feedback"],
    ],
  ],
];
function QuickChoices({ room, currentProductId }) {
  const [answers, setAnswers] = useState({});
  const index = questions.findIndex(([key]) => !answers[key]),
    question = questions[index],
    recommendations =
      index < 0 ? recommendProducts(room, currentProductId, answers) : [];
  return (
    <details className="party-quick-choices">
      <summary>Help me choose</summary>
      <div className="party-help-body">
        {question ? (
          <fieldset className="quick-question">
            <legend>
              {index + 1} of 3 · {question[1]}
            </legend>
            <div className="party-actions">
              {question[2].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() =>
                    setAnswers({ ...answers, [question[0]]: value })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : recommendations.length ? (
          <ol className="quick-recommendations">
            {recommendations.map(({ product, reason }, i) => (
              <li key={product.id}>
                <strong>
                  {i === 0 ? "Top recommendation" : "Alternate"}: {product.name}
                </strong>
                <p>{reason}</p>
                <a href={productLink(room.id, product.id)}>
                  View product details
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p>
            No shortlisted products meet these preferences. Change your answers
            to explore more options.
          </p>
        )}
        {Object.keys(answers).length > 0 && (
          <button onClick={() => setAnswers({})}>Start over</button>
        )}
      </div>
    </details>
  );
}

export default function ShoppingHostPanel({ room, currentProductId, disabled, send, hostNote, onDismiss }) {
  const [query, setQuery] = useState("");
  const [comparisonId, setComparisonId] = useState("");
  const alternatives = room.products.filter(product => product.id !== currentProductId);
  const comparison = alternatives.find(product => product.id === comparisonId) || alternatives[0];
  const current = room.products.find(product => product.id === currentProductId);
  return (
    <details className="party-host" open>
      <summary>Product help</summary>
      <div className="party-help-body">
        <form className="party-question" onSubmit={event => {
          event.preventDefault();
          if (query.trim()) send("host", { action: "question", productId: currentProductId, query: query.trim() });
        }}>
          <label>
            Ask about this product
            <input value={query} onChange={event => setQuery(event.target.value)} required maxLength={300} placeholder="What does it cost?" />
          </label>
          <button disabled={disabled || !query.trim()}>Ask VYUMI</button>
        </form>
        <details className="party-compare-options">
          <summary>Compare with another product</summary>
          {comparison ? <form className="party-compare-form" onSubmit={event => {
            event.preventDefault();
            send("host", { action: "compare", a: currentProductId, b: comparison.id });
          }}>
            <p>Compare {current?.name} with:</p>
            <label>
              Another product
              <select value={comparison.id} onChange={event => setComparisonId(event.target.value)} disabled={disabled}>
                {alternatives.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <button disabled={disabled}>Compare products</button>
          </form> : <p>Add another product to compare.</p>}
        </details>
        {hostNote && hostNote.kind !== "disagreement" && <div className="party-host-note" aria-live="polite">
          <p>{hostNote.text}</p>
          {hostNote.rows && <div className="party-table-wrap"><table aria-label="Product comparison"><tbody>
            {hostNote.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>)}</tr>)}
          </tbody></table></div>}
          <button onClick={onDismiss}>Dismiss answer</button>
        </div>}
        <QuickChoices room={room} currentProductId={currentProductId} />
      </div>
    </details>
  );
}
