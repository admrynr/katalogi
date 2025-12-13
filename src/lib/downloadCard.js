import * as htmlToImage from "html-to-image";

export async function downloadCard(ref, filename = "reels-card.png") {
  if (!ref?.current) return;

  const dataUrl = await htmlToImage.toPng(ref.current, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
  });

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
