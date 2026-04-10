'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWordDetail,
  addWordMeaning, updateWordMeaning, deleteWordMeaning,
  addWordSynonym,  deleteWordSynonym,
  addWordSimilar,  deleteWordSimilar,
  addWordAntonym,  deleteWordAntonym,
  resetExamCount,
} from '@/app/actions/vocabulary';

type Word = {
  id: string;
  word: string;
  exam_count: number;
  meaning_count: number;
  synonym_count: number;
  similar_count: number;
  antonym_count: number;
};

type WordMeaning  = { id: string; pos: string; meaning_ko: string; display_order: number };
type WordSynonym  = { id: string; synonym: string; display_order: number };
type WordSimilar  = { id: string; similar_word: string; display_order: number };
type WordAntonym  = { id: string; antonym: string;  display_order: number };

const POS_OPTIONS = ['n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.'];

export default function VocabularyManager({ day, words, totalDays }: {
  day: number; words: Word[]; totalDays: number;
}) {
  const router = useRouter();
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [detail, setDetail] = useState<{
    meanings: WordMeaning[];
    synonyms: WordSynonym[];
    similar:  WordSimilar[];
    antonyms: WordAntonym[];
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState('');

  async function openDetail(word: Word) {
    setSelectedWord(word);
    const d = await getWordDetail(word.id);
    setDetail(d as any);
  }

  function changeDay(newDay: number) {
    router.push(`/admin/vocabulary?day=${newDay}`);
  }

  async function handleGenerate() {
    const incomplete = words.filter(
      (w) => w.meaning_count === 0 || w.synonym_count === 0 || w.similar_count === 0 || w.antonym_count === 0
    );
    if (incomplete.length === 0) {
      setGenerateMsg('모든 단어에 의미·동의어·유의어·반의어가 입력되어 있습니다.');
      return;
    }

    setIsGenerating(true);
    setGenerateMsg(`${incomplete.length}개 단어 AI 생성 중...`);

    try {
      const batchSize = 25;
      let total = 0;
      for (let i = 0; i < incomplete.length; i += batchSize) {
        const batch = incomplete.slice(i, i + batchSize);
        setGenerateMsg(`AI 생성 중... (${i + 1}–${Math.min(i + batchSize, incomplete.length)} / ${incomplete.length})`);
        const res = await fetch('/api/admin/vocabulary/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            words: batch.map((w) => ({
              id: w.id,
              word: w.word,
              needsMeaning: w.meaning_count === 0,
              needsSynonym: w.synonym_count === 0,
              needsSimilar: w.similar_count === 0,
              needsAntonym: w.antonym_count === 0,
            })),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? '오류');
        total += json.generated ?? 0;
        if (i + batchSize < incomplete.length) await new Promise((r) => setTimeout(r, 1500));
      }
      setGenerateMsg(`✅ ${total}개 단어 생성 완료!`);
      router.refresh();
    } catch (err: any) {
      setGenerateMsg(`❌ 오류: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  const incompleteCount = words.filter(
    (w) => w.meaning_count === 0 || w.synonym_count === 0 || w.similar_count === 0 || w.antonym_count === 0
  ).length;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={day}
          onChange={(e) => changeDay(Number(e.target.value))}
          className="border border-[#e5e5ea] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1d1d1f]"
        >
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>Day {d}</option>
          ))}
        </select>

        <span className="text-sm text-[#6e6e73]">
          {words.length}개 단어
          {incompleteCount > 0 && (
            <span className="ml-1 text-orange-500">/ 미완성 {incompleteCount}개</span>
          )}
        </span>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="ml-auto px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? '생성 중...' : incompleteCount > 0 ? `AI 일괄 생성 (${incompleteCount}개)` : 'AI 일괄 생성'}
        </button>
      </div>

      {generateMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          generateMsg.startsWith('✅') ? 'bg-green-50 text-green-700' :
          generateMsg.startsWith('❌') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
        }`}>
          {generateMsg}
        </div>
      )}

      {/* 단어 목록 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f5f7] border-b border-[#e5e5ea]">
            <tr>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium w-8">#</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">단어</th>
              <th className="text-center px-3 py-3 text-[#6e6e73] font-medium">의미</th>
              <th className="text-center px-3 py-3 text-[#6e6e73] font-medium">동의어</th>
              <th className="text-center px-3 py-3 text-[#6e6e73] font-medium">유의어</th>
              <th className="text-center px-3 py-3 text-[#6e6e73] font-medium">반의어</th>
              <th className="text-center px-3 py-3 text-[#6e6e73] font-medium">기출</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f5f5f7]">
            {words.map((word, idx) => (
              <tr key={word.id} className="hover:bg-[#f5f5f7] transition-colors">
                <td className="px-4 py-3 text-[#6e6e73]">{(day - 1) * 50 + idx + 1}</td>
                <td className="px-4 py-3 font-medium text-[#1d1d1f]">{word.word}</td>
                <td className="px-3 py-3 text-center">
                  <CountBadge count={word.meaning_count} emptyColor="bg-red-100 text-red-700" />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountBadge count={word.synonym_count} filledColor="bg-blue-50 text-[#0071e3]" />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountBadge count={word.similar_count} filledColor="bg-teal-50 text-teal-600" />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountBadge count={word.antonym_count} filledColor="bg-orange-50 text-orange-600" />
                </td>
                <td className="px-3 py-3 text-center text-[#6e6e73]">{word.exam_count}회</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openDetail(word)}
                    className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#1d1d1f] rounded-lg hover:opacity-80 transition-opacity"
                  >
                    편집
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 편집 모달 */}
      {selectedWord && detail && (
        <WordEditModal
          word={selectedWord}
          meanings={detail.meanings}
          synonyms={detail.synonyms}
          similar={detail.similar}
          antonyms={detail.antonyms}
          onClose={() => { setSelectedWord(null); setDetail(null); router.refresh(); }}
          onRefresh={async () => {
            const d = await getWordDetail(selectedWord.id);
            setDetail(d as any);
          }}
        />
      )}
    </div>
  );
}

function CountBadge({
  count,
  filledColor = 'bg-green-100 text-green-700',
  emptyColor = 'bg-[#f5f5f7] text-[#6e6e73]',
}: {
  count: number;
  filledColor?: string;
  emptyColor?: string;
}) {
  if (count === 0) {
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${emptyColor}`}>—</span>;
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${filledColor}`}>{count}개</span>;
}

function TagList({
  items, label, onDelete, color,
}: {
  items: { id: string; label: string }[];
  label: string;
  onDelete: (id: string) => void;
  color: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item.id} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${color}`}>
          {item.label}
          <button onClick={() => { if (!confirm(`'${item.label}'을(를) 삭제하시겠습니까?`)) return; onDelete(item.id); }} className="opacity-60 hover:opacity-100 hover:text-red-500">×</button>
        </span>
      ))}
      {items.length === 0 && <span className="text-xs text-[#6e6e73]">{label} 없음</span>}
    </div>
  );
}

function WordEditModal({
  word, meanings, synonyms, similar, antonyms, onClose, onRefresh,
}: {
  word: Word;
  meanings: WordMeaning[];
  synonyms: WordSynonym[];
  similar:  WordSimilar[];
  antonyms: WordAntonym[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [newPos, setNewPos]         = useState('n.');
  const [newMeaning, setNewMeaning] = useState('');
  const [newSynonym, setNewSynonym] = useState('');
  const [newSimilar,  setNewSimilar]  = useState('');
  const [newAntonym, setNewAntonym] = useState('');
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const act = (fn: () => Promise<void>) =>
    startTransition(async () => { await fn(); await onRefresh(); });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="p-5 border-b border-[#e5e5ea] flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-[#1d1d1f]">{word.word}</h2>
            <p className="text-xs text-[#6e6e73]">기출 {word.exam_count}회</p>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={() => { if (!confirm('기출 횟수를 0으로 초기화하시겠습니까?')) return; act(() => resetExamCount(word.id)); }} className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#6e6e73] rounded-lg hover:opacity-80 transition-opacity">기출 리셋</button>
            <button onClick={onClose} className="text-[#6e6e73] hover:text-[#6e6e73] text-xl leading-none">×</button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* 의미 */}
          <section>
            <h3 className="text-sm font-semibold text-[#1d1d1f] mb-2">의미</h3>
            <div className="space-y-2 mb-3">
              {meanings.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-[#f5f5f7] text-[#6e6e73] px-1.5 py-0.5 rounded shrink-0">{m.pos}</span>
                  {editingId === m.id ? (
                    <>
                      <input value={editingValue} onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && act(() => updateWordMeaning(m.id, editingValue.trim()).then(() => setEditingId(null)))}
                        className="flex-1 border border-[#e5e5ea] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:border-[#1d1d1f]" autoFocus />
                      <button onClick={() => act(async () => { await updateWordMeaning(m.id, editingValue.trim()); setEditingId(null); })} className="text-[11px] px-2.5 py-1 bg-[#1d1d1f] text-white rounded-lg hover:opacity-80 transition-opacity">저장</button>
                      <button onClick={() => setEditingId(null)} className="text-[11px] px-2.5 py-1 bg-[#f5f5f7] text-[#6e6e73] rounded-lg hover:opacity-80 transition-opacity">취소</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-[#1d1d1f]">{m.meaning_ko}</span>
                      <button onClick={() => { setEditingId(m.id); setEditingValue(m.meaning_ko); }} className="text-[11px] px-2.5 py-1 bg-[#f5f5f7] text-[#1d1d1f] rounded-lg hover:opacity-80 transition-opacity">수정</button>
                      <button onClick={() => { if (!confirm('이 의미를 삭제하시겠습니까?')) return; act(() => deleteWordMeaning(m.id)); }} className="text-[11px] px-2.5 py-1 bg-[#f5f5f7] text-[#6e6e73] rounded-lg hover:opacity-80 transition-opacity">삭제</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <select value={newPos} onChange={(e) => setNewPos(e.target.value)} className="border border-[#e5e5ea] rounded px-2 py-1 text-sm focus:outline-none">
                {POS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input value={newMeaning} onChange={(e) => setNewMeaning(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && newMeaning.trim() && act(async () => { await addWordMeaning(word.id, newPos, newMeaning.trim(), meanings.length); setNewMeaning(''); })}
                placeholder="한국어 뜻" className="flex-1 border border-[#e5e5ea] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:border-[#1d1d1f]" />
              <button disabled={isPending || !newMeaning.trim()}
                onClick={() => act(async () => { await addWordMeaning(word.id, newPos, newMeaning.trim(), meanings.length); setNewMeaning(''); })}
                className="px-3 py-1 bg-[#1d1d1f] text-white text-sm rounded hover:opacity-80 disabled:opacity-50">추가</button>
            </div>
          </section>

          {/* 동의어 */}
          <section>
            <h3 className="text-sm font-semibold text-[#1d1d1f] mb-2">동의어 <span className="text-xs text-[#6e6e73] font-normal">(뜻이 같은 영어 단어)</span></h3>
            <TagList
              items={synonyms.map((s) => ({ id: s.id, label: s.synonym }))}
              label="동의어" color="bg-blue-50 text-blue-700"
              onDelete={(id) => act(() => deleteWordSynonym(id))}
            />
            <div className="flex gap-2 mt-2">
              <input value={newSynonym} onChange={(e) => setNewSynonym(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && newSynonym.trim() && act(async () => { await addWordSynonym(word.id, newSynonym.trim(), synonyms.length); setNewSynonym(''); })}
                placeholder="동의어 입력" className="flex-1 border border-[#e5e5ea] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:border-[#1d1d1f]" />
              <button disabled={isPending || !newSynonym.trim()}
                onClick={() => act(async () => { await addWordSynonym(word.id, newSynonym.trim(), synonyms.length); setNewSynonym(''); })}
                className="px-3 py-1 bg-[#1d1d1f] text-white text-sm rounded hover:opacity-80 disabled:opacity-50">추가</button>
            </div>
          </section>

          {/* 유의어 */}
          <section>
            <h3 className="text-sm font-semibold text-[#1d1d1f] mb-2">유의어 <span className="text-xs text-[#6e6e73] font-normal">(뜻이 비슷한 영어 단어)</span></h3>
            <TagList
              items={similar.map((s) => ({ id: s.id, label: s.similar_word }))}
              label="유의어" color="bg-teal-50 text-teal-700"
              onDelete={(id) => act(() => deleteWordSimilar(id))}
            />
            <div className="flex gap-2 mt-2">
              <input value={newSimilar} onChange={(e) => setNewSimilar(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && newSimilar.trim() && act(async () => { await addWordSimilar(word.id, newSimilar.trim(), similar.length); setNewSimilar(''); })}
                placeholder="유의어 입력" className="flex-1 border border-[#e5e5ea] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:border-[#1d1d1f]" />
              <button disabled={isPending || !newSimilar.trim()}
                onClick={() => act(async () => { await addWordSimilar(word.id, newSimilar.trim(), similar.length); setNewSimilar(''); })}
                className="px-3 py-1 bg-teal-600 text-white text-sm rounded hover:bg-teal-700 disabled:opacity-50">추가</button>
            </div>
          </section>

          {/* 반의어 */}
          <section>
            <h3 className="text-sm font-semibold text-[#1d1d1f] mb-2">반의어 <span className="text-xs text-[#6e6e73] font-normal">(뜻이 반대인 영어 단어)</span></h3>
            <TagList
              items={antonyms.map((a) => ({ id: a.id, label: a.antonym }))}
              label="반의어" color="bg-orange-50 text-orange-700"
              onDelete={(id) => act(() => deleteWordAntonym(id))}
            />
            <div className="flex gap-2 mt-2">
              <input value={newAntonym} onChange={(e) => setNewAntonym(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && newAntonym.trim() && act(async () => { await addWordAntonym(word.id, newAntonym.trim(), antonyms.length); setNewAntonym(''); })}
                placeholder="반의어 입력" className="flex-1 border border-[#e5e5ea] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:border-[#1d1d1f]" />
              <button disabled={isPending || !newAntonym.trim()}
                onClick={() => act(async () => { await addWordAntonym(word.id, newAntonym.trim(), antonyms.length); setNewAntonym(''); })}
                className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 disabled:opacity-50">추가</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
