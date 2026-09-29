import pdf from "npm:pdf-parse@1.1.1";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { generateEmbedding } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
};

type IngestRequest = {
  material_id: string;
  storage_path: string;
  extracted_text?: string | null;
  answer_extracted_text?: string | null;
  answer_storage_path?: string | null;
  past_paper_id?: string | null;
  subject_id?: string | null;
  grade?: number | null;
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

type SyllabusTopic = { name: string; reference: string | null; level: number; parentIndex: number | null };

function syllabusTopics(text: string): SyllabusTopic[] {
  const topics: SyllabusTopic[] = [];
  const lastAtLevel: number[] = [];
  const candidates = text
    .split(/\r?\n/)
    .map((line) => {
      const cleaned = line.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
      const numbered = cleaned.match(/^(\d+(?:\.\d+)*)[.)]?\s+(.+)$/);
      return {
        raw: cleaned,
        reference: numbered?.[1] || null,
        name: numbered?.[2]?.trim() || cleaned,
        level: numbered ? numbered[1].split(".").length - 1 : 0,
      };
    })
    .filter((line) => line.name.length >= 4 && line.name.length <= 100)
    .filter((line) => !/^page\s+\d+/i.test(line.raw))
    .filter((line) => !/^(contents|table of contents|introduction|references|appendix)$/i.test(line.name))
    .map((line) => ({ ...line, name: line.name.replace(/^[-•*]\s+/, "").trim() }))
    .filter((line) => /^[A-Za-z][A-Za-z0-9 &'(),:/-]*$/.test(line.name))
    .filter((line) => {
      const words = line.name.split(/\s+/);
      const titleCase = words.filter((word) => /^[A-Z][A-Za-z'-]*$/.test(word)).length;
      return words.length <= 12 && (titleCase >= Math.max(1, Math.ceil(words.length / 2)) || /^[A-Z0-9][A-Z0-9 &'(),:/-]+$/.test(line.name));
    });

  for (const candidate of candidates) {
    if (/^(form|grade|chapter|unit)\s+\d+$/i.test(candidate.name)) continue;
    if (topics.some((topic) => topic.name.toLowerCase() === candidate.name.toLowerCase())) continue;
    const parentIndex = candidate.level > 0 ? (lastAtLevel[candidate.level - 1] ?? null) : null;
    topics.push({ name: candidate.name, reference: candidate.reference, level: candidate.level, parentIndex });
    lastAtLevel[candidate.level] = topics.length - 1;
    lastAtLevel.length = candidate.level + 1;
  }
  return topics.slice(0, 150);
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

  return questions.filter((question, index, all) => index === all.findIndex((candidate) => candidate.question_number === question.question_number)).slice(0, 200);
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
  const fileAndHeader = `${header} ${fileName}`;
  const year = Number((fileAndHeader.match(/\b(19\d{2}|20\d{2})\b/) || [])[1]) || null;
  const formMatch = fileAndHeader.match(/(?:form|grade|class|level)\s*(?:\.|:|-)?\s*(?:\d+\s*[-/]\s*)?(\d{1,2})/i)
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
    .find((subject) => new RegExp(`(?:^|[^A-Za-z])${subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^A-Za-z])`, "i").test(header)) || null;
  const title = firstLines.find((line) => /paper|examination|exam|assessment/i.test(line)) || fileName.replace(/\.pdf$/i, "");
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

    const { data: profile } = await adminClient.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (profile?.role !== "admin") return response({ error: "Admin access required" }, 403);

    const body = await req.json() as IngestRequest;
    if (!body.material_id || !body.storage_path) return response({ error: "material_id and storage_path are required" }, 400);

    const { data: file, error: downloadError } = await adminClient.storage.from("content-materials").download(body.storage_path);
    if (downloadError || !file) throw new Error(downloadError?.message || "Could not download uploaded PDF");

    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await pdf(pdfBytes);
    let extractedText = body.extracted_text?.trim() || parsed.text.trim();
    if (!extractedText) extractedText = await extractScannedPdfText(pdfBytes);

    let answerText = body.answer_extracted_text?.trim() || "";
    if (body.answer_storage_path) {
      const { data: answerFile, error: answerDownloadError } = await adminClient.storage.from("content-materials").download(body.answer_storage_path);
      if (answerDownloadError || !answerFile) throw new Error(answerDownloadError?.message || "Could not download uploaded answer PDF");
      const answerBytes = new Uint8Array(await answerFile.arrayBuffer());
      const parsedAnswers = await pdf(answerBytes);
      answerText = parsedAnswers.text.trim() || await extractScannedPdfText(answerBytes);
    }

    const summary = extractedText.slice(0, 4000);
    const { error: materialError } = await adminClient.from("content_materials").update({
      storage_path: body.storage_path,
      extracted_text: extractedText,
      content_summary: summary,
      status: "ingested",
      ingestion_error: null,
    }).eq("id", body.material_id);
    if (materialError) throw materialError;

    const embedding = await generateEmbedding(extractedText);
    if (embedding) {
      const { error: embeddingError } = await adminClient.from("content_materials").update({ embedding }).eq("id", body.material_id);
      if (embeddingError) throw embeddingError;
    }

    let questionsCreated = 0;
    let createdPastPaperId = body.past_paper_id || null;
    if (body.material_type === "past_paper") {
      const { data: subjectRows, error: subjectsError } = await adminClient.from("subjects").select("id, name");
      if (subjectsError) throw subjectsError;
      const details = parsePastPaperDetails(extractedText, body.storage_path, (subjectRows || []).map((subject) => subject.name));
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
    }

    let topicsCreated = 0;
    if (body.material_type === "curriculum" || body.material_type === "syllabus") {
      const topics = syllabusTopics(extractedText);
      if (!body.subject_id || !body.grade) throw new Error("A syllabus must have a subject and Form before topics can be generated.");

      // The uploaded syllabus is the source of truth for this subject/Form.
      // Replacing the scoped set also removes lessons and questions attached
      // to obsolete seeded topics through the database foreign keys.
      const { error: deleteError } = await adminClient.from("topics")
        .delete()
        .eq("subject_id", body.subject_id)
        .eq("grade", body.grade);
      if (deleteError) throw deleteError;

      const insertedTopics: { id: string }[] = [];
      for (const topic of topics) {
        const { data: inserted, error } = await adminClient.from("topics").insert({
          subject_id: body.subject_id || null,
          grade: body.grade || 1,
          name: topic.name,
          category: topic.level > 0 ? "Subtopic" : "Topic",
          syllabus_reference: topic.reference || body.storage_path,
          description: `Derived from uploaded syllabus: ${topic.name}`,
          display_order: topicsCreated,
          source_material_id: body.material_id,
        }).select("id").single();
        if (error || !inserted) throw error || new Error(`Could not create syllabus topic: ${topic.name}`);
        insertedTopics.push(inserted);
        topicsCreated++;
      }

      for (let index = 0; index < topics.length; index++) {
        const parentIndex = topics[index].parentIndex;
        if (parentIndex === null) continue;
        const { error } = await adminClient.from("topics")
          .update({ parent_topic_id: insertedTopics[parentIndex].id })
          .eq("id", insertedTopics[index].id);
        if (error) throw error;
      }

      // Give every syllabus topic an immediately usable lesson. The lesson
      // stays deliberately grounded in the topic name; the AI teacher uses
      // the embedded syllabus material above to supply the actual teaching
      // explanation and examples for the pupil's question.
      for (let index = 0; index < topics.length; index++) {
        const topic = topics[index];
        const { error } = await adminClient.from("lessons").insert({
          topic_id: insertedTopics[index].id,
          title: `Understanding ${topic.name}`,
          difficulty: "standard",
          display_order: 0,
          content: {
            intro: `This lesson is based on the uploaded syllabus topic: ${topic.name}. We will build the idea carefully and connect it to the Zambian curriculum.`,
            steps: [{
              title: topic.name,
              body: `Let us begin with ${topic.name}. Ask me about any word, rule, process, or example from this syllabus topic and I will explain it step by step.`,
              board: topic.name,
            }],
            examples: [],
            summary: `Review the key ideas in ${topic.name} and answer the teacher's check-in before moving on.`,
          },
        });
        if (error) throw error;
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
          .update({ storage_path: body.storage_path || null, status: "pending", ingestion_error: message })
          .eq("id", body.material_id);
      }
    } catch {
      // Preserve the original ingestion error if diagnostic persistence fails.
    }
    const status = (error as { code?: string })?.code === "DUPLICATE_PAST_PAPER" ? 409 : 500;
    return response({ error: message }, status);
  }
});
