const DELIVERABLES = [
  {
    name: 'PRD',
    blurb: '문제·목표 사용자·핵심 기능을 한 장으로 정리합니다.',
  },
  {
    name: '기능명세서',
    blurb: '화면별 동작·예외·수용 기준을 빠짐없이 적습니다.',
  },
  {
    name: '화면목록',
    blurb: '필요한 화면과 흐름을 목록으로 펼칩니다.',
  },
  {
    name: '정책서',
    blurb: '약관·운영 규칙 초안을 서비스 맥락에 맞춰 씁니다.',
  },
  {
    name: 'Cursor 프롬프트',
    blurb: '구현에 바로 넣을 수 있는 개발 지시문을 만듭니다.',
  },
]

export function LandingValueStrip() {
  return (
    <section
      aria-labelledby="landing-deliverables-heading"
      className="border-t border-gray-100 px-6 py-20 md:px-10"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          id="landing-deliverables-heading"
          className="landing-display text-center text-4xl font-semibold tracking-tight text-gray-900 md:text-6xl"
        >
          무엇을 만드나요
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-gray-500 md:text-base">
          PlanOS는 아이디어를 개발에 넘길 수 있는 기획 산출물 세트로 바꿉니다.
        </p>

        <ol className="mt-12 space-y-0 divide-y divide-gray-100 border-y border-gray-100">
          {DELIVERABLES.map((item, index) => (
            <li
              key={item.name}
              className="grid gap-2 py-5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-baseline sm:gap-8"
            >
              <span className="landing-display text-sm font-semibold text-brand-700">
                {String(index + 1).padStart(2, '0')} · {item.name}
              </span>
              <span className="text-sm leading-relaxed text-gray-600 md:text-base">{item.blurb}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
