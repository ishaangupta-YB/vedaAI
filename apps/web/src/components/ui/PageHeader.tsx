/** Section header with the signature green status dot from the Figma screens. */
export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}): React.ReactNode {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-[0.45rem] size-2.5 shrink-0 rounded-full bg-status ring-4 ring-status/15" />
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}
