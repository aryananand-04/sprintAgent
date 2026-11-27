// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { handleChat } from '../server/llm';
export async function POST(req) {
    const body = await req.json().catch(() => null);
    const res = await handleChat(body, process.env.GROQ_API_KEY);
    return Response.json(res.body, { status: res.status });
}
