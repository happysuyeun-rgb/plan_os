const QUICK_EMOJIS = ['👍', '❤️', '😀', '😂', '🎉', '✅', '❓', '👀', '🔥', '💡']

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose?: () => void
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="rounded p-1.5 text-lg hover:bg-gray-100"
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
