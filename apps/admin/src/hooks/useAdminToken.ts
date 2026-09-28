import { useState } from 'react';
import { getAdminToken, setAdminToken as persistAdminToken } from '../utils/apiClient';

/**
 * 管理令牌状态 + 保存 Hook
 */
export function useAdminToken() {
  const [adminToken, setAdminTokenState] = useState(getAdminToken());
  const [showTokenInput, setShowTokenInput] = useState(false);

  const saveToken = (token: string, onSaved?: () => void) => {
    persistAdminToken(token.trim());
    setShowTokenInput(false);
    onSaved?.();
  };

  return {
    adminToken,
    setAdminTokenState,
    showTokenInput,
    setShowTokenInput,
    saveToken,
  };
}
