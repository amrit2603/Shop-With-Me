export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* Use the browser's selection fallback. */
  }
  const focused = document.activeElement;
  const input = document.createElement("textarea");
  input.value = text;
  input.readOnly = true;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    input.remove();
    focused?.focus();
  }
  if (!copied) throw new Error("Copy unavailable. Select the link instead.");
}
