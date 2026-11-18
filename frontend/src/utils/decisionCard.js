import { downloadBlob } from './savedProducts';
import { themeValue } from './theme';

export async function downloadDecisionCard(finalChoice) {
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 720;
  const ctx = canvas.getContext('2d');
  await document.fonts.ready;
  const font = themeValue('font-sans');
  ctx.fillStyle = themeValue('bg'); ctx.fillRect(0, 0, 1080, 720);
  ctx.fillStyle = themeValue('accent'); ctx.font = `bold ${themeValue("export-brand")} ${font}`; ctx.fillText('VYUMI / SHOP WITH ME', 64, 84);
  ctx.fillStyle = themeValue('text'); ctx.font = `bold ${themeValue("export-heading")} ${font}`; ctx.fillText('The final choice.', 64, 176);
  ctx.font = `bold ${themeValue("export-product")} ${font}`;
  let y = 268; let line = '';
  for (const word of finalChoice.product.name.split(' ')) {
    if (ctx.measureText(`${line} ${word}`).width > 930) { ctx.fillText(line, 64, y); line = word; y += 48; }
    else line = `${line} ${word}`.trim();
  }
  ctx.fillText(line, 64, y);
  ctx.fillStyle = themeValue('accent'); ctx.font = `${themeValue("export-price")} ${font}`;
  ctx.fillText(finalChoice.product.price == null ? 'Price unknown' : `INR ${finalChoice.product.price}`, 64, y + 64);
  ctx.fillStyle = themeValue('text'); ctx.font = `${themeValue("export-reactions")} ${font}`;
  ctx.fillText(`${finalChoice.breakdown?.Love || 0} Love  /  ${finalChoice.breakdown?.Like || 0} Like`, 64, 560);
  ctx.fillStyle = themeValue('text-muted'); ctx.font = `${themeValue("export-caption")} ${font}`; ctx.fillText('Picked together. Chosen by the host.', 64, 644);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not export the decision. Please retry.');
  downloadBlob(blob, 'vyumi-final-choice.png');
}
