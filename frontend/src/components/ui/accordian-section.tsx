import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

interface AccordionSectionProps {
  icon: React.ReactNode
  title: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

export function AccordionSection({
  icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const renderBadge = () => {
    if (!badge) return null

    // If badge is string or number → auto style it
    if (typeof badge === "string" || typeof badge === "number") {
      return (
        <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground font-medium">
          {badge}
        </span>
      )
    }

    // If badge is JSX → render as-is
    return badge
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors ${
          isOpen ? "bg-primary/10" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
            {icon}
          </span>
          <span className="font-semibold text-base text-foreground">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {renderBadge()}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isOpen && <div className="border-t border-border">{children}</div>}
    </div>
  )
}