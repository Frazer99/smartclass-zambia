export type TutorResponseData = {
  response: string;
  boardItems?: unknown[];
  diagrams?: unknown[];
  checkRequired?: boolean;
  checkResult?: 'correct' | 'partly_correct' | 'incorrect' | 'unclear';
  source?: string;
};

export async function readTutorResponse(
  response: Response,
  onDelta?: (delta: string) => void
): Promise<TutorResponseData> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream') || !response.body) {
    return await response.json() as TutorResponseData;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let finalData: TutorResponseData | null = null;

  const processLine = (line: string) => {
    if (!line.startsWith('data: ')) return;
    const raw = line.slice(6).trim();
    if (!raw || raw === '[DONE]') return;
    const payload = JSON.parse(raw) as TutorResponseData & { delta?: string; done?: boolean; error?: string };
    if (payload.error) throw new Error(payload.error);
    if (typeof payload.delta === 'string') {
      accumulated += payload.delta;
      onDelta?.(payload.delta);
    }
    if (payload.done) finalData = payload;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(processLine);
  }
  if (buffer.trim()) processLine(buffer.trim());

  return finalData || { response: accumulated, source: 'openai' };
}
