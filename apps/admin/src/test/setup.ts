/**
 * 全局测试环境：注册 jest-dom 匹配器 + RTL 每用例自动清理
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
