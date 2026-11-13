const STEPS = [
  {
    title: '아이디어 입력',
    body: '만들고 싶은 서비스를 한두 문장으로 적습니다. 예시 칩으로도 시작할 수 있습니다.',
  },
  {
    title: '짧은 인터뷰',
    body: '서비스 유형·대상 사용자 등 몇 가지만 답하면 됩니다. 전부 건너뛰어도 됩니다.',
  },
  {
    title: '산출물 생성',
    body: 'PRD부터 Cursor 프롬프트까지 순서대로 미리보기 문서를 만듭니다.',
  },
  {
    title: '미리보기 · ZIP',
    body: '결과를 바로 읽고, 필요하면 ZIP으로 받아 둡니다. 저장·편집은 로그인 후입니다.',
  },
]

export function LandingHowItWorks() {
  return (
    <section
      aria-labelledby="landing-how-heading"
      className="border-t border-gray-100 bg-brand-50/40 px-6 py-20 md:px-10"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          id="landing-how-heading"
          className="landing-display text-center text-4xl font-semibold tracking-tight text-gray-900 md:text-6xl"
        >
          어떻게 쓰나요
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-gray-500 md:text-base">
          가입 없이 한 번 체험하고, 마음에 들면 로그인해서 프로젝트로 이어갑니다.
        </p>

        <ol className="mt-12 grid gap-10 md:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden
                className="landing-display mt-0.5 text-3xl font-bold tabular-nums text-brand-600/80"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="landing-display text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
