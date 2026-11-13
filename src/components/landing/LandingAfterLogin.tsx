import { Button } from '../common/Button'

type LandingAfterLoginProps = {
  onStart: () => void
}

export function LandingAfterLogin({ onStart }: LandingAfterLoginProps) {
  return (
    <section
      aria-labelledby="landing-after-login-heading"
      className="border-t border-gray-100 px-6 py-20 md:px-10"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <h2
            id="landing-after-login-heading"
            className="landing-display text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl"
          >
            로그인 후에는
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-500 md:text-base">
            산출물을 프로젝트에 저장하고, 멤버와 함께 문서를 다듬으며, 업무·AI 직원 시안까지 이어서
            살펴볼 수 있습니다. 실제 계약·과금·유료 모델 실행은 별도 승인 전까지 열리지 않습니다.
          </p>
        </div>
        <Button onClick={onStart} className="shrink-0 px-6 py-3">
          시작하기
        </Button>
      </div>
      <footer className="mx-auto mt-16 max-w-6xl border-t border-gray-100 pt-8 text-xs text-gray-400">
        © PlanOS · 비로그인 체험은 미리보기용이며 서버에 자동 저장되지 않습니다.
      </footer>
    </section>
  )
}
