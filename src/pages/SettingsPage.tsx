import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, CreditCard, Pencil, Trash2, UserRound } from 'lucide-react'
import { Button } from '../components/common/Button'
import { UpgradeModal } from '../components/common/UpgradeModal'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { useAuthStore } from '../store/authStore'
import { usePlanStore } from '../store/planStore'
import { useUIStore } from '../store/uiStore'
import {
  AVATAR_ALLOWED_MIME,
  deleteAccount as apiDeleteAccount,
  getAuthErrorMessage,
  isDisplayableAvatarUrl,
  validateAvatarFile,
} from '../lib/api/auth'
import { cn } from '../lib/utils'

type Tab = 'profile' | 'plan'

const settingsNavItems: {
  key: Tab | 'trash'
  label: string
  icon: typeof UserRound
}[] = [
  { key: 'profile', label: '마이프로필', icon: UserRound },
  { key: 'plan', label: '플랜', icon: CreditCard },
  { key: 'trash', label: '휴지통', icon: Trash2 },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const avatarInputId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const user = useAuthStore((s) => s.user)!
  const signOut = useAuthStore((s) => s.signOut)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const getRemainingGenerations = usePlanStore((s) => s.getRemainingGenerations)
  const showToast = useUIStore((s) => s.showToast)

  const [tab, setTab] = useState<Tab>('profile')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [name, setName] = useState(user.name)
  const [isEditingName, setIsEditingName] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewOverride, setPreviewOverride] = useState<string | null>(null)
  const [clearAvatar, setClearAvatar] = useState(false)
  const [nameError, setNameError] = useState<string | undefined>()
  const [avatarError, setAvatarError] = useState<string | undefined>()
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isEditingName) return
    nameInputRef.current?.focus()
    nameInputRef.current?.select()
  }, [isEditingName])

  const remaining = getRemainingGenerations()
  const previewInitial = (name.trim() || user.name || '?').charAt(0)
  const previewUrl = clearAvatar
    ? ''
    : (previewOverride ?? (isDisplayableAvatarUrl(user.avatar_url) ? user.avatar_url : ''))
  const isDirty =
    name.trim() !== user.name || avatarFile !== null || clearAvatar

  const enterNameEdit = () => {
    setNameError(undefined)
    setIsEditingName(true)
  }

  const cancelNameEdit = () => {
    setName(user.name)
    setNameError(undefined)
    setIsEditingName(false)
  }

  const handleSignOut = async () => {
    await signOut()
    showToast('info', '로그아웃되었습니다')
    navigate('/login')
  }

  const handleDeleteAccount = async () => {
    try {
      await apiDeleteAccount(user.id)
      await signOut()
      showToast('success', '계정이 삭제되었습니다')
      setShowDeleteModal(false)
      navigate('/')
    } catch {
      showToast('error', '계정 삭제에 실패했습니다')
      setShowDeleteModal(false)
    }
  }

  const handleAvatarPick = (file: File | null) => {
    setAvatarError(undefined)
    if (!file) return

    const error = validateAvatarFile(file)
    if (error) {
      setAvatarError(error)
      return
    }

    if (previewOverride?.startsWith('blob:')) {
      URL.revokeObjectURL(previewOverride)
    }
    setAvatarFile(file)
    setClearAvatar(false)
    setPreviewOverride(URL.createObjectURL(file))
  }

  const handleClearAvatar = () => {
    if (previewOverride?.startsWith('blob:')) {
      URL.revokeObjectURL(previewOverride)
    }
    setAvatarFile(null)
    setPreviewOverride(null)
    setClearAvatar(Boolean(user.avatar_url))
    setAvatarError(undefined)
  }

  const handleSaveProfile = async () => {
    setNameError(undefined)
    setAvatarError(undefined)

    const trimmedName = name.trim()
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      setNameError('이름은 1~50자로 입력해주세요')
      setIsEditingName(true)
      return
    }

    setIsSaving(true)
    try {
      await updateProfile({
        name: trimmedName,
        avatarFile,
        clearAvatar,
      })
      if (previewOverride?.startsWith('blob:')) {
        URL.revokeObjectURL(previewOverride)
      }
      setAvatarFile(null)
      setPreviewOverride(null)
      setClearAvatar(false)
      setIsEditingName(false)
      showToast('success', '프로필이 저장되었습니다')
    } catch (error) {
      showToast('error', getAuthErrorMessage(error) || '프로필 저장에 실패했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex gap-8">
      <aside className="w-40 shrink-0">
        <nav className="space-y-1" data-testid="settings-side-nav">
          {settingsNavItems.map(({ key, label, icon: Icon }) => {
            const itemClass = cn(
              'flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm font-medium',
              key !== 'trash' && tab === key
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-600 hover:bg-gray-50',
            )

            if (key === 'trash') {
              return (
                <Link
                  key={key}
                  to="/projects/trash"
                  className={itemClass}
                  data-testid="settings-trash-link"
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {label}
                </Link>
              )
            }

            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={itemClass}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="flex-1">
        <h1 className="text-2xl font-bold text-gray-900">설정 · 마이프로필</h1>

        {tab === 'profile' && (
          <>
            <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
              <input
                id={avatarInputId}
                type="file"
                accept={AVATAR_ALLOWED_MIME.join(',')}
                className="sr-only"
                data-testid="settings-avatar-file-input"
                onChange={(e) => {
                  handleAvatarPick(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => document.getElementById(avatarInputId)?.click()}
                  className="relative h-16 w-16 shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  aria-label="프로필 이미지 선택"
                  title="프로필 이미지 선택"
                  data-testid="settings-avatar-pick"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt=""
                      className="h-16 w-16 rounded-full object-cover"
                      data-testid="settings-avatar-preview"
                    />
                  ) : (
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700"
                      data-testid="settings-avatar-preview"
                    >
                      {previewInitial}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-gray-900 text-white shadow-sm">
                    <Camera className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  {isEditingName ? (
                    <div>
                      <input
                        ref={nameInputRef}
                        value={name}
                        maxLength={50}
                        onChange={(e) => {
                          setName(e.target.value)
                          setNameError(undefined)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            cancelNameEdit()
                          }
                        }}
                        className={cn(
                          'w-full max-w-xs rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-900 outline-none',
                          'focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
                          nameError ? 'border-red-400' : 'border-gray-200',
                        )}
                        aria-label="표시 이름"
                        data-testid="settings-name-input"
                      />
                      {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
                      <p className="mt-1 text-xs text-gray-500">Esc로 취소 · 저장은 아래 버튼</p>
                    </div>
                  ) : (
                    <div
                      className="inline-flex max-w-full cursor-default items-center gap-1.5"
                      onDoubleClick={enterNameEdit}
                      title="더블클릭하여 이름 편집"
                      data-testid="settings-name-display"
                    >
                      <p className="truncate font-medium text-gray-900">
                        {name.trim() || user.name}
                      </p>
                      <Pencil
                        className="h-3.5 w-3.5 shrink-0 text-gray-500"
                        aria-hidden
                        data-testid="settings-name-pencil"
                      />
                    </div>
                  )}
                  <p className="mt-0.5 text-sm text-gray-500">{user.email}</p>
                  {(previewUrl || user.avatar_url) && !clearAvatar && (
                    <button
                      type="button"
                      onClick={handleClearAvatar}
                      className="mt-1 text-xs text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
                      data-testid="settings-avatar-clear"
                    >
                      사진 제거
                    </button>
                  )}
                  {avatarError && <p className="mt-1 text-xs text-red-500">{avatarError}</p>}
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <Button
                  onClick={handleSaveProfile}
                  disabled={!isDirty || isSaving}
                  className="w-72"
                  data-testid="settings-profile-save"
                >
                  {isSaving ? '저장 중…' : '프로필 저장'}
                </Button>
              </div>

              <div className="mt-6 flex justify-end border-t border-gray-100 pt-6">
                <Button variant="ghost" onClick={handleSignOut}>로그아웃</Button>
              </div>
            </div>

            <div className="mt-4 flex justify-end px-1">
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="text-sm font-medium text-gray-800 hover:text-gray-950"
                data-testid="settings-delete-account"
              >
                계정 삭제
              </button>
            </div>
          </>
        )}

        {tab === 'plan' && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium capitalize">
                  {user.plan} 플랜
                </span>
                <p className="mt-2 text-sm text-gray-500">
                  AI 생성: {user.ai_generations_this_month}/
                  {remaining === 'unlimited' ? '무제한' : '10'}회 (이번 달)
                </p>
              </div>
              <Button onClick={() => setShowUpgrade(true)}>업그레이드</Button>
            </div>
            {remaining !== 'unlimited' && (
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{ width: `${(user.ai_generations_this_month / 10) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <ConfirmModal
        isOpen={showDeleteModal}
        title="계정 삭제"
        message="모든 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        danger
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  )
}
