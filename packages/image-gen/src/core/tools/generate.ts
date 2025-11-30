import { z } from 'zod'
import OpenAI from 'openai'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from '../config.js'

/**
 * 图片生成结果
 */
interface GeneratedImage {
  /** Base64 编码的图片数据 URL */
  dataUrl: string
  /** 图片格式 */
  format: string
}

/**
 * 调用 OpenRouter API 生成图片
 */
async function generateImage(
  client: OpenAI,
  prompt: string,
  model: string
): Promise<{ images: GeneratedImage[]; text?: string }> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    // @ts-expect-error - OpenRouter 扩展参数
    modalities: ['image', 'text'],
  })

  const message = response.choices[0]?.message
  if (!message) {
    throw new Error('No response from model')
  }

  const images: GeneratedImage[] = []

  // 处理返回的图片
  // @ts-expect-error - OpenRouter 扩展响应
  if (message.images && Array.isArray(message.images)) {
    // @ts-expect-error - OpenRouter 扩展响应
    for (const image of message.images) {
      if (image.image_url?.url) {
        images.push({
          dataUrl: image.image_url.url,
          format: 'png',
        })
      }
    }
  }

  return {
    images,
    text: message.content || undefined,
  }
}

/**
 * 注册图片生成相关的 MCP 工具
 */
export function registerGenerateTools(server: McpServer, config: AppConfig) {
  // 创建 OpenAI 客户端（用于 OpenRouter）
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.OPENROUTER_API_KEY,
  })

  /**
   * 工具：生成图片
   */
  server.registerTool(
    'generate_image',
    {
      title: 'Generate Image',
      description:
        'Generate an image based on a text prompt using AI. Returns the image as a base64 data URL.',
      inputSchema: {
        prompt: z
          .string()
          .min(1)
          .describe('The text prompt describing the image to generate'),
        model: z
          .string()
          .optional()
          .describe(
            'The model to use for generation (default: google/gemini-2.0-flash-exp:free)'
          ),
      },
    },
    async ({ prompt, model }) => {
      const modelToUse = model || config.DEFAULT_MODEL

      try {
        const result = await generateImage(client, prompt, modelToUse)

        if (result.images.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: result.text || 'No image was generated. The model may not support image generation or the prompt was rejected.',
              },
            ],
            isError: true,
          }
        }

        // 只返回图片的 Data URL，不混入其他文字
        const content = result.images.map((image) => ({
          type: 'text' as const,
          text: image.dataUrl,
        }))

        return { content }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return {
          content: [
            {
              type: 'text',
              text: `Failed to generate image: ${message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  /**
   * 工具：列出可用的图片生成模型
   */
  server.registerTool(
    'list_image_models',
    {
      title: 'List Image Models',
      description: 'List available models for image generation on OpenRouter',
      inputSchema: {},
    },
    async () => {
      // 常用的支持图片生成的模型列表
      const models = [
        {
          id: 'google/gemini-2.0-flash-exp:free',
          name: 'Gemini 2.0 Flash (Free)',
          description: 'Google Gemini 2.0 Flash with image generation, free tier',
        },
        {
          id: 'google/gemini-3-pro-image-preview',
          name: 'Nano Banana Pro ',
          description: 'Nano Banana Pro with image generation',
        },
      ]

      const text = models
        .map((m) => `- **${m.name}**\n  ID: \`${m.id}\`\n  ${m.description}`)
        .join('\n\n')

      return {
        content: [
          {
            type: 'text',
            text: `# Available Image Generation Models\n\n${text}\n\nUse the model ID with the \`generate_image\` tool.`,
          },
        ],
      }
    }
  )
}
