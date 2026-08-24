type SkeletonProps = {
  className?: string;
  width?: string | number;
  height?: string | number;
};

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  const style: Record<string, string | number> = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`skeleton ${className}`}
      style={style}
    />
  );
}
