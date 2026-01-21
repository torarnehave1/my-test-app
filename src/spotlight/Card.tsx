import { cx } from './cx';

function ChevronRightIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M6.75 5.75 9.25 8l-2.5 2.25"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Card<T extends React.ElementType = 'div'>({
  as,
  className,
  children,
}: Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className'> & {
  as?: T;
  className?: string;
}) {
  const Component = as ?? 'div';

  return (
    <Component className={cx('group relative flex flex-col items-start', className)}>
      {children}
    </Component>
  );
}

Card.Link = function CardLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <>
      <div className="absolute -inset-x-4 -inset-y-6 z-0 scale-95 rounded-2xl bg-white/5 opacity-0 transition group-hover:scale-100 group-hover:opacity-100" />
      <a href={href}>
        <span className="absolute -inset-x-4 -inset-y-6 z-20 rounded-2xl" />
        <span className="relative z-10">{children}</span>
      </a>
    </>
  );
};

Card.Title = function CardTitle<T extends React.ElementType = 'h2'>({
  as,
  href,
  children,
}: Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'href'> & {
  as?: T;
  href?: string;
}) {
  const Component = as ?? 'h2';

  return (
    <Component className="text-base font-semibold tracking-tight text-zinc-100">
      {href ? <Card.Link href={href}>{children}</Card.Link> : children}
    </Component>
  );
};

Card.Description = function CardDescription({
  children,
}: {
  children: React.ReactNode;
}) {
  return <p className="relative z-10 mt-2 text-sm text-zinc-400">{children}</p>;
};

Card.Cta = function CardCta({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="relative z-10 mt-4 flex items-center text-sm font-medium text-sky-300"
    >
      {children}
      <ChevronRightIcon className="ml-1 h-4 w-4 stroke-current" />
    </div>
  );
};
