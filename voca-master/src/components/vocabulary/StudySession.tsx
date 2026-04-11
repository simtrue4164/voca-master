'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { upsertLearningLog, upsertRelatedWordLog } from '@/app/actions/learning';
import type { WordMeaning, WordSynonym } from '@/types';

type WordSimilar  = { id: string; similar_word: string; display_order: number };
type WordAntonym  = { id: string; antonym: string;  display_order: number };

type Word = {
  id: string;
  day: number;
  word: string;
  exam_count: number;
  meanings: WordMeaning[];
  synonyms: WordSynonym[];
  similar:  WordSimilar[];
  antonyms: WordAntonym[];
  currentStatus: string | null;
};

type RelatedWord = {
  id: string;
  type: 'synonym' | 'similar' | 'antonym';
  word: string;
  baseWord: string;
  baseMeanings: WordMeaning[];
  currentStatus: string | null;
};

type Mode = 'flashcard' | 'selftest' | 'related';

export default function StudySession({
  day,
  words,
  title,
  backHref,
  relatedLogs = {},
}: {
  day: number;
  words: Word[];
  title?: string;
  backHref?: string;
  relatedLogs?: Record<string, string>;
}) {
  const [mode, setMode] = useState<Mode>('flashcard');
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<string, 'memorized' | 'failed'>>({});
  const [selfTestInput, setSelfTestInput] = useState('');
  const [selfTestResult, setSelfTestResult] = useState<'correct' | 'wrong' | null>(null);
  const [done, setDone] = useState(false);

  // 관련 단어 학습 상태
  const [relatedResults, setRelatedResults] = useState<Record<string, 'memorized' | 'failed'>>({});
  const [relatedIndex, setRelatedIndex] = useState(0);
  const [relatedFlipped, setRelatedFlipped] = useState(false);
  const [relatedDone, setRelatedDone] = useState(false);

  const [, startTransition] = useTransition();
  const router = useRouter();

  // 관련 단어 목록 (동의어 → 유의어 → 반의어 순)
  const relatedWords: RelatedWord[] = words.flatMap((w) => [
    ...w.synonyms.map((s) => ({
      id: s.id, type: 'synonym' as const, word: s.synonym,
      baseWord: w.word, baseMeanings: w.meanings,
      currentStatus: relatedLogs[s.id] ?? null,
    })),
    ...w.similar.map((s) => ({
      id: s.id, type: 'similar' as const, word: s.similar_word,
      baseWord: w.word, baseMeanings: w.meanings,
      currentStatus: relatedLogs[s.id] ?? null,
    })),
    ...w.antonyms.map((a) => ({
      id: a.id, type: 'antonym' as const, word: a.antonym,
      baseWord: w.word, baseMeanings: w.meanings,
      currentStatus: relatedLogs[a.id] ?? null,
    })),
  ]);

  const current = words[index];
  const total = words.length;
  const answeredCount = Object.keys(results).length;

  function handleFlashcard(status: 'memorized' | 'failed') {
    setResults((prev) => ({ ...prev, [current.id]: status }));
    startTransition(async () => { await upsertLearningLog(current.id, status); });
    nextWord();
  }

  function handleSelfTestSubmit() {
    if (!selfTestInput.trim()) return;
    const input = selfTestInput.trim().toLowerCase();
    const isCorrect = current.meanings.some((m) =>
      m.meaning_ko.toLowerCase().split(/[,，、]/).some((kw) =>
        input.includes(kw.trim()) && kw.trim().length > 0
      )
    );
    const status = isCorrect ? 'memorized' : 'failed';
    setSelfTestResult(isCorrect ? 'correct' : 'wrong');
    setResults((prev) => ({ ...prev, [current.id]: status }));
    startTransition(async () => { await upsertLearningLog(current.id, status); });
  }

  function nextWord() {
    setFlipped(false); setSelfTestInput(''); setSelfTestResult(null);
    if (index + 1 >= total) setDone(true);
    else setIndex((i) => i + 1);
  }

  // 관련 단어 학습
  function handleRelated(status: 'memorized' | 'failed') {
    const rw = relatedWords[relatedIndex];
    setRelatedResults((prev) => ({ ...prev, [rw.id]: status }));
    startTransition(async () => { await upsertRelatedWordLog(rw.id, rw.type, status); });
    setRelatedFlipped(false);
    if (relatedIndex + 1 >= relatedWords.length) setRelatedDone(true);
    else setRelatedIndex((i) => i + 1);
  }

  function startRelatedStudy() {
    setRelatedIndex(0); setRelatedFlipped(false);
    setRelatedResults({}); setRelatedDone(false);
    setMode('related'); setDone(false);
  }

  if (words.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <p className="text-[#6e6e73]">단어 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  // 관련 단어 학습 완료 화면
  if (mode === 'related' && relatedDone) {
    const rMemorized = Object.values(relatedResults).filter((v) => v === 'memorized').length;
    const rTotal = relatedWords.length;
    const rRate = rTotal > 0 ? Math.round((rMemorized / rTotal) * 100) : 0;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#f5f5f7]">
        <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="text-4xl mb-4">✨</div>
          <h2 className="text-xl font-bold text-[#1d1d1f] mb-2">관련 단어 학습 완료!</h2>
          <div className="my-6">
            <div className="text-5xl font-bold text-purple-600 mb-1">{rRate}%</div>
            <p className="text-sm text-[#6e6e73]">학습율 ({rMemorized}/{rTotal}개)</p>
            <div className="flex justify-center gap-4 mt-3 text-sm">
              <span className="text-green-600 font-medium">알겠어요 {rMemorized}</span>
              <span className="text-red-500 font-medium">모르겠어요 {rTotal - rMemorized}</span>
            </div>
          </div>
          <button
            onClick={() => router.push(backHref ?? '/student/study')}
            className="w-full py-3 bg-[#1d1d1f] text-white font-medium rounded-xl"
          >
            학습 목록으로
          </button>
        </div>
      </div>
    );
  }

  // 어휘 학습 완료 화면
  if (done) {
    const memorized = Object.values(results).filter((v) => v === 'memorized').length;
    const failed = Object.values(results).filter((v) => v === 'failed').length;
    const rate = answeredCount > 0 ? Math.round((memorized / answeredCount) * 100) : 0;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#f5f5f7]">
        <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-[#1d1d1f] mb-2">{title ?? `Day ${day}`} 완료!</h2>
          {mode === 'selftest' && (
            <div className="my-6">
              <div className="text-5xl font-bold text-[#0071e3] mb-1">{rate}%</div>
              <p className="text-sm text-[#6e6e73]">학습율</p>
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <span className="text-green-600 font-medium">정답 {memorized}</span>
                <span className="text-red-500 font-medium">오답 {failed}</span>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2 mt-6">
            {failed > 0 && (
              <button
                onClick={() => { setResults({}); setIndex(0); setDone(false); }}
                className="w-full py-3 bg-red-50 text-red-600 font-medium rounded-xl"
              >
                오답 다시 학습 ({failed}단어)
              </button>
            )}
            {relatedWords.length > 0 && (
              <button
                onClick={startRelatedStudy}
                className="w-full py-3 bg-purple-50 text-purple-700 font-medium rounded-xl border border-purple-200"
              >
                관련 단어 학습하기 ({relatedWords.length}개)
              </button>
            )}
            <button
              onClick={() => router.push(backHref ?? '/student/study')}
              className="w-full py-3 bg-[#1d1d1f] text-white font-medium rounded-xl"
            >
              {backHref ? '결과 페이지로' : '학습 목록으로'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 관련 단어 학습 화면
  if (mode === 'related') {
    const rw = relatedWords[relatedIndex];
    const typeLabel = { synonym: '동의어', similar: '유의어', antonym: '반의어' };
    const typeBadgeColor = {
      synonym: 'bg-blue-100 text-blue-700',
      similar: 'bg-teal-100 text-teal-700',
      antonym: 'bg-orange-100 text-orange-700',
    };
    return (
      <div className="min-h-screen flex flex-col bg-[#f5f5f7]">
        <div className="flex items-center gap-3 px-4 pt-6 pb-3">
          <button onClick={() => { setMode('flashcard'); setDone(true); }} className="p-1">
            <svg className="w-6 h-6 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-base font-semibold text-[#1d1d1f]">관련 단어 학습</span>
          <span className="ml-auto text-sm text-[#6e6e73]">{relatedIndex + 1} / {relatedWords.length}</span>
        </div>
        <div className="px-4 mb-4">
          <div className="w-full bg-[#e5e5ea] rounded-full h-1.5">
            <div className="bg-purple-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(relatedIndex / relatedWords.length) * 100}%` }} />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            <div className="w-full aspect-[3/2] cursor-pointer" style={{ perspective: '1000px' }}
              onClick={() => setRelatedFlipped((f) => !f)}>
              <motion.div className="relative w-full h-full"
                animate={{ rotateY: relatedFlipped ? 180 : 0 }}
                transition={{ duration: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
                style={{ transformStyle: 'preserve-3d' }}>
                {/* 앞면 */}
                <div className="absolute inset-0 bg-white rounded-2xl shadow-sm border border-[#e5e5ea] flex flex-col items-center justify-center p-6 gap-3"
                  style={{ backfaceVisibility: 'hidden' }}>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadgeColor[rw.type]}`}>
                    {rw.baseWord}의 {typeLabel[rw.type]}
                  </span>
                  <p className="text-3xl font-bold text-[#1d1d1f] text-center">{rw.word}</p>
                  <p className="text-sm text-[#6e6e73]">탭하여 기준 단어 확인</p>
                </div>
                {/* 뒷면 */}
                <div className="absolute inset-0 bg-white rounded-2xl shadow-sm border border-[#e5e5ea] flex flex-col items-center justify-center p-5 gap-2"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <p className="text-lg font-bold text-[#1d1d1f] text-center">{rw.baseWord}</p>
                  <div className="space-y-0.5 w-full">
                    {rw.baseMeanings.map((m) => (
                      <div key={m.id} className="flex gap-1.5 justify-center">
                        <span className="text-[#6e6e73] text-[15px] shrink-0 pt-0.5">{m.pos}</span>
                        <span className="text-[#1d1d1f] text-[15px]">{m.meaning_ko}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[#e5e5ea] pt-2 mt-1 w-full flex justify-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      rw.type === 'synonym' ? 'bg-blue-100 text-blue-800' :
                      rw.type === 'similar' ? 'bg-teal-100 text-teal-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {typeLabel[rw.type]}: {rw.word}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
            <AnimatePresence>
              {relatedFlipped && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className="flex gap-3 w-full">
                  <button onClick={() => handleRelated('failed')}
                    className="flex-1 py-4 bg-red-50 text-red-600 font-semibold rounded-xl border border-red-200">
                    모르겠어요
                  </button>
                  <button onClick={() => handleRelated('memorized')}
                    className="flex-1 py-4 bg-green-500 text-white font-semibold rounded-xl">
                    알겠어요
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f7]">
      <div className="flex items-center gap-3 px-4 pt-6 pb-3">
        <button onClick={() => router.back()} className="p-1">
          <svg className="w-6 h-6 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-base font-semibold text-[#1d1d1f]">{title ?? `Day ${day}`}</span>
        <span className="ml-auto text-sm text-[#6e6e73]">{index + 1} / {total}</span>
      </div>

      <div className="px-4 mb-4">
        <div className="flex rounded-lg bg-[#f5f5f7] p-1">
          {(['flashcard', 'selftest'] as Mode[]).map((m) => (
            <button key={m}
              onClick={() => { setMode(m); setIndex(0); setFlipped(false); setSelfTestInput(''); setSelfTestResult(null); setResults({}); setDone(false); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === m ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73]'}`}>
              {m === 'flashcard' ? '플래시카드' : '셀프 테스트'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="flex justify-between text-xs text-[#6e6e73] mb-1">
          <span>{Math.round((index / total) * 100)}%</span>
          <span>{index} / {total} 단어</span>
        </div>
        <div className="w-full bg-[#e5e5ea] rounded-full h-1.5">
          <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(index / total) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {mode === 'flashcard' ? (
          <FlashCard word={current} flipped={flipped} onFlip={() => setFlipped((f) => !f)}
            onKnow={() => handleFlashcard('memorized')} onDontKnow={() => handleFlashcard('failed')} />
        ) : (
          <SelfTestCard word={current} input={selfTestInput} result={selfTestResult}
            onInputChange={setSelfTestInput} onSubmit={handleSelfTestSubmit} onNext={nextWord} />
        )}
      </div>
    </div>
  );
}

function FlashCard({ word, flipped, onFlip, onKnow, onDontKnow }: {
  word: Word; flipped: boolean; onFlip: () => void; onKnow: () => void; onDontKnow: () => void;
}) {
  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-6">
      <div className="w-full aspect-[3/2] cursor-pointer" style={{ perspective: '1000px' }} onClick={onFlip}>
        <motion.div className="relative w-full h-full"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
          style={{ transformStyle: 'preserve-3d' }}>
          <div className="absolute inset-0 bg-white rounded-2xl shadow-sm border border-[#e5e5ea] flex flex-col items-center justify-center p-6"
            style={{ backfaceVisibility: 'hidden' }}>
            <p className="text-3xl font-bold text-[#1d1d1f] text-center">{word.word}</p>
            <p className="text-sm text-[#6e6e73] mt-3">탭하여 뜻 확인</p>
          </div>
          <div className="absolute inset-0 bg-white rounded-2xl shadow-sm border border-[#e5e5ea] flex flex-col items-center justify-center p-4 gap-1.5"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <p className="text-base font-bold text-[#1d1d1f] text-center">{word.word}</p>
            <div className="space-y-0.5 w-full">
              {word.meanings.map((m) => (
                <div key={m.id} className="flex gap-1.5 justify-center">
                  <span className="text-[#6e6e73] text-[15px] shrink-0 pt-0.5">{m.pos}</span>
                  <span className="text-[#1d1d1f] text-[15px]">{m.meaning_ko}</span>
                </div>
              ))}
            </div>
            {(word.synonyms?.length > 0 || word.similar?.length > 0 || word.antonyms?.length > 0) && (
              <div className="border-t border-[#e5e5ea] pt-1.5 flex flex-col gap-1 w-full items-center">
                {word.synonyms?.length > 0 && (
                  <div className="flex gap-1.5 items-baseline justify-center">
                    <span className="text-[#6e6e73] text-[15px] shrink-0">동의어</span>
                    <span className="text-[#1d1d1f] text-[15px]">{word.synonyms.map((s) => s.synonym).join(', ')}</span>
                  </div>
                )}
                {word.similar?.length > 0 && (
                  <div className="flex gap-1.5 items-baseline justify-center">
                    <span className="text-[#6e6e73] text-[15px] shrink-0">유의어</span>
                    <span className="text-[#1d1d1f] text-[15px]">{word.similar.map((s) => s.similar_word).join(', ')}</span>
                  </div>
                )}
                {word.antonyms?.length > 0 && (
                  <div className="flex gap-1.5 items-baseline justify-center">
                    <span className="text-[#6e6e73] text-[15px] shrink-0">반의어</span>
                    <span className="text-[#1d1d1f] text-[15px]">{word.antonyms.map((a) => a.antonym).join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
      <AnimatePresence>
        {flipped && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="flex gap-3 w-full">
            <button onClick={onDontKnow} className="flex-1 py-4 bg-red-50 text-red-600 font-semibold rounded-xl border border-red-200">모르겠어요</button>
            <button onClick={onKnow} className="flex-1 py-4 bg-green-500 text-white font-semibold rounded-xl">알겠어요</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SelfTestCard({ word, input, result, onInputChange, onSubmit, onNext }: {
  word: Word; input: string; result: 'correct' | 'wrong' | null;
  onInputChange: (v: string) => void; onSubmit: () => void; onNext: () => void;
}) {
  return (
    <div className="w-full max-w-sm flex flex-col gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-[#e5e5ea] p-8 text-center">
        <p className="text-3xl font-bold text-[#1d1d1f]">{word.word}</p>
        <p className="text-sm text-[#6e6e73] mt-2">한국어 뜻을 입력하세요</p>
      </div>
      <input type="text" value={input} onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !result) onSubmit(); }}
        disabled={result !== null} placeholder="뜻을 입력하세요"
        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[#f5f5f7]" />
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl p-4 ${result === 'correct' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`font-semibold mb-2 ${result === 'correct' ? 'text-green-700' : 'text-red-700'}`}>
              {result === 'correct' ? '✓ 정답!' : '✗ 오답'}
            </p>
            <div className="space-y-0.5">
              {word.meanings.map((m) => (
                <div key={m.id} className="flex gap-2 text-sm">
                  <span className="text-[#6e6e73] shrink-0">{m.pos}</span>
                  <span className="text-[#1d1d1f]">{m.meaning_ko}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {result === null ? (
        <button onClick={onSubmit} disabled={!input.trim()}
          className="w-full py-4 bg-[#1d1d1f] text-white font-semibold rounded-xl disabled:opacity-40">확인</button>
      ) : (
        <button onClick={onNext} className="w-full py-4 bg-gray-900 text-white font-semibold rounded-xl">다음 단어</button>
      )}
    </div>
  );
}
