import type { ReactNode } from "react";

/** A flat settings section (title + optional description + body), used inside
 * the settings dialog's content pane instead of nested cards. */
export function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title?: string;
  description?: string;
  /** Optional control rendered at the right end of the title row. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {title && <h2 className="text-base leading-none font-semibold">{title}</h2>}
            {description && (
              <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
            )}
          </div>
          {action && <div className="ml-auto shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
