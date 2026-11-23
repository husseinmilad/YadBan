import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
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

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

      const mimeType =
        typeof body.mimeType === 'string' && ALLOWED_MIME_TYPES.has(body.mimeType.toLowerCase())
          ? body.mimeType.toLowerCase()
          : 'image/jpeg';

      const ai = getGeminiClient();

      const systemInstruction = [
        'تو دستیار هوشمند فارسی اپلیکیشن «یادبان» هستی.',
        'وظیفه تو خواندن دقیق تمام متن‌های داخل تصویر (برگه کاغذی، یادداشت دست‌نویس، نسخه دارو، کارت ویزیت، قبض، رسید بانکی، بسته کالا یا عکس محل قرارگیری وسیله) و استخراج ساختاریافته اطلاعات است.',
        'خروجی باید دقیقاً JSON مطابق اسکیما باشد.',
        'قوانین فیلدها:',
        '- extractedText: متن کامل و دقیق خوانده‌شده از تصویر با حفظ سطرهای مهم.',
        '- title: یک عنوان کوتاه، طبیعی و کاربردی به فارسی برای ثبت به‌عنوان کار، یادآور، دارو، شماره یا مکان وسیله (مثلاً «پرداخت قبض برق»، «قرص ویتامین D»، «تماس با مهندس کریمی»، «عینک مطالعه روی میز»).',
        '- category: فقط یکی از مقادیر مجاز: work | health | phone | errand | anchor | fitness | idea.',
        '- timeStr: اگر ساعت مشخصی در متن دیده شد با فرمت HH:MM مثل "08:30" وگرنه "".',
        '- dateHint: اگر اشاره به زمان یا تاریخ وجود دارد مثل "امروز"، "فردا" یا متن تاریخ، وگرنه "".',
        '- phoneNumber: فقط ارقام شماره تلفن یا موبایل اگر در تصویر بود، وگرنه "".',
        '- contactName: نام شخص، پزشک، شرکت یا فروشگاه اگر مشخص بود، وگرنه "".',
        '- locationHint: نشانی، محل نگهداری وسیله یا مکان درج‌شده در تصویر، وگرنه "".',
        '- dosage: مقدار یا دوز مصرف دارو اگر نسخه یا دارو بود، وگرنه "".',
        '- notes: خلاصه نکات مهم تصویر، مبلغ قبض، کد پیگیری یا دستور مصرف.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: rawBase64,
              },
            },
            {
              text: 'متن روی این تصویر را با دقت بخوان، استخراج کن و اطلاعات ساختاریافته آن را برای ثبت کار، یادآور، تماس، دارو یا محل وسیله آماده کن.',
            },
          ],
        },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractedText: { type: Type.STRING },
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              timeStr: { type: Type.STRING },
              dateHint: { type: Type.STRING },
              phoneNumber: { type: Type.STRING },
              contactName: { type: Type.STRING },
              locationHint: { type: Type.STRING },
              dosage: { type: Type.STRING },
              notes: { type: Type.STRING },
            },
            required: ['extractedText', 'title', 'category'],
          },
        },
      });

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
      const validCats = new Set([
        'work',
        'health',
        'phone',
        'errand',
        'anchor',
        'fitness',
        'idea',
      ]);
      const category =
        typeof parsed.category === 'string' && validCats.has(parsed.category)
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
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'MISSING_GEMINI_API_KEY') {
        res.status(500).json({
          error: 'کلید هوش مصنوعی (GEMINI_API_KEY) در تنظیمات Secrets سرور تعریف نشده است.',
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
