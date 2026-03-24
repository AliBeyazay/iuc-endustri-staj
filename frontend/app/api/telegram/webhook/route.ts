import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

type TelegramUpdate = {
  message?: {
    text?: string
    chat?: { id: number }
  }
}

function getEnv(name: string) {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : null
}

async function sendTelegramMessage(chatId: number, text: string, token: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
    cache: 'no-store',
  })
}

async function generateReply(userText: string, openAiApiKey: string, model: string) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: 'You are a helpful Turkish assistant. Keep answers concise and clear.',
        },
        {
          role: 'user',
          content: userText,
        },
      ],
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    return 'Şu anda yanıt üretirken bir sorun oluştu. Lütfen tekrar dene.'
  }

  const data = (await response.json()) as { output_text?: string }
  return data.output_text?.trim() || 'Bu mesaja yanıt üretemedim. Başka bir şekilde dener misin?'
}

export async function POST(request: NextRequest) {
  const telegramToken = getEnv('TELEGRAM_BOT_TOKEN')
  const openAiApiKey = getEnv('OPENAI_API_KEY')
  const webhookSecret = getEnv('TELEGRAM_WEBHOOK_SECRET')
  const model = getEnv('OPENAI_MODEL') || 'gpt-4.1-mini'

  if (!telegramToken || !openAiApiKey) {
    return NextResponse.json({ ok: false, error: 'Missing env vars' }, { status: 500 })
  }

  if (webhookSecret) {
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token')
    if (headerSecret !== webhookSecret) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }
  }

  const update = (await request.json()) as TelegramUpdate
  const messageText = update.message?.text?.trim()
  const chatId = update.message?.chat?.id

  if (!messageText || !chatId) {
    return NextResponse.json({ ok: true })
  }

  if (messageText === '/start') {
    await sendTelegramMessage(chatId, 'Merhaba. Mesajını yaz, ben cevaplayayım.', telegramToken)
    return NextResponse.json({ ok: true })
  }

  const reply = await generateReply(messageText, openAiApiKey, model)
  await sendTelegramMessage(chatId, reply, telegramToken)

  return NextResponse.json({ ok: true })
}

