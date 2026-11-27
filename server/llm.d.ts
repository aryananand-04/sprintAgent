// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod';
export declare const ChatRequestSchema: z.ZodObject<{
    tier: z.ZodDefault<z.ZodEnum<{
        fast: "fast";
        smart: "smart";
    }>>;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            user: "user";
            system: "system";
        }>;
        content: z.ZodString;
    }, z.core.$strip>>;
    temperature: z.ZodDefault<z.ZodNumber>;
    maxTokens: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export interface ChatResponse {
    status: number;
    body: {
        text: string;
    } | {
        error: string;
    };
}
type Completer = (req: ChatRequest, apiKey: string) => Promise<string>;
export declare function handleChat(body: unknown, apiKey: string | undefined, complete?: Completer): Promise<ChatResponse>;
export {};
