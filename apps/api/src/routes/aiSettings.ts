import type { FastifyInstance } from "fastify";
import sql from "../db/sql.js";
import { getUser } from "../middleware/rbac.js";
import { encrypt, decrypt } from "../utils/crypto.js";

export default async function aiSettingsRoutes(app: FastifyInstance) {

  app.get("/", {
    onRequest: [(app as any).authenticate],
  }, async (req) => {
    const { sub: user_id } = getUser(req);
    const [row] = await sql`
      SELECT * FROM ai_settings WHERE user_id = ${user_id} LIMIT 1
    `;
    if (!row) return {
      provider: "groq",
      model: "llama-3.1-8b-instant",
      ollama_url: "http://localhost:11434",
      models: {
        groq: "llama-3.1-8b-instant",
        openai: "gpt-4o-mini",
        anthropic: "claude-sonnet-4-5",
        ollama: "llama3",
      },
      keys_configured: {
        groq: false,
        openai: false,
        anthropic: false,
      }
    };
    return {
      provider: row.provider,
      model: row.model,
      ollama_url: row.ollama_url || "",
      models: {
        groq: row.model_groq || "llama-3.1-8b-instant",
        openai: row.model_openai || "gpt-4o-mini",
        anthropic: row.model_anthropic || "claude-sonnet-4-5",
        ollama: row.model_ollama || "llama3",
      },
      keys_configured: {
        groq: !!row.api_key_groq,
        openai: !!row.api_key_openai,
        anthropic: !!row.api_key_anthropic,
      }
    };
  });

  app.post("/", {
    onRequest: [(app as any).authenticate],
  }, async (req) => {
    const { sub: user_id } = getUser(req);
    const { 
      provider, model, ollama_url,
      api_key_groq, api_key_openai, api_key_anthropic,
      model_groq, model_openai, model_anthropic, model_ollama
    } = req.body as any;

    const [row] = await sql`SELECT * FROM ai_settings WHERE user_id = ${user_id} LIMIT 1`;
    const curProvider = provider || (row ? row.provider : "groq");
    
    let resolvedModel = model;
    if (!resolvedModel) {
      if (curProvider === "groq") resolvedModel = model_groq || (row ? row.model_groq : "llama-3.1-8b-instant");
      else if (curProvider === "openai") resolvedModel = model_openai || (row ? row.model_openai : "gpt-4o-mini");
      else if (curProvider === "anthropic") resolvedModel = model_anthropic || (row ? row.model_anthropic : "claude-sonnet-4-5");
      else if (curProvider === "ollama") resolvedModel = model_ollama || (row ? row.model_ollama : "llama3");
    }

    const curOllamaUrl = ollama_url !== undefined ? ollama_url : (row ? row.ollama_url : "http://localhost:11434");

    await sql`
      INSERT INTO ai_settings (user_id, provider, model, ollama_url)
      VALUES (${user_id}, ${curProvider}, ${resolvedModel || "llama-3.1-8b-instant"}, ${curOllamaUrl})
      ON CONFLICT (user_id)
      DO UPDATE SET
        provider   = EXCLUDED.provider,
        model      = EXCLUDED.model,
        ollama_url = EXCLUDED.ollama_url,
        updated_at = now()
    `;

    if (api_key_groq !== undefined) {
      const encryptedKey = encrypt(api_key_groq);
      await sql`
        UPDATE ai_settings SET
          api_key_groq = CASE WHEN ${api_key_groq} = 'REMOVE' THEN '' WHEN ${api_key_groq} = '' THEN api_key_groq ELSE ${encryptedKey} END
        WHERE user_id = ${user_id}
      `;
    }
    if (model_groq !== undefined) {
      await sql`UPDATE ai_settings SET model_groq = ${model_groq} WHERE user_id = ${user_id}`;
    }

    if (api_key_openai !== undefined) {
      const encryptedKey = encrypt(api_key_openai);
      await sql`
        UPDATE ai_settings SET
          api_key_openai = CASE WHEN ${api_key_openai} = 'REMOVE' THEN '' WHEN ${api_key_openai} = '' THEN api_key_openai ELSE ${encryptedKey} END
        WHERE user_id = ${user_id}
      `;
    }
    if (model_openai !== undefined) {
      await sql`UPDATE ai_settings SET model_openai = ${model_openai} WHERE user_id = ${user_id}`;
    }

    if (api_key_anthropic !== undefined) {
      const encryptedKey = encrypt(api_key_anthropic);
      await sql`
        UPDATE ai_settings SET
          api_key_anthropic = CASE WHEN ${api_key_anthropic} = 'REMOVE' THEN '' WHEN ${api_key_anthropic} = '' THEN api_key_anthropic ELSE ${encryptedKey} END
        WHERE user_id = ${user_id}
      `;
    }
    if (model_anthropic !== undefined) {
      await sql`UPDATE ai_settings SET model_anthropic = ${model_anthropic} WHERE user_id = ${user_id}`;
    }

    if (model_ollama !== undefined) {
      await sql`UPDATE ai_settings SET model_ollama = ${model_ollama} WHERE user_id = ${user_id}`;
    }

    // Resolve active key to push to AI service
    let activeKey = "";
    const [finalRow] = await sql`SELECT * FROM ai_settings WHERE user_id = ${user_id} LIMIT 1`;
    if (finalRow) {
      if (finalRow.provider === "groq") activeKey = decrypt(finalRow.api_key_groq);
      else if (finalRow.provider === "openai") activeKey = decrypt(finalRow.api_key_openai);
      else if (finalRow.provider === "anthropic") activeKey = decrypt(finalRow.api_key_anthropic);

      try {
        await fetch(`${process.env.AI_SERVICE_URL || "http://localhost:8000"}/api/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            provider: finalRow.provider, 
            model: finalRow.model, 
            api_key: activeKey, 
            ollama_url: finalRow.ollama_url 
          }),
        });
      } catch {}
    }

    return { success: true };
  });
}
