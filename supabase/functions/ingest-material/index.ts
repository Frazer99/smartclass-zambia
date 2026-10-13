import pdfModule from "npm:pdf-parse@1.1.1";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { generateEmbedding } from "../_shared/embeddings.ts";

type PdfParser = (bytes: Uint8Array) => Promise<{ text?: string }>;
const parsePdf = (typeof pdfModule === "function" ? pdfModule : (pdfModule as any).default) as PdfParser;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
};

type IngestRequest = {
  material_id?: string;
  storage_path?: string | null;
  input_mode?: "pasted_text" | "uploaded_file";
  preview_only?: boolean;
  transcription_only?: boolean;
  confirmed?: boolean;
  reviewed_topics?: Array<{ name: string; reference?: string | null; level?: number; parentIndex?: number | null }>;
  extracted_text?: string | null;
  answer_extracted_text?: string | null;
  answer_storage_path?: string | null;
  solution_video_storage_path?: string | null;
  force_ocr?: boolean;
  file_type?: "pdf" | "image";
  past_paper_id?: string | null;
  subject_id?: string | null;
  topic_id?: string | null;
  grade?: number | null;
  paper_subject_name?: string | null;
  paper_grade?: number | null;
  paper_year?: number | null;
  paper_title?: string | null;
  material_type: "curriculum" | "syllabus" | "past_paper" | "textbook" | "supplementary";
};

type ParsedQuestion = {
  question_number: number;
  question_text: string;
  question_type: "multiple_choice" | "short_answer";
  options: string[] | null;
  answer_key: string;
  explanation: string | null;
  marks: number;
};

type ParsedPaperDetails = {
  title: string;
  subjectName: string | null;
  grade: number | null;
  year: number | null;
  term: string | null;
  source: string;
  totalMarks: number | null;
  durationMinutes: number | null;
};

async function extractSelectableText(bytes: Uint8Array): Promise<string> {
  try {
    const parsed = await parsePdf(bytes);
    return parsed.text?.trim() || "";
  } catch (error) {
    console.error("Selectable PDF text extraction failed; trying OCR:", error);
    return "";
  }
}

function hasUsableExtractedText(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  const letters = (normalized.match(/[A-Za-z]/g) || []).length;
  return normalized.length >= 80 && letters >= 20;
}

function hasReadableMaterialText(text: string): boolean {
  const normalized = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.match(/[A-Za-z]{2,}/g) || [];
  const letters = (normalized.match(/[A-Za-z]/g) || []).length;
  return normalized.length >= 40
    && letters >= 20
    && words.length >= 6
    && letters / Math.max(normalized.length, 1) >= 0.25;
}

function hasEncodedPdfText(text: string): boolean {
  const shifted = text.replace(/[A-Za-z]/g, (character) => {
    const base = character >= "a" && character <= "z" ? 97 : 65;
    return String.fromCharCode(((character.charCodeAt(0) - base - 3 + 26) % 26) + base);
  });
  const decodedWords = ["the", "and", "but", "also", "recording", "other", "means", "without", "prior", "permission", "mathematical", "nurturing"]
    .filter((word) => new RegExp(`\\b${word}\\b`, "i").test(shifted)).length;
  return /\b0[A-Za-z]+/.test(text) || decodedWords >= 3;
}

function decodeEncodedPdfText(text: string): string {
  return text
    .replace(/[A-Za-z]/g, (character) => {
      const base = character >= "a" && character <= "z" ? 97 : 65;
      return String.fromCharCode(((character.charCodeAt(0) - base - 3 + 26) % 26) + base);
    })
    .replace(/\b0(?=[A-Z])/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function extractScannedPdfText(pdfBytes: Uint8Array): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("No readable text was found in this PDF. Automatic OCR is unavailable because OPENAI_API_KEY is not configured for the ingest-material Edge Function.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_OCR_MODEL") || "gpt-4o-mini",
      temperature: 0,
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Transcribe all readable text from this PDF exactly. Preserve page order, headings, question numbers, answer choices, marks, and line breaks. Return only the transcription, with no commentary.",
          },
          {
            type: "input_file",
            filename: "scanned-material.pdf",
            file_data: `data:application/pdf;base64,${base64Encode(pdfBytes)}`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Scanned PDF OCR request failed:", details);
    let reason = "OpenAI rejected the OCR request";
    let errorCode = "";
    try {
      const payload = JSON.parse(details);
      errorCode = payload?.error?.code || "";
      if (payload?.error?.message) reason = payload.error.message;
    } catch {
      // Keep a stable user-facing message when the provider does not return JSON.
    }
    if (response.status === 401 || errorCode === "invalid_api_key") {
      throw new Error("This scanned PDF needs OCR, but the OpenAI API key configured for ingest-material is invalid. Update the Edge Function secret and retry the PDF.");
    }
    if (response.status === 429 || errorCode === "insufficient_quota") {
      throw new Error("This scanned PDF needs OCR, but the OpenAI API account has no remaining credits. Add credits at https://platform.openai.com/settings/organization/billing/ and retry the PDF, or upload a PDF with selectable text.");
    }
    throw new Error(`No readable text was found in this PDF, and automatic OCR failed: ${reason}.`);
  }

  const data = await response.json();
  const text = typeof data.output_text === "string" ? data.output_text.trim() : "";
  if (!text) throw new Error("No readable text was found in this PDF, even after automatic OCR.");
  return text;
}

async function extractImageText(imageBytes: Uint8Array, mimeType: string): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("Image OCR requires OPENAI_API_KEY to be configured for the ingest-material Edge Function.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_OCR_MODEL") || "gpt-4o-mini",
      temperature: 0,
      input: [{ role: "user", content: [
        { type: "input_text", text: "Transcribe all readable text from this image exactly. Preserve headings, question numbers, answer choices, marks, and line breaks. Return only the transcription." },
        { type: "input_image", image_url: `data:${mimeType};base64,${base64Encode(imageBytes)}` },
      ] }],
    }),
  });
  if (!response.ok) throw new Error(`Image OCR failed with status ${response.status}.`);
  const data = await response.json();
  const text = typeof data.output_text === "string" ? data.output_text.trim() : "";
  if (!text) throw new Error("No readable text was found in the uploaded image.");
  return text;
}

type SyllabusTopic = {
  name: string;
  reference: string | null;
  level: number;
  parentIndex: number | null;
};

function syllabusTopics(text: string): SyllabusTopic[] {
  const topics: SyllabusTopic[] = [];
  const seen = new Set<string>();
  const lastAtLevel: number[] = [];

  const lines = text
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const line of lines) {
    // Only accept clearly numbered syllabus headings.
    // Examples: 1. Numbers, 1.2 Integers, 1.2.1 Negative integers
    const match = line.match(
      /^(\d{1,2}(?:\.\d{1,2}){0,4})[.)]?\s+(.+)$/
    );

    if (!match) continue;

    const reference = match[1];
    const name = match[2]
      .replace(/^[-•*]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();

    const level = reference.split(".").length - 1;
    const words = name.split(/\s+/);

    // Reject fragments, long paragraphs, and likely extraction noise.
    if (name.length < 5 || name.length > 90) continue;
    if (words.length < 2 || words.length > 12) continue;
    if (!/[A-Za-z]/.test(name)) continue;
    if (!/[aeiou]/i.test(name)) continue;
    if (/^(page|form|grade|chapter|unit|contents)\b/i.test(name)) continue;
    if (/^[A-Z\s]+$/.test(name) && words.length < 2) continue;

    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) continue;

    seen.add(key);

    const parentIndex =
      level > 0 ? (lastAtLevel[level - 1] ?? null) : null;

    topics.push({ name, reference, level, parentIndex });

    lastAtLevel[level] = topics.length - 1;
    lastAtLevel.length = level + 1;

    if (topics.length >= 150) break;
  }

  return topics;
}

function normalizedTopicName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function validateReviewedTopics(topics: IngestRequest["reviewed_topics"]): string | null {
  if (!topics?.length) return "The confirmed import must include the reviewed topic list.";
  const names = new Set<string>();
  for (let index = 0; index < topics.length; index++) {
    const name = topics[index]?.name?.replace(/\s+/g, " ").trim() || "";
    if (name.length < 2 || name.length > 160) return `Reviewed topic ${index + 1} has an invalid name.`;
    const key = normalizedTopicName(name);
    if (names.has(key)) return `Reviewed topics contain a duplicate name: ${name}`;
    names.add(key);
    const parentIndex = topics[index]?.parentIndex;
    if (parentIndex !== null && parentIndex !== undefined && (!Number.isInteger(parentIndex) || parentIndex < 0 || parentIndex >= index)) {
      return `Reviewed topic ${name} has an invalid parent relationship.`;
    }
  }
  return null;
}

function parsePastPaperQuestions(text: string): ParsedQuestion[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const starts = lines
    .map((line, index) => ({ line, index, match: line.match(/^(\d{1,3})[.)]\s+(.*)$/) }))
    .filter((item) => item.match);
  const questions: ParsedQuestion[] = [];

  for (let position = 0; position < starts.length; position++) {
    const current = starts[position];
    const next = starts[position + 1];
    const number = Number(current.match?.[1]);
    const section = [current.match?.[2] || "", ...lines.slice(current.index + 1, next?.index ?? lines.length)].join(" ").trim();
    if (!Number.isInteger(number) || !section || section.length > 12000) continue;

    const optionMatches = [...section.matchAll(/(?:^|\s)([A-D])\s*[).:-]\s*([^]+?)(?=\s+[A-D]\s*[).:-]\s*|$)/gi)];
    const options = optionMatches.length >= 2 ? optionMatches.map((match) => `${match[1].toUpperCase()}. ${match[2].trim()}`) : null;
    const questionText = (options ? section.slice(0, optionMatches[0].index).trim() : section)
      .replace(/\s*\((\d+)\s*marks?\)\s*$/i, "")
      .trim();
    const marksMatch = section.match(/\((\d+)\s*marks?\)\s*$/i);

    questions.push({
      question_number: number,
      question_text: questionText,
      question_type: options ? "multiple_choice" : "short_answer",
      options,
      answer_key: "",
      explanation: null,
      marks: marksMatch ? Number(marksMatch[1]) : 1,
    });
  }

  return questions
    .filter((question, index, all) => index === all.findIndex((candidate) => candidate.question_number === question.question_number))
    .slice(0, 200);
}

function parsePastPaperAnswers(text: string): Map<number, { answer_key: string; explanation: string }> {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const starts = lines
    .map((line, index) => ({ line, index, match: line.match(/^(?:question\s*)?(\d{1,3})[.)\s:-]+(.*)$/i) }))
    .filter((item) => item.match);
  const answers = new Map<number, { answer_key: string; explanation: string }>();

  for (let position = 0; position < starts.length; position++) {
    const current = starts[position];
    const next = starts[position + 1];
    const number = Number(current.match?.[1]);
    const section = [current.match?.[2] || "", ...lines.slice(current.index + 1, next?.index ?? lines.length)].join(" ").trim();
    if (!Number.isInteger(number) || !section) continue;
    const answerKey = section.split(/\s*[;|]\s*|\s+-\s+/)[0].trim();
    answers.set(number, { answer_key: answerKey, explanation: section });
  }
  return answers;
}

function parsePastPaperDetails(text: string, fileName: string, subjectNames: string[]): ParsedPaperDetails {
  const header = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 80).join(" ");
  const firstLines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 20);
  const fileLabel = fileName.split(/[\\/]/).pop() || fileName;
  const fileAndHeader = `${header} ${fileLabel}`;
  const year = Number((fileAndHeader.match(/\b(19\d{2}|20\d{2})\b/) || [])[1]) || null;
  const formMatch = fileAndHeader.match(/(?:form|grade|class|level|std|standard)[\s._:-]*(?:\d+\s*[-/]\s*)?(\d{1,2})/i)
    || fileAndHeader.match(/\b(?:f|g)\s*(\d{1,2})\b/i);
  const detectedGrade = formMatch?.[1] ? Number(formMatch[1]) : null;
  const grade = detectedGrade !== null && detectedGrade >= 1 && detectedGrade <= 12
    ? detectedGrade
    : null;
  const term = header.match(/\b(term\s*[1-3])\b/i)?.[1] || null;
  const totalMarks = Number((header.match(/(?:total\s+)?marks?\s*[:=-]?\s*(\d{1,4})/i) || [])[1]) || null;
  const durationMinutes = Number((header.match(/(?:duration|time|allowed)\s*(?:allowed)?\s*[:=-]?\s*(\d{1,3})\s*(?:minutes?|mins?|hours?)/i) || [])[1]) || null;
  const subjectName = subjectNames
    .slice()
    .sort((left, right) => right.length - left.length)
    .find((subject) => new RegExp(`(?:^|[^A-Za-z])${subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^A-Za-z])`, "i").test(fileAndHeader)) || null;
  const title = firstLines.find((line) => /paper|examination|exam|assessment/i.test(line)) || fileLabel.replace(/\.pdf$/i, "");
  const source = /ecz|examinations council/i.test(header) ? "ECZ" : "Uploaded past paper";

  return { title, subjectName, grade, year, term, source, totalMarks, durationMinutes };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return response({ error: "Missing Supabase Edge Function secrets" }, 500);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return response({ error: "Authorization required" }, 401);
    const { data: userData, error: authError } = await adminClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (authError || !userData.user) return response({ error: "Invalid token" }, 401);

    const { data: profile } = await adminClient.from("profiles").select("role, teacher_approved").eq("id", userData.user.id).maybeSingle();
    const canIngest = profile?.role === "admin" || (profile?.role === "teacher" && profile?.teacher_approved === true);
    if (!canIngest) return response({ error: "Admin or approved teacher access required" }, 403);

    const body = await req.json() as IngestRequest;
    const pastedText = body.extracted_text?.trim() || "";
    const isSyllabus = body.material_type === "curriculum" || body.material_type === "syllabus";
    // Keep older deployed admin pages compatible during a rolling frontend/backend update.
    const inputMode = body.input_mode || (body.storage_path ? "uploaded_file" : pastedText ? "pasted_text" : null);
    if (!inputMode || !["pasted_text", "uploaded_file"].includes(inputMode)) {
      return response({ error: "input_mode must be pasted_text or uploaded_file" }, 400);
    }
    if (inputMode === "pasted_text" && !pastedText) return response({ error: "Pasted text is required for pasted_text input" }, 400);
    if (inputMode === "uploaded_file" && !body.storage_path && !body.preview_only) return response({ error: "Uploaded file storage_path is required" }, 400);
    if (body.preview_only) {
      if (!pastedText) return response({ error: "Paste syllabus text before previewing." }, 400);
      if (!isSyllabus) {
        return response({ error: "Preview is only available for syllabus material." }, 400);
      }
      const previewTopics = syllabusTopics(pastedText);
      return response({
        success: true,
        extracted_characters: pastedText.length,
        topics: previewTopics,
      });
    }
    if (!body.material_id) return response({ error: "material_id is required" }, 400);
    if (isSyllabus && !body.transcription_only && !body.confirmed) return response({ error: "Syllabus import requires explicit confirmation." }, 400);
    if (isSyllabus && !body.transcription_only) {
      const reviewedTopicError = validateReviewedTopics(body.reviewed_topics);
      if (reviewedTopicError) return response({ error: reviewedTopicError }, 400);
    }
    if (!body.storage_path && !pastedText) return response({ error: "A stored file or extracted text is required" }, 400);

    const { data: materialRecord, error: materialLookupError } = await adminClient
      .from("content_materials")
      .select("subject_id, grade, material_type")
      .eq("id", body.material_id)
      .maybeSingle();
    if (materialLookupError) throw materialLookupError;
    if (!materialRecord) throw new Error("Uploaded material record was not found.");
    if (materialRecord.material_type !== body.material_type) throw new Error("Material type does not match the material record.");
    const subjectId = materialRecord.subject_id || body.subject_id;
    const materialGrade = materialRecord.grade || body.grade;

    let extractedText = pastedText;
    if (!extractedText) {
      const { data: file, error: downloadError } = await adminClient.storage.from("content-materials").download(body.storage_path!);
      if (downloadError || !file) throw new Error(downloadError?.message || "Could not download uploaded PDF");

      const pdfBytes = new Uint8Array(await file.arrayBuffer());
      const mimeType = file.type || (body.file_type === "image" ? "image/png" : "application/pdf");
      extractedText = body.file_type === "image"
        ? await extractImageText(pdfBytes, mimeType)
        : await extractSelectableText(pdfBytes);
      if (hasEncodedPdfText(extractedText)) {
        // Do not blindly decode potentially corrupted PDF font mappings.
        extractedText = await extractScannedPdfText(pdfBytes);
      } else if (
        body.force_ocr ||
        !hasUsableExtractedText(extractedText) ||
        !hasReadableMaterialText(extractedText)
      ) {
        extractedText = await extractScannedPdfText(pdfBytes);
      }
    }

    if (!hasReadableMaterialText(extractedText)) {
      throw new Error(
        "The extracted text failed readability checks. " +
        "No syllabus topics should be generated until the PDF text is corrected."
      );
    }

    let answerText = body.answer_extracted_text?.trim() || "";
    if (body.answer_storage_path) {
      const { data: answerFile, error: answerDownloadError } = await adminClient.storage.from("content-materials").download(body.answer_storage_path);
      if (answerDownloadError || !answerFile) throw new Error(answerDownloadError?.message || "Could not download uploaded answer PDF");
      const answerBytes = new Uint8Array(await answerFile.arrayBuffer());
      answerText = await extractSelectableText(answerBytes);
      if (!hasUsableExtractedText(answerText)) answerText = await extractScannedPdfText(answerBytes);
    }

    const summary = extractedText.slice(0, 4000);
    let embedding: number[] | null = null;
    if (!isSyllabus || body.transcription_only) {
      const { error: materialError } = await adminClient.from("content_materials").update({
        storage_path: body.storage_path || null,
        topic_id: body.topic_id || null,
        extracted_text: extractedText,
        content_summary: summary,
        status: "ingested",
        ingestion_error: null,
      }).eq("id", body.material_id);
      if (materialError) throw materialError;
      embedding = await generateEmbedding(extractedText);
      if (embedding) {
        const { error: embeddingError } = await adminClient.from("content_materials").update({ embedding }).eq("id", body.material_id);
        if (embeddingError) throw embeddingError;
      }
    }

    let questionsCreated = 0;
    let createdPastPaperId = body.past_paper_id || null;
    if (body.material_type === "past_paper") {
      const { data: subjectRows, error: subjectsError } = await adminClient.from("subjects").select("id, name");
      if (subjectsError) throw subjectsError;
      const details = parsePastPaperDetails(extractedText, body.storage_path, (subjectRows || []).map((subject) => subject.name));
      if (body.paper_subject_name?.trim()) details.subjectName = body.paper_subject_name.trim();
      if (body.paper_grade) details.grade = Number(body.paper_grade);
      if (body.paper_year) details.year = Number(body.paper_year);
      if (body.paper_title?.trim()) details.title = body.paper_title.trim();
      if (!details.subjectName || !details.grade || !details.year) {
        const missing = [
          !details.subjectName ? "subject" : null,
          !details.grade ? "Form or Grade" : null,
          !details.year ? "year" : null,
        ].filter(Boolean).join(", ");
        throw new Error(`Could not identify ${missing} from the PDF. Include those details in the paper header or filename.`);
      }
      const { data: subject } = await adminClient.from("subjects").select("id").ilike("name", details.subjectName).maybeSingle();
      if (!subject?.id) throw new Error(`Could not identify the subject from the paper. Detected: ${details.subjectName}`);
      const form = details.grade > 6 ? details.grade - 7 : details.grade;
      const { error: paperMaterialError } = await adminClient.from("content_materials").update({
        subject_id: subject.id,
        grade: form,
      }).eq("id", body.material_id);
      if (paperMaterialError) throw paperMaterialError;

      let duplicateQuery = adminClient
        .from("past_papers")
        .select("id, title")
        .eq("subject_id", subject.id)
        .eq("grade", details.grade)
        .eq("year", details.year)
        .ilike("title", details.title)
        .limit(1);
      duplicateQuery = details.term ? duplicateQuery.eq("term", details.term) : duplicateQuery.is("term", null);
      if (createdPastPaperId) duplicateQuery = duplicateQuery.neq("id", createdPastPaperId);
      const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) {
        const error = new Error(`Past paper already exists: ${duplicate.title}`);
        (error as Error & { code?: string }).code = "DUPLICATE_PAST_PAPER";
        throw error;
      }

      if (!createdPastPaperId) {
        const { data: paper, error: paperError } = await adminClient.from("past_papers").insert({
          subject_id: subject.id,
          grade: details.grade,
          year: details.year,
          term: details.term,
          title: details.title,
          total_marks: details.totalMarks,
          duration_minutes: details.durationMinutes,
          source: details.source,
          source_material_id: body.material_id,
          answer_storage_path: body.answer_storage_path || null,
          solution_video_storage_path: body.solution_video_storage_path || null,
        }).select("id").single();
        if (paperError || !paper) throw new Error(paperError?.message || "Could not create past-paper record");
        createdPastPaperId = paper.id;
      } else {
        const { error: updateError } = await adminClient.from("past_papers").update({
          subject_id: subject.id,
          grade: details.grade,
          year: details.year,
          term: details.term,
          title: details.title,
          total_marks: details.totalMarks,
          duration_minutes: details.durationMinutes,
          source: details.source,
          source_material_id: body.material_id,
          answer_storage_path: body.answer_storage_path || null,
          solution_video_storage_path: body.solution_video_storage_path || null,
        }).eq("id", createdPastPaperId);
        if (updateError) throw updateError;
      }
      const parsedQuestions = parsePastPaperQuestions(extractedText);
      await adminClient.from("past_paper_questions").delete().eq("past_paper_id", createdPastPaperId);
      for (const question of parsedQuestions) {
        const { error } = await adminClient.from("past_paper_questions").insert({
          past_paper_id: createdPastPaperId,
          ...question,
        });
        if (!error) questionsCreated++;
      }
      if (answerText) {
        const answers = parsePastPaperAnswers(answerText);
        for (const [questionNumber, answer] of answers) {
          await adminClient.from("past_paper_questions")
            .update({ answer_key: answer.answer_key, explanation: answer.explanation })
            .eq("past_paper_id", createdPastPaperId)
            .eq("question_number", questionNumber);
        }
      }
      const { data: questionsWithAnswers } = await adminClient
        .from("past_paper_questions")
        .select("id, question_text, explanation")
        .eq("past_paper_id", createdPastPaperId)
        .not("explanation", "is", null);
      for (const question of questionsWithAnswers || []) {
        const questionEmbedding = await generateEmbedding(`${question.question_text}. ${question.explanation || ""}`);
        if (questionEmbedding) {
          await adminClient.from("past_paper_questions").update({ embedding: questionEmbedding }).eq("id", question.id);
        }
      }
    }

    let topicsCreated = 0;
    if (isSyllabus && !body.transcription_only) {
      if (!subjectId || !materialGrade) throw new Error("A syllabus must have a subject and Form before topics can be generated.");
      const reviewedTopics = body.reviewed_topics!;
      const { data: importResult, error: importError } = await adminClient.rpc("import_reviewed_syllabus", {
        p_material_id: body.material_id,
        p_subject_id: subjectId,
        p_grade: materialGrade,
        p_actor_id: userData.user.id,
        p_storage_path: body.storage_path || null,
        p_extracted_text: extractedText,
        p_content_summary: summary,
        p_topics: reviewedTopics,
        p_confirmed: body.confirmed === true,
      });
      if (importError) throw importError;
      topicsCreated = Number(importResult?.topics_created || 0);
      embedding = await generateEmbedding(extractedText);
      if (embedding) {
        const { error: embeddingError } = await adminClient.from("content_materials").update({ embedding }).eq("id", body.material_id);
        if (embeddingError) console.error("Syllabus embedding update failed; keyword retrieval remains available:", embeddingError);
      }
    }

    return response({ success: true, extracted_characters: extractedText.length, embedding_created: Boolean(embedding), topics_created: topicsCreated, questions_created: questionsCreated, past_paper_id: createdPastPaperId });
  } catch (error) {
    console.error("Material ingestion error:", error);
    const message = error instanceof Error ? error.message : "Material ingestion failed";
    try {
      const body = await req.clone().json() as Partial<IngestRequest>;
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (body.material_id && supabaseUrl && serviceRoleKey) {
        await createClient(supabaseUrl, serviceRoleKey)
          .from("content_materials")
          .update({ storage_path: body.storage_path || null, status: "failed", ingestion_error: message })
          .eq("id", body.material_id)
          .neq("status", "ingested");
      }
    } catch {
      // Preserve the original ingestion error if diagnostic persistence fails.
    }
    const status = (error as { code?: string })?.code === "DUPLICATE_PAST_PAPER" ? 409 : 500;
    return response({ error: message }, status);
  }
});
