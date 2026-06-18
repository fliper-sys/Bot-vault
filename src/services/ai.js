import { GoogleGenerativeAI } from "@google/generative-ai";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

/**
 * AI Service for solving homework assignments and drafting formatted Word Documents
 */

// Initialize Gemini SDK safely
let genAI = null;
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
} else {
  console.warn("GEMINI_API_KEY environment variable is not defined. AI queries will fail initialization.");
}

/**
 * Solving an academic question with standard explanation
 */
export async function solveAssignment(question) {
  if (!genAI) {
    throw new Error("Gemini AI API is not initialized. Please verify your GEMINI_API_KEY secret.");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `You are an elite academic tutor. Solve the following school homework question with rigorous, step-by-step explanations, clear conceptual breakdowns, and high educational value. Deliver a pristine, detailed response for a student.

Question:
${question}

Adopt an academic tone. Use clear headings where necessary.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error("Gemini solving assignment error:", err);
    throw new Error(`Failed to generate solution: ${err.message}`);
  }
}

/**
 * Generate academic essays and reports
 */
export async function generateDocument({ title, topic, type, author }) {
  if (!genAI) {
    throw new Error("Gemini AI API is not initialized. Please verify your GEMINI_API_KEY secret.");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `You are an elite academic research assistant. Write a comprehensive, fully detailed, reference-supported academic paper.
Title: "${title}"
Topic: "${topic}"
Document Type: "${type}"
Author Name: "${author}"

Your output must be a massive, rich academic writeup of around 800 - 1200 words. Cite realistic, relevant academic journals or books (using standard APA author-date style).

You MUST return only a valid JSON string (no prefixing text) matching this EXACT schema:
{
  "title": "Clean Capitalized Title",
  "subtitle": "Informative academic subtitle of the research",
  "institution": "Department of General Academic Studies, LBtech Academy",
  "introduction": "An exhaustive introductory prose (at least 150-200 words) framing the academic problem, thesis statement, and map of analysis.",
  "sections": [
    {
      "heading": "Heading of Research Section I (e.g. Theoretical framework)",
      "body": "Long detailed academic paragraphs (at least 200 words) with proper citations..."
    },
    {
      "heading": "Heading of Research Section II",
      "body": "Long detailed academic paragraphs (at least 200 words) with proper citations..."
    },
    {
      "heading": "Heading of Research Section III",
      "body": "Long detailed academic paragraphs (at least 200 words) with proper citations..."
    }
  ],
  "conclusion": "A detailed synthesising conclusion paragraph (150 words) summarising major finding points and posturing outlooks.",
  "references": [
    "APA format reference listing string 1",
    "APA format reference listing string 2",
    "APA format reference listing string 3"
  ]
}

Ensure your output is strictly valid JSON format. If you use quotes inside the text, escape them appropriately.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let rawText = response.text().trim();

    // Clean markdown wraps if Gemini wraps the response
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    try {
      const docData = JSON.parse(rawText);
      return docData;
    } catch (parseErr) {
      console.warn("JSON parse failed, attempt fuzzy regex cleanup", parseErr);
      // Fallback clean parsing
      const jsonStart = rawText.indexOf("{");
      const jsonEnd = rawText.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const cleaned = rawText.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(cleaned);
      }
      throw parseErr;
    }
  } catch (err) {
    console.error("Gemini document text generation error:", err);
    throw err;
  }
}

/**
 * Builds a beautiful docx file using standard Times New Roman size 12 and 1.5 line spacing.
 * Compiles a title page, page break, intro, custom headers, conclusion, and reference list.
 */
export async function buildDocxFromData({ title, subtitle, institution, introduction, sections, conclusion, references, author }) {
  // Line spacing factor: docx uses line=240 for 1.0 spacing. 1.5 line spacing = 360.
  // Font sizes: size 24 equals 12pt (docx uses half-points).
  
  const standardParagraphSpacing = { line: 360, after: 180 };
  const standardTextOption = { font: "Times New Roman", size: 24 };

  const children = [];

  // 1. TITLE PAGE (Spacer, Title, Subtitle, Author, Institution, Date)
  for (let i = 0; i < 5; i++) {
    children.push(new Paragraph({ text: "" }));
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          font: "Times New Roman",
          size: 32, // 16pt
        }),
      ],
      spacing: { after: 240 },
    })
  );

  if (subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: subtitle,
            italics: true,
            font: "Times New Roman",
            size: 24, // 12pt
          }),
        ],
        spacing: { after: 480 },
      })
    );
  }

  for (let i = 0; i < 6; i++) {
    children.push(new Paragraph({ text: "" }));
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Prepared By:\n${author || "Graduate Scholar"}\n\n`,
          font: "Times New Roman",
          size: 24,
        }),
      ],
      spacing: { after: 120 },
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: institution || "LBtech Academy",
          font: "Times New Roman",
          size: 24,
        }),
      ],
      spacing: { after: 120 },
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Date: ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`,
          font: "Times New Roman",
          size: 24,
        }),
      ],
    })
  );

  // 2. INTRODUCTION (New Page - pageBreakBefore: true)
  children.push(
    new Paragraph({
      text: "Introduction",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { before: 240, after: 180 },
      children: [
        new TextRun({
          text: "Introduction",
          bold: true,
          font: "Times New Roman",
          size: 28, // 14pt
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFY,
      spacing: standardParagraphSpacing,
      children: [
        new TextRun({
          text: introduction,
          ...standardTextOption,
        }),
      ],
    })
  );

  // 3. BODY SECTIONS
  for (const section of sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: section.heading,
            bold: true,
            font: "Times New Roman",
            size: 26, // 13pt
          }),
        ],
      })
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFY,
        spacing: standardParagraphSpacing,
        children: [
          new TextRun({
            text: section.body,
            ...standardTextOption,
          }),
        ],
      })
    );
  }

  // 4. CONCLUSION
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 180 },
      children: [
        new TextRun({
          text: "Conclusion",
          bold: true,
          font: "Times New Roman",
          size: 28,
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFY,
      spacing: standardParagraphSpacing,
      children: [
        new TextRun({
          text: conclusion,
          ...standardTextOption,
        }),
      ],
    })
  );

  // 5. REFERENCES
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 180 },
      children: [
        new TextRun({
          text: "References (APA Format)",
          bold: true,
          font: "Times New Roman",
          size: 28,
        }),
      ],
    })
  );

  for (const ref of references) {
    children.push(
      new Paragraph({
        indent: { left: 720, hanging: 360 }, // Hanging indent for references
        spacing: { line: 280, after: 120 },
        children: [
          new TextRun({
            text: ref,
            font: "Times New Roman",
            size: 22, // 11pt refs
          }),
        ],
      })
    );
  }

  // Instantiate standard document with the sections
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  // Pack the document to buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
