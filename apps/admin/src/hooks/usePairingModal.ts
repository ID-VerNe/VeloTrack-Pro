import { useState } from 'react';

/**
 * 配对移动端弹窗开关 Hook
 */
export function usePairingModal() {
  const [showPairingModal, setShowPairingModal] = useState(false);
  return { showPairingModal, setShowPairingModal };
}
