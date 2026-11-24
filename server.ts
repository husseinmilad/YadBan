import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const ALLOWED_PROVIDERS = new Set(['auto', 'chatgpt', 'deepseek']);
const VALID_CATEGORIES = new Set([
  'work',
  'health',
  'phone',
  'errand',
  'anchor',
  'fitness',
  'idea',
]);

type ResolvedProvider = 'chatgpt' | 'deepseek';
type RequestedProvider = 'auto' | ResolvedProvider;

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DEEPSEEK_CHAT_COMPLETIONS_URL = 'https://api.deepseek.com/chat/completions';

function resolveProviderConfig(requested: RequestedProvider): {
  provider: ResolvedProvider;
  endpointUrl: string;
  apiKey: string;
  model: string;
} {
  const openAiKey = (process.env.OPENAI_API_KEY || '').trim();
  const deepSeekKey = (process.env.DEEPSEEK_API_KEY || '').trim();

  const openAiModel = (process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini').trim();
  const deepSeekModel = (process.env.DEEPSEEK_VISION_MODEL || 'deepseek-flash').trim();

  if (requested === 'chatgpt') {
    if (!openAiKey) {
      throw new Error('MISSING_OPENAI_API_KEY');
    }
    return {
      provider: 'chatgpt',
      endpointUrl: OPENAI_CHAT_COMPLETIONS_URL,
      apiKey: openAiKey,
      model: openAiModel,
    };
  }

  if (requested === 'deepseek') {
    if (!deepSeekKey) {
      throw new Error('MISSING_DEEPSEEK_API_KEY');
    }
    return {
      provider: 'deepseek',
      endpointUrl: DEEPSEEK_CHAT_COMPLETIONS_URL,
      apiKey: deepSeekKey,
      model: deepSeekModel,
    };
  }

  if (openAiKey) {
    return {
      provider: 'chatgpt',
      endpointUrl: OPENAI_CHAT_COMPLETIONS_URL,
      apiKey: openAiKey,
      model: openAiModel,
    };
  }

  if (deepSeekKey) {
    return {
      provider: 'deepseek',
      endpointUrl: DEEPSEEK_CHAT_COMPLETIONS_URL,
      apiKey: deepSeekKey,
      model: deepSeekModel,
    };
  }

  throw new Error('MISSING_ALL_AI_KEYS');
}

function parseModelJson(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const sliced = JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as unknown;
        return sliced && typeof sliced === 'object' && !Array.isArray(sliced)
          ? (sliced as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    return {};
  }
}

async function startServer() {
  const app = express();

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/ai/read-image', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        imageBase64?: unknown;
        mimeType?: unknown;
        provider?: unknown;
      };

      if (typeof body?.imageBase64 !== 'string' || !body.imageBase64.trim()) {
        res.status(400).json({ error: 'داده‌های تصویر ارسال نشده است.' });
        return;
      }

      const rawBase64 = body.imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
      if (rawBase64.length > 14 * 1024 * 1024) {
        res.status(413).json({ error: 'حجم تصویر بیش از حد مجاز است.' });
        return;
      }
      if (!/^[A-Za-z0-9+/=\s]+$/.test(rawBase64)) {
        res.status(400).json({ error: 'فرمت داده‌های تصویر معتبر نیست.' });
        return;
      }

      const mimeType =
        typeof body.mimeType === 'string' && ALLOWED_MIME_TYPES.has(body.mimeType.toLowerCase())
          ? body.mimeType.toLowerCase()
          : 'image/jpeg';

      const requestedProvider: RequestedProvider =
        typeof body.provider === 'string' && ALLOWED_PROVIDERS.has(body.provider)
          ? (body.provider as RequestedProvider)
          : 'auto';

      const { provider, endpointUrl, apiKey, model } = resolveProviderConfig(requestedProvider);

      const systemInstruction = [
        'تو دستیار هوشمند فارسی اپلیکیشن «یادبان» هستی.',
        'وظیفه تو خواندن دقیق تمام متن‌های داخل تصویر (برگه کاغذی، یادداشت دست‌نویس، نسخه دارو، کارت ویزیت، قبض، رسید بانکی، بسته کالا یا عکس محل قرارگیری وسیله) و استخراج ساختاریافته اطلاعات است.',
        'خروجی باید فقط یک شیء JSON معتبر (بدون توضیح اضافه و بدون markdown) با دقیقاً همین کلیدها باشد:',
        '{',
        '  "extractedText": "متن کامل و دقیق خوانده‌شده از تصویر با حفظ سطرهای مهم",',
        '  "title": "عنوان کوتاه، طبیعی و کاربردی به فارسی برای ثبت کار، یادآور، دارو، شماره یا مکان وسیله",',
        '  "category": "فقط یکی از: work | health | phone | errand | anchor | fitness | idea",',
        '  "timeStr": "اگر ساعت مشخص در متن بود به فرمت HH:MM مثل 08:30 وگرنه رشته خالی",',
        '  "dateHint": "اگر اشاره به زمان یا تاریخ وجود دارد مثل امروز، فردا یا تاریخ متن، وگرنه رشته خالی",',
        '  "phoneNumber": "فقط ارقام شماره تلفن یا موبایل اگر در تصویر بود، وگرنه رشته خالی",',
        '  "contactName": "نام شخص، پزشک، شرکت یا فروشگاه اگر مشخص بود، وگرنه رشته خالی",',
        '  "locationHint": "نشانی، محل نگهداری وسیله یا مکان درج‌شده در تصویر، وگرنه رشته خالی",',
        '  "dosage": "مقدار یا دوز مصرف دارو اگر نسخه یا دارو بود، وگرنه رشته خالی",',
        '  "notes": "خلاصه نکات مهم تصویر، مبلغ قبض، کد پیگیری یا دستور مصرف"',
        '}',
      ].join('\n');

      const upstreamRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: systemInstruction,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'متن روی این تصویر را با دقت بخوان، استخراج کن و اطلاعات ساختاریافته آن را برای ثبت کار، یادآور، تماس، دارو یا محل وسیله به صورت JSON برگردان.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${rawBase64}`,
                    detail: 'auto',
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!upstreamRes.ok) {
        const providerLabel = provider === 'chatgpt' ? 'ChatGPT' : 'DeepSeek';
        const status = upstreamRes.status;
        console.error(`${providerLabel} image read HTTP error:`, status);

        if (status === 401 || status === 403) {
          res.status(502).json({
            error: `کلید ${providerLabel} نامعتبر است یا دسترسی آن رد شد. کلید را در Settings > Secrets بررسی کنید.`,
          });
          return;
        }
        if (status === 429) {
          res.status(429).json({
            error: `سقف درخواست یا اعتبار حساب ${providerLabel} تکمیل شده است. کمی بعد دوباره امتحان کنید.`,
          });
          return;
        }
        res.status(502).json({
          error: `سرویس ${providerLabel} نتوانست تصویر را پردازش کند (کد ${status}). لطفاً دوباره تلاش کنید.`,
        });
        return;
      }

      const completion = (await upstreamRes.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
      };

      const rawContent = completion?.choices?.[0]?.message?.content;
      const parsed = parseModelJson(typeof rawContent === 'string' ? rawContent : '{}');
      const category =
        typeof parsed.category === 'string' && VALID_CATEGORIES.has(parsed.category)
          ? parsed.category
          : 'work';

      res.json({
        extractedText: typeof parsed.extractedText === 'string' ? parsed.extractedText : '',
        title: typeof parsed.title === 'string' ? parsed.title : '',
        category,
        timeStr: typeof parsed.timeStr === 'string' ? parsed.timeStr : '',
        dateHint: typeof parsed.dateHint === 'string' ? parsed.dateHint : '',
        phoneNumber: typeof parsed.phoneNumber === 'string' ? parsed.phoneNumber : '',
        contactName: typeof parsed.contactName === 'string' ? parsed.contactName : '',
        locationHint: typeof parsed.locationHint === 'string' ? parsed.locationHint : '',
        dosage: typeof parsed.dosage === 'string' ? parsed.dosage : '',
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        providerUsed: provider,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'MISSING_OPENAI_API_KEY') {
        res.status(500).json({
          error: 'کلید ChatGPT (OPENAI_API_KEY) در Settings > Secrets سرور تعریف نشده است.',
        });
        return;
      }
      if (msg === 'MISSING_DEEPSEEK_API_KEY') {
        res.status(500).json({
          error: 'کلید DeepSeek (DEEPSEEK_API_KEY) در Settings > Secrets سرور تعریف نشده است.',
        });
        return;
      }
      if (msg === 'MISSING_ALL_AI_KEYS') {
        res.status(500).json({
          error:
            'هیچ کلید هوش مصنوعی تنظیم نشده است. لطفاً کلید OPENAI_API_KEY (برای ChatGPT) یا DEEPSEEK_API_KEY (برای DeepSeek) را در Settings > Secrets قرار دهید.',
        });
        return;
      }
      console.error('AI image read error:', msg);
      res.status(502).json({
        error: 'خطا در ارتباط با سرویس هوش مصنوعی برای خواندن تصویر. لطفاً دوباره تلاش کنید.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('/{*splat}', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Yadban server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
