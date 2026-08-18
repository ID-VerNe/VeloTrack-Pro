import React from 'react';

/**
 * 统一图标按钮：保障最小点击热区、键盘焦点可见、读屏标签。
 * - sm (32px)：密集工具栏；md (36px)：常规；lg (44px)：满足 WCAG 2.5.5 AAA 推荐尺寸
 * - label 必填，同时作为 aria-label 与 title，杜绝无标签图标按钮
 */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 必填：无障碍标签与悬浮提示共用 */
  label: string;
  /** 尺寸档位：xs=24px(AA下限，仅限行内小胶囊) / sm=32px 密集工具栏 / md=36px 常规 / lg=44px(AAA推荐) */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** 危险操作样式（删除等），hover 变红 */
  danger?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<IconButtonProps['size']>, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
};

export default function IconButton({
  label,
  size = 'md',
  danger = false,
  className = '',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`
        inline-flex shrink-0 items-center justify-center rounded-lg
        ${SIZE_CLASSES[size]}
        transition-colors duration-150 cursor-pointer
        ${
          danger
            ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }
        focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60
        disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500
        ${className}
      `}
      {...rest}
    >
      {children}
    </button>
  );
}
