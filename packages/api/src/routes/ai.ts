import { Hono } from 'hono';
import type { Bindings } from '../types';
import { aiConfigRouter } from './aiConfig';
import { aiProfileRouter } from './aiProfile';
import { aiInsightsRouter } from './aiInsights';
import { aiCoachRouter } from './aiCoach';

export const aiRouter = new Hono<{ Bindings: Bindings }>();

// 聚合各个单一职责的 AI 子路由
aiRouter.route('/', aiConfigRouter);
aiRouter.route('/', aiProfileRouter);
aiRouter.route('/', aiInsightsRouter);
aiRouter.route('/', aiCoachRouter);
