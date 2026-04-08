'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// 특정 Day 어휘 목록
export async function getVocabularyByDay(day: number) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('vocabulary')
    .select('id, word, exam_count, word_meanings(id), word_synonyms(id), word_similar(id), word_antonyms(id)')
    .eq('day', day)
    .order('id');

  if (error) throw error;
  return (data ?? []).map((v) => ({
    id: v.id,
    word: v.word,
    exam_count: v.exam_count,
    meaning_count: Array.isArray(v.word_meanings) ? v.word_meanings.length : 0,
    synonym_count: Array.isArray(v.word_synonyms) ? v.word_synonyms.length : 0,
    similar_count: Array.isArray(v.word_similar)  ? v.word_similar.length  : 0,
    antonym_count: Array.isArray(v.word_antonyms) ? v.word_antonyms.length : 0,
  }));
}

// 단어 상세 (의미 + 동의어 + 유의어 + 반의어)
export async function getWordDetail(vocabId: string) {
  const admin = createAdminClient();
  const [{ data: meanings }, { data: synonyms }, { data: similar }, { data: antonyms }] =
    await Promise.all([
      admin.from('word_meanings').select('*').eq('vocab_id', vocabId).order('display_order'),
      admin.from('word_synonyms').select('*').eq('vocab_id', vocabId).order('display_order'),
      admin.from('word_similar').select('*').eq('vocab_id', vocabId).order('display_order'),
      admin.from('word_antonyms').select('*').eq('vocab_id', vocabId).order('display_order'),
    ]);
  return {
    meanings: meanings ?? [],
    synonyms: synonyms ?? [],
    similar:  similar  ?? [],
    antonyms: antonyms ?? [],
  };
}

// ── 의미 ─────────────────────────────────────────────────────
export async function addWordMeaning(vocabId: string, pos: string, meaning_ko: string, display_order: number) {
  const admin = createAdminClient();
  const { error } = await admin.from('word_meanings').insert({ vocab_id: vocabId, pos, meaning_ko, display_order });
  if (error) throw error;
  revalidatePath('/admin/vocabulary');
}
export async function updateWordMeaning(id: string, meaning_ko: string) {
  const admin = createAdminClient();
  const { error } = await admin.from('word_meanings').update({ meaning_ko }).eq('id', id);
  if (error) throw error;
  revalidatePath('/admin/vocabulary');
}
export async function deleteWordMeaning(id: string) {
  const admin = createAdminClient();
  const { error } = await admin.from('word_meanings').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/admin/vocabulary');
}

// ── 동의어 (word_synonyms) ────────────────────────────────────
export async function addWordSynonym(vocabId: string, synonym: string, display_order: number) {
  const admin = createAdminClient();
  const { error } = await admin.from('word_synonyms').insert({ vocab_id: vocabId, synonym, display_order });
  if (error) throw error;
  revalidatePath('/admin/vocabulary');
}
export async function deleteWordSynonym(id: string) {
  const admin = createAdminClient();
  const { error } = await admin.from('word_synonyms').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/admin/vocabulary');
}

// ── 유의어 (word_similar) ─────────────────────────────────────
export async function addWordSimilar(vocabId: string, similar: string, display_order: number) {
  const admin = createAdminClient();
  const { error } = await admin.from('word_similar').insert({ vocab_id: vocabId, similar_word: similar, display_order });
  if (error) throw error;
  revalidatePath('/admin/vocabulary');
}
export async function deleteWordSimilar(id: string) {
  const admin = createAdminClient();
  const { error } = await admin.from('word_similar').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/admin/vocabulary');
}

// ── 반의어 (word_antonyms) ────────────────────────────────────
export async function addWordAntonym(vocabId: string, antonym: string, display_order: number) {
  const admin = createAdminClient();
  const { error } = await admin.from('word_antonyms').insert({ vocab_id: vocabId, antonym, display_order });
  if (error) throw error;
  revalidatePath('/admin/vocabulary');
}
export async function deleteWordAntonym(id: string) {
  const admin = createAdminClient();
  const { error } = await admin.from('word_antonyms').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/admin/vocabulary');
}

// ── exam_count 리셋 ──────────────────────────────────────────
export async function resetExamCount(vocabId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from('vocabulary').update({ exam_count: 0 }).eq('id', vocabId);
  if (error) throw error;
  revalidatePath('/admin/vocabulary');
}

// ── 미입력 단어 목록 ──────────────────────────────────────────
export async function getWordsWithoutMeanings(day: number) {
  const admin = createAdminClient();
  const { data: allWords } = await admin.from('vocabulary').select('id, word').eq('day', day).order('id');
  if (!allWords || allWords.length === 0) return [];
  const { data: withMeanings } = await admin.from('word_meanings').select('vocab_id').in('vocab_id', allWords.map((w) => w.id));
  const withSet = new Set((withMeanings ?? []).map((m) => m.vocab_id));
  return allWords.filter((w) => !withSet.has(w.id));
}
