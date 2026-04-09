import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const WordSchema = z.object({
  words: z.array(
    z.object({
      word: z.string(),
      entries: z.array(
        z.object({
          pos: z.enum(['n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.']),
          meaning_ko: z.string().describe('한국어 뜻 (핵심만, 30자 이내)'),
        })
      ).min(1).max(4),
      synonyms: z.array(z.string()).max(3).describe('영어 동의어 — 뜻이 동일한 단어'),
      similar:  z.array(z.string()).max(3).describe('영어 유의어 — 뜻이 유사한 단어'),
      antonyms: z.array(z.string()).max(3).describe('영어 반의어 — 뜻이 반대인 단어'),
    })
  ),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { words } = await req.json() as {
    words: Array<{
      id: string;
      word: string;
      needsMeaning: boolean;
      needsSynonym: boolean;
      needsSimilar: boolean;
      needsAntonym: boolean;
    }>;
  };

  if (!words || words.length === 0) {
    return NextResponse.json({ error: 'No words provided' }, { status: 400 });
  }

  const batch = words.slice(0, 50);

  const prompt = `다음 영어 단어들의 한국어 뜻, 동의어, 유의어, 반의어를 생성하세요.
편입영어 시험 기준으로 작성하세요.

단어 목록:
${batch.map((w) => w.word).join('\n')}

규칙:
- pos는 반드시 'n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.' 중 하나
- meaning_ko는 한국어 핵심 뜻 (30자 이내)
- synonyms: 동의어 — 뜻이 완전히 동일한 영어 단어 0~3개
- similar: 유의어 — 뜻이 비슷한 영어 단어 0~3개
- antonyms: 반의어 — 뜻이 반대인 영어 단어 0~3개 (없으면 빈 배열)
- word 필드는 원본 단어 철자 그대로`;

  try {
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: WordSchema,
      prompt,
    });

    const wordMap = Object.fromEntries(batch.map((w) => [w.word.toLowerCase(), w]));

    const result = object.words.map((w) => {
      const meta = wordMap[w.word.toLowerCase()];
      if (!meta) return null;
      return {
        vocab_id: meta.id,
        needsMeaning: meta.needsMeaning,
        needsSynonym: meta.needsSynonym,
        needsSimilar: meta.needsSimilar,
        needsAntonym: meta.needsAntonym,
        entries:  w.entries,
        synonyms: w.synonyms,
        similar:  w.similar,
        antonyms: w.antonyms,
      };
    }).filter((r): r is Exclude<typeof r, null> => r !== null);

    const admin = createAdminClient();

    const meaningRows = result
      .filter((m: any) => m.needsMeaning)
      .flatMap((m: any) =>
        m.entries.map((e: any, i: number) => ({
          vocab_id: m.vocab_id, pos: e.pos, meaning_ko: e.meaning_ko, display_order: i,
        }))
      );

    const synonymRows = result
      .filter((m: any) => m.needsSynonym && m.synonyms.length > 0)
      .flatMap((m: any) =>
        m.synonyms.map((s: string, i: number) => ({
          vocab_id: m.vocab_id, synonym: s, display_order: i,
        }))
      );

    const similarRows = result
      .filter((m: any) => m.needsSimilar && m.similar.length > 0)
      .flatMap((m: any) =>
        m.similar.map((s: string, i: number) => ({
          vocab_id: m.vocab_id, similar_word: s, display_order: i,
        }))
      );

    const antonymRows = result
      .filter((m: any) => m.needsAntonym && m.antonyms.length > 0)
      .flatMap((m: any) =>
        m.antonyms.map((a: string, i: number) => ({
          vocab_id: m.vocab_id, antonym: a, display_order: i,
        }))
      );

    if (meaningRows.length > 0) await admin.from('word_meanings').insert(meaningRows);
    if (synonymRows.length > 0) await admin.from('word_synonyms').insert(synonymRows);
    if (similarRows.length > 0)  await admin.from('word_similar').insert(similarRows);
    if (antonymRows.length > 0)  await admin.from('word_antonyms').insert(antonymRows);

    return NextResponse.json({ generated: result.length });
  } catch (err: any) {
    console.error('AI 생성 오류:', err);
    return NextResponse.json({ error: err.message ?? 'AI 생성 실패' }, { status: 500 });
  }
}
