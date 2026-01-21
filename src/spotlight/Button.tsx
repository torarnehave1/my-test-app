import { cx } from './cx';

const variantStyles = {
  primary:
    'bg-zinc-100 text-zinc-900 hover:bg-white active:bg-zinc-100/80',
  secondary:
    'bg-white/10 text-white hover:bg-white/20 active:bg-white/10',
};

type ButtonProps = {
  variant?: keyof typeof variantStyles;
  href?: string;
} & React.ComponentPropsWithoutRef<'button'>;

export function Button({
  variant = 'primary',
  className,
  href,
  ...props
}: ButtonProps) {
  const classes = cx(
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition',
    variantStyles[variant],
    className
  );

  if (href) {
    return (
      <a className={classes} href={href}>
        {props.children}
      </a>
    );
  }

  return <button className={classes} {...props} />;
}
