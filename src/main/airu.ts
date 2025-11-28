import OpenAI from 'openai'
import { getAiruSettings } from './db/database'
import type { AiruProvider, AiruResult, AiruSettings } from '@shared/types'

// Lazy-initialized clients
let openaiClient: OpenAI | null = null

const getOpenAIClient = (apiKey: string): OpenAI => {
  if (!openaiClient || openaiClient.apiKey !== apiKey) {
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

// Process prompt template with variables
export const processPromptTemplate = (template: string, userInput: string): string => {
  // Replace {{input}} with user input
  let processed = template.replace(/\{\{input\}\}/gi, userInput)

  // If no {{input}} placeholder, append user input at the end
  if (!template.includes('{{input}}') && !template.includes('{{INPUT}}')) {
    processed = `${template}\n\n${userInput}`
  }

  return processed
}

// OpenAI API call
export const callOpenAI = async (
  prompt: string,
  settings: AiruSettings,
): Promise<{ response: string; error?: string; apiMs: number }> => {
  const startTime = Date.now()

  if (!settings.openaiApiKey) {
    return { response: '', error: 'OpenAI API key not configured', apiMs: 0 }
  }

  try {
    const client = getOpenAIClient(settings.openaiApiKey)

    const completion = await client.chat.completions.create({
      model: settings.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: settings.openaiTemperature,
      max_tokens: settings.openaiMaxTokens,
      top_p: settings.openaiTopP,
      frequency_penalty: settings.openaiFrequencyPenalty,
      presence_penalty: settings.openaiPresencePenalty,
    })

    const response = completion.choices[0]?.message?.content?.trim() || ''
    const apiMs = Date.now() - startTime

    return { response, apiMs }
  } catch (err) {
    const apiMs = Date.now() - startTime
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return { response: '', error: errorMessage, apiMs }
  }
}

// Gemini API call (placeholder)
export const callGemini = async (
  _prompt: string,
  _settings: AiruSettings,
): Promise<{ response: string; error?: string; apiMs: number }> => {
  return { response: '', error: 'Gemini API not yet implemented', apiMs: 0 }
}

// Claude API call (placeholder)
export const callClaude = async (
  _prompt: string,
  _settings: AiruSettings,
): Promise<{ response: string; error?: string; apiMs: number }> => {
  return { response: '', error: 'Claude API not yet implemented', apiMs: 0 }
}

// Main Airu function
export const executeAiruRequest = async (
  provider: AiruProvider,
  promptTitle: string,
  promptContent: string,
  userInput: string,
): Promise<AiruResult> => {
  const startTime = Date.now()
  const settings = getAiruSettings()

  // Process the prompt template
  const fullRequest = processPromptTemplate(promptContent, userInput)

  let result: { response: string; error?: string; apiMs: number }

  switch (provider) {
    case 'openai':
      result = await callOpenAI(fullRequest, settings)
      break
    case 'gemini':
      result = await callGemini(fullRequest, settings)
      break
    case 'claude':
      result = await callClaude(fullRequest, settings)
      break
    default:
      result = { response: '', error: `Unknown provider: ${provider}`, apiMs: 0 }
  }

  return {
    provider,
    promptTitle,
    promptContent,
    userInput,
    fullRequest,
    response: result.response,
    error: result.error,
    timing: {
      totalMs: Date.now() - startTime,
      apiMs: result.apiMs,
    },
  }
}
