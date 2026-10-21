import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createHumanPlanDraft, type PlanStep, type HumanPlanDraft } from '../lib/humanPmPlanDraft'

const newStep = (): PlanStep => ({ id: crypto.randomUUID(), title: '', acceptanceCriteria: '', dependsOn: null })
export default function HumanPmPlanDraftPage() {
  const { projectId } = useParams()
  const [objective,setObjective] = useState('')
  const [steps,setSteps] = useState<PlanStep[]>([newStep()])
  const [preview,setPreview] = useState<HumanPlanDraft|null>(null)
  const [error,setError] = useState('')
  const change=(id:string, patch:Partial<PlanStep>) => { setSteps(v=>v.map(s=>s.id===id?{...s,...patch}:s));setPreview(null) }
  const submit=()=>{
    try { setPreview(createHumanPlanDraft({projectId:projectId??'',objective,steps,status:'draft'}));setError('') }
    catch(e){setError(e instanceof Error?e.message:'계획 검증에 실패했습니다.')}
  }
  return <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
    <Link className="text-sm text-indigo-700 underline" to={projectId?`/projects/${projectId}/tasks`:'/projects'}>← 프로젝트 업무</Link>
    <header><p className="text-xs font-bold text-indigo-700">F-401 · HUMAN PM MOCK</p><h1 className="mt-2 text-2xl font-bold">업무 계획 초안 작성</h1><p className="mt-2 text-sm text-amber-800">사람이 직접 만드는 임시 계획입니다. AI 생성·서버 저장·승인·업무 실행은 지원하지 않습니다. 페이지를 나가면 입력 내용이 사라집니다.</p></header>
    <label className="block font-semibold">업무 목표<textarea value={objective} maxLength={1000} rows={4} onChange={e=>{setObjective(e.target.value);setPreview(null)}} className="mt-2 block w-full rounded border p-3" placeholder="해결하려는 문제와 원하는 결과를 입력하세요."/></label>
    <section className="space-y-4" aria-label="업무 단계 편집"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">업무 단계</h2><button type="button" className="rounded border px-3 py-2" disabled={steps.length>=20} onClick={()=>{setSteps(v=>[...v,newStep()]);setPreview(null)}}>+ 단계 추가</button></div>
      {steps.map((step,index)=><article key={step.id} className="space-y-3 rounded-xl border p-4"><div className="flex justify-between"><h3 className="font-semibold">단계 {index+1}</h3><button type="button" disabled={steps.length===1} className="text-sm text-red-700 disabled:opacity-40" onClick={()=>{setSteps(v=>v.filter(s=>s.id!==step.id).map(s=>s.dependsOn===step.id?{...s,dependsOn:null}:s));setPreview(null)}}>단계 삭제</button></div>
        <label className="block text-sm">단계 제목<input value={step.title} maxLength={120} onChange={e=>change(step.id,{title:e.target.value})} className="mt-1 block w-full rounded border p-2"/></label>
        <label className="block text-sm">완료 기준<textarea value={step.acceptanceCriteria} maxLength={500} rows={2} onChange={e=>change(step.id,{acceptanceCriteria:e.target.value})} className="mt-1 block w-full rounded border p-2"/></label>
        <label className="block text-sm">선행 단계<select value={step.dependsOn??''} onChange={e=>change(step.id,{dependsOn:e.target.value||null})} className="mt-1 block w-full rounded border p-2"><option value="">없음</option>{steps.slice(0,index).map((s,i)=><option key={s.id} value={s.id}>단계 {i+1} · {s.title||'제목 미입력'}</option>)}</select></label>
      </article>)}
    </section>
    {error&&<p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
    <div className="flex gap-3"><button type="button" onClick={submit} className="rounded bg-indigo-700 px-4 py-2 font-semibold text-white">계획 초안 검토</button><button type="button" onClick={()=>{setObjective('');setSteps([newStep()]);setPreview(null);setError('')}} className="rounded border px-4 py-2">초기화</button></div>
    {preview&&<section aria-label="계획 미리보기" className="space-y-3 rounded-xl border border-green-300 bg-green-50 p-5"><h2 className="text-xl font-semibold">사람 작성 계획 초안</h2><p className="whitespace-pre-wrap">{preview.objective}</p><ol className="list-decimal space-y-3 pl-5">{preview.steps.map(s=><li key={s.id}><b>{s.title}</b><p className="text-sm">완료: {s.acceptanceCriteria}</p><p className="text-xs">선행 단계: {s.dependsOn?preview.steps.findIndex(p=>p.id===s.dependsOn)+1:'없음'}</p></li>)}</ol><p className="text-sm font-semibold">상태: draft · 미저장 · 미승인 · 실행 불가</p><button type="button" className="rounded border px-3 py-2" onClick={()=>setPreview(null)}>검토 취소</button></section>}
  </main>
}
