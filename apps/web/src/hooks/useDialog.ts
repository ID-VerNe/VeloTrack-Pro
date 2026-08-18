import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/**
 * 弹层键盘无障碍：焦点陷阱 + Esc 关闭 + 初始聚焦 + 关闭后焦点返还。
 * 把返回的 ref 挂到 role="dialog" 的容器元素上。
 */
export function useDialog(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    // 记录打开前的焦点，关闭后返还给触发按钮
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // 初始聚焦：优先第一个可聚焦元素，否则聚焦容器本身
    const focusables = getFocusable(container);
    if (focusables.length > 0) focusables[0].focus();
    else container.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const items = getFocusable(container);
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  return containerRef;
}
