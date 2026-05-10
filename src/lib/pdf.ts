import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractPdfText(
  file: File
): Promise<string> {
  try {
    console.log("STARTING PDF EXTRACTION");

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
    }).promise;

    console.log("PDF loaded");

    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`Reading page ${i}`);

      const page = await pdf.getPage(i);

      const textContent =
        await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) =>
          "str" in item ? item.str : ""
        )
        .join(" ");

      fullText += pageText + "\n";
    }

    if (!fullText.trim()) {
      throw new Error(
        "No readable text found in PDF."
      );
    }

    return fullText;
  } catch (error) {
    console.error(
      "PDF extraction failed:",
      error
    );

    throw error;
  }
}