import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export default function GlassHeading({ icon: Icon, label, title, description, action, className = "" }: {
  icon: LucideIcon;
  label?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return <header className={`glass-heading ${className}`}>
    <span className="glass-heading-icon"><Icon size={25} aria-hidden="true" /></span>
    <div className="glass-heading-copy">
      {label && <span className="glass-eyebrow">{label}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {action && <div className="glass-heading-action">{action}</div>}
  </header>;
}
