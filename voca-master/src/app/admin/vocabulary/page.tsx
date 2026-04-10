import { getVocabularyByDay } from '@/app/actions/vocabulary';
import VocabularyManager from '@/components/admin/VocabularyManager';

export default async function VocabularyPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const params = await searchParams;
  const day = Math.max(1, Math.min(60, parseInt(params.day ?? '1') || 1));

  const words = await getVocabularyByDay(day);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">어휘 관리</h1>
        <p className="text-[13px] text-[#6e6e73] mt-0.5">단어별 의미·동의어 편집 및 AI 일괄 생성</p>
      </div>

      <VocabularyManager day={day} words={words} totalDays={60} />
    </div>
  );
}
