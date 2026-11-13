import { Button } from '../common/Button'
import { Textarea } from '../common/Textarea'

const EXAMPLE_CHIPS = [
  '음식 배달 앱',
  '온라인 강의 플랫폼',
  '반려동물 케어 SaaS',
  '지역 커뮤니티 앱',
]

type LandingHeroProps = {
  idea: string
  onIdeaChange: (value: string) => void
  onStart: () => void
  onNeedLogin: () => void
}

export function LandingHero({ idea, onIdeaChange, onStart, onNeedLogin }: LandingHeroProps) {
  return (
    <section
      aria-label="아이디어 입력"
      className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-6 py-12 md:px-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(124,58,237,0.08)_1px,transparent_0)] [background-size:28px_28px]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl -translate-y-10 flex-col items-center text-center md:-translate-y-14">
        <p className="landing-display landing-rise text-4xl font-bold tracking-tight text-brand-700 sm:text-5xl md:text-6xl">
          PlanOS
        </p>
        <h1 className="landing-display landing-rise landing-rise-delay-1 mt-5 whitespace-nowrap text-3xl font-semibold leading-snug tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
          아이디어를 기획서로, 기획서를 코드로
        </h1>
        <p className="landing-rise landing-rise-delay-2 mt-4 whitespace-nowrap text-sm leading-relaxed text-gray-500 sm:text-base">
          한 줄 아이디어로 PRD·기능명세·화면목록·정책서·Cursor 프롬프트를 바로 미리봅니다.
        </p>

        <div className="landing-rise landing-rise-delay-3 mt-6 w-full text-left">
            <Textarea
              value={idea}
              onChange={(e) => onIdeaChange(e.target.value)}
              placeholder="어떤 서비스를 만들고 싶으신가요?"
              className="h-28 border-gray-200 bg-white"
            />

            <div className="mt-4 flex flex-col items-center gap-2">
            <Button
              disabled={!idea.trim()}
              onClick={onStart}
              className="min-w-[16rem] px-10 py-3 text-base sm:min-w-[20rem]"
            >
              무료로 체험하기
            </Button>
            <button
              type="button"
              onClick={onNeedLogin}
              className="text-sm text-brand-600 underline-offset-2 hover:underline"
            >
              저장하려면 로그인이 필요해요
            </button>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {EXAMPLE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onIdeaChange(chip)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
