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
        <h1 className="text-xl font-bold text-gray-900">어휘 관리</h1>
        <p className="text-sm text-gray-500 mt-1">단어별 의미·동의어 편집 및 AI 일괄 생성</p>
      </div>

      <VocabularyManager day={day} words={words} totalDays={60} />
    </div>
  );
}
