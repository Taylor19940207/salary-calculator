import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { timingSafeEqual } from 'crypto';
import { calculateSalary } from './services/salaryCalculator.js';
import { calculateBonus } from './services/bonusCalculator.js';
import { getPrefectures, getInsuranceRates, getGrades } from './db/queries.js';
import { ensureDatabase } from './db/setup.js';
import batchRoutes from './routes/batch.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Basic認証（BASIC_AUTH_USER / BASIC_AUTH_PASS を設定した場合のみ有効）
const AUTH_USER = process.env.BASIC_AUTH_USER;
const AUTH_PASS = process.env.BASIC_AUTH_PASS;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

if (AUTH_USER && AUTH_PASS) {
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();

    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [user, ...passParts] = Buffer.from(encoded, 'base64').toString().split(':');
      const pass = passParts.join(':');
      if (safeEqual(user, AUTH_USER) && safeEqual(pass, AUTH_PASS)) {
        return next();
      }
    }
    res.set('WWW-Authenticate', 'Basic realm="salary-calculator", charset="UTF-8"');
    res.status(401).send('Authentication required');
  });
}

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 都道府県一覧
app.get('/api/prefectures', async (req, res) => {
  try {
    const prefectures = await getPrefectures();
    res.json(prefectures);
  } catch (error) {
    console.error('Error fetching prefectures:', error);
    res.status(500).json({ error: 'Failed to fetch prefectures' });
  }
});

// 標準報酬月額等級表（手動選択UI用）
app.get('/api/grades', async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const grades = await getGrades(date);
    res.json(grades);
  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({ error: 'Failed to fetch grades' });
  }
});

// 保険料率取得
app.get('/api/rates', async (req, res) => {
  try {
    const { prefecture, date } = req.query;

    if (!prefecture || !date) {
      return res.status(400).json({ error: 'prefecture and date are required' });
    }

    const targetDate = new Date(date as string);
    const rates = await getInsuranceRates(prefecture as string, targetDate);

    res.json(rates);
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

// 給与計算
const SalaryInputSchema = z.object({
  salaryType: z.enum(['monthly', 'hourly']),
  baseSalary: z.number().optional(),
  hourlyWage: z.number().optional(),
  totalWorkHours: z.number().optional(),
  commutingAllowance: z.number().default(0),
  businessTripAllowance: z.number().min(0).optional(),
  performancePay: z.number().min(0).optional(),
  otherAllowances: z.number().default(0),
  prefecture: z.string(),
  salaryMonth: z.string().regex(/^\d{4}-\d{2}$/),
  age: z.number().min(15).max(100),
  dependents: z.number().min(0).default(0),
  enrollInInsurance: z.boolean().default(true),
  overtime: z.object({
    regular: z.number().default(0),
    holiday: z.number().default(0),
    night: z.number().default(0),
  }).optional(),
  absenceDays: z.number().optional(),
  scheduledMonthlyHours: z.number().min(1).max(250).optional(), // 月所定労働時間（省略時160h）
  manualGrade: z.number().int().min(1).max(50).optional(),      // 社保等級の手動指定
  residentTax: z.number().min(0).optional(),                    // 住民税（特別徴収・月額、決定通知書の転記）
});

app.post('/api/calculate', async (req, res) => {
  try {
    const input = SalaryInputSchema.parse(req.body);

    // バリデーション
    if (input.salaryType === 'monthly' && !input.baseSalary) {
      return res.status(400).json({ error: 'baseSalary is required for monthly salary type' });
    }

    if (input.salaryType === 'hourly' && (!input.hourlyWage || !input.totalWorkHours)) {
      return res.status(400).json({ error: 'hourlyWage and totalWorkHours are required for hourly salary type' });
    }

    const result = await calculateSalary(input);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }

    console.error('Error calculating salary:', error);
    res.status(500).json({ error: 'Failed to calculate salary' });
  }
});

// 賞与（ボーナス）計算
const BonusInputSchema = z.object({
  bonusAmount: z.number().min(0),
  prevMonthAfterInsurance: z.number().min(0).default(0),
  prefecture: z.string(),
  salaryMonth: z.string().regex(/^\d{4}-\d{2}$/),
  age: z.number().min(15).max(100),
  dependents: z.number().min(0).default(0),
  enrollInInsurance: z.boolean().default(true),
  priorFiscalBonusTotal: z.number().min(0).optional(),
  bonusCalcMonths: z.number().int().min(1).max(12).optional(),
});

app.post('/api/calculate-bonus', async (req, res) => {
  try {
    const input = BonusInputSchema.parse(req.body);
    const result = await calculateBonus(input);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error calculating bonus:', error);
    res.status(500).json({ error: 'Failed to calculate bonus' });
  }
});

// 批量計算路由
app.use('/api', batchRoutes);

// 本番環境: フロントエンドのビルド成果物を配信
const frontendDist = join(__dirname, '../../frontend/dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(join(frontendDist, 'index.html'));
  });
}

async function start() {
  await ensureDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    if (AUTH_USER && AUTH_PASS) {
      console.log('🔒 Basic auth enabled');
    }
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
