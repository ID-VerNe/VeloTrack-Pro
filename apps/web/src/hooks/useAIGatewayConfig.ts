// apps/web/src/hooks/useAIGatewayConfig.ts
//
// AI 网关与模型配置状态机 Hook
// 遵循单一职责（SRP）原则，集中管理网关端点、模型名、凭证存储、管理令牌以及联通性测试。

import { useState, useEffect, useCallback } from 'react';
import type { AIConfig } from '../services/aiClient';
import {
  getGatewayKey,
  setGatewayKey,
  getAIConfig,
  updateAIConfig,
  testGatewayConnection,
} from '../services/aiClient';
import { getAdminToken, setAdminToken } from '../utils/activity/adminApiClient';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export interface UseAIGatewayConfigOptions {
  onConfigUpdated?: (config: AIConfig) => void;
}

export function useAIGatewayConfig({ onConfigUpdated }: UseAIGatewayConfigOptions = {}) {
  const [baseUrl, setBaseUrl] = useState('');
  const [modelName, setModelName] = useState('glm-5.2');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // 管理令牌（ADMIN_TOKEN）
  const [adminToken, setAdminTokenState] = useState('');
  const [showAdminToken, setShowAdminToken] = useState(false);
  const [adminTokenSaved, setAdminTokenSaved] = useState(false);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // 挂载时拉后端配置 + 读 localStorage 的 key 与 adminToken
  useEffect(() => {
    getAIConfig()
      .then((cfg) => {
        setBaseUrl(cfg.base_url || '');
        setModelName(cfg.model_name || 'glm-5.2');
        onConfigUpdated?.(cfg);
      })
      .catch((err) => {
        setSaveError(err.message || '读取配置失败');
        setSaveStatus('error');
      });
    setApiKey(getGatewayKey());
    setAdminTokenState(getAdminToken());
  }, [onConfigUpdated]);

  const handleSaveAdminToken = useCallback(() => {
    setAdminToken(adminToken.trim());
    setAdminTokenSaved(true);
    setTimeout(() => setAdminTokenSaved(false), 2000);
  }, [adminToken]);

  const handleSaveConfig = useCallback(async () => {
    setSaveStatus('saving');
    setSaveError('');
    try {
      const cfg: AIConfig = { base_url: baseUrl.trim(), model_name: modelName.trim() };
      await updateAIConfig(cfg);
      onConfigUpdated?.(cfg);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err.message || '保存失败');
      setTimeout(() => setSaveStatus('idle'), 3500);
    }
  }, [baseUrl, modelName, onConfigUpdated]);

  const handleSaveKey = useCallback(() => {
    setGatewayKey(apiKey.trim());
    setSaveStatus('saved');
    setSaveError('');
    setTimeout(() => setSaveStatus('idle'), 2500);
  }, [apiKey]);

  const handleTestConnection = useCallback(async () => {
    setTestStatus('testing');
    setTestMessage('');
    setAvailableModels([]);
    try {
      const cfg: AIConfig = { base_url: baseUrl.trim(), model_name: modelName.trim() };
      const keyToTest = apiKey.trim();
      setGatewayKey(keyToTest);
      const models = await testGatewayConnection(cfg, keyToTest);
      setAvailableModels(models);
      const inList = models.length === 0 || models.includes(modelName.trim());
      if (inList) {
        setTestStatus('success');
        setTestMessage(
          `连通正常，Gateway 返回 ${models.length} 个可用模型${models.length ? '：' + models.join('、') : ''}`,
        );
      } else {
        setTestStatus('error');
        setTestMessage(
          `连通正常，但当前模型 ${modelName} 不在可用列表 [${models.join('、')}] 中，请检查模型名`,
        );
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || '连通测试失败');
    }
  }, [apiKey, baseUrl, modelName]);

  return {
    baseUrl,
    setBaseUrl,
    modelName,
    setModelName,
    apiKey,
    setApiKey,
    showKey,
    setShowKey,
    adminToken,
    setAdminTokenState,
    showAdminToken,
    setShowAdminToken,
    adminTokenSaved,
    saveStatus,
    saveError,
    testStatus,
    testMessage,
    availableModels,
    handleSaveAdminToken,
    handleSaveConfig,
    handleSaveKey,
    handleTestConnection,
  };
}
