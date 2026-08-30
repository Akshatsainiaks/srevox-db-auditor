"""
Srevox AI Microservice — Python FastAPI
On-demand pod crash diagnosis using LLM providers.
Supports: OpenAI, Anthropic, Ollama (local/air-gapped)
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import httpx
import json
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Srevox AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """You are a senior Kubernetes Site Reliability Engineer with 10+ years of experience.
Analyze the pod crash incident and return ONLY a valid JSON object with these exact keys:
{
  "root_cause": "Clear 1-2 sentence explanation of the exact cause of the crash",
  "severity_assessment": "Why this severity level is appropriate for this crash",
  "fix_steps": [
    "Specific actionable step 1",
    "Specific actionable step 2",
    "Specific actionable step 3"
  ],
  "kubectl_commands": [
    "kubectl describe pod POD_NAME -n NAMESPACE",
    "kubectl logs POD_NAME -n NAMESPACE --previous"
  ],
  "prevention": "Concrete recommendation to prevent this crash in future",
  "estimated_fix_time": "e.g. 5-10 minutes",
  "related_docs": "Relevant Kubernetes documentation link"
}
Use the actual pod name and namespace from the incident in kubectl commands.
Return ONLY valid JSON. No markdown code blocks, no explanations."""


async def get_db_connection():
    return await asyncpg.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        database=os.getenv("POSTGRES_DB", "srevox"),
        user=os.getenv("POSTGRES_USER", "srevox"),
        password=os.getenv("POSTGRES_PASSWORD", "srevox_dev"),
    )


async def call_openai(prompt: str, config: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {config['api_key']}"} if config.get('api_key') else {},
            json={
                "model": config.get("model", "gpt-4o-mini"),
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,
            },
        )
        data = resp.json()
        if "error" in data:
            raise Exception(data["error"]["message"])
        return json.loads(data["choices"][0]["message"]["content"])


async def call_anthropic(prompt: str, config: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": config.get("api_key") or os.getenv("ANTHROPIC_API_KEY", ""),
                "anthropic-version": "2023-06-01",
            },
            json={
                "model": config.get("model", "claude-haiku-4-5-20251001"),
                "max_tokens": 1500,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        data = resp.json()
        return json.loads(data["content"][0]["text"])


async def call_ollama(prompt: str, config: dict) -> dict:
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{config.get('ollama_url') or os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')}/api/generate",
            json={
                "model": config.get("model", "tinyllama"),
                "prompt": f"{SYSTEM_PROMPT}\n\nIncident:\n{prompt}",
                "stream": False,
                "format": "json",
            },
        )
        raw = resp.json().get("response", "{}")
        return json.loads(raw) if isinstance(raw, str) else raw



async def call_groq(prompt: str, config: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {config['api_key']}"} if config.get('api_key') else {},
            json={
                "model": config.get("model", "llama-3.1-8b-instant"),
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,
            },
        )
        data = resp.json()
        return json.loads(data["choices"][0]["message"]["content"])

async def call_ai(prompt: str, config: dict) -> dict:
    provider = config.get("provider", os.getenv("AI_PROVIDER", "groq")).lower()
    if provider == "anthropic":
        return await call_anthropic(prompt, config)
    elif provider == "ollama":
        return await call_ollama(prompt, config)
    elif provider == "groq":
        return await call_groq(prompt, config)
    else:
        return await call_openai(prompt, config)



# Dynamic config — loaded from API/DB
_ai_config = {
    "provider": os.getenv("AI_PROVIDER", "groq"),
    "model": os.getenv("AI_MODEL", "llama-3.1-8b-instant"),
    "api_key": os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY") or "",
    "ollama_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
}

@app.post("/api/config")
async def update_config(body: dict):
    global _ai_config
    _ai_config.update({k: v for k, v in body.items() if v})
    return {"success": True}

@app.get("/api/config")
async def get_config():
    return {"provider": _ai_config["provider"], "model": _ai_config["model"]}

class DiagnoseRequest(BaseModel):
    provider:   str = ""
    model:      str = ""
    api_key:    str = ""
    ollama_url: str = ""
    user_id:    str = ""
    logs:       str = ""

def get_fallback_diagnosis(crash_reason: str, pod_name: str, namespace: str) -> dict:
    reason = (crash_reason or "").lower()
    
    if "image" in reason or "pull" in reason:
        return {
            "root_cause": "The container image could not be pulled from the registry. This usually indicates a typo in the image name/tag, network issues, or a missing imagePullSecrets secret in the namespace.",
            "severity_assessment": "CRITICAL. The pod cannot start without the container image, leading to a complete service outage for this replica.",
            "fix_steps": [
                f"Verify the container image name and tag in the deployment spec: kubectl get pod {pod_name} -n {namespace} -o jsonpath='{{.spec.containers[*].image}}'",
                f"Verify if the image repository requires authentication. If so, check that imagePullSecrets is defined: kubectl get pod {pod_name} -n {namespace} -o jsonpath='{{.spec.imagePullSecrets}}'",
                f"Check the events section of the pod description for the exact image pull error: kubectl describe pod {pod_name} -n {namespace}",
                "If using a private registry, verify that the pull credentials in the secret are valid."
            ],
            "kubectl_commands": [
                f"kubectl describe pod {pod_name} -n {namespace}",
                f"kubectl get secrets -n {namespace}"
            ],
            "prevention": "Ensure the image name and tag are correct in your CI/CD pipeline before deploying, and verify registry credentials.",
            "estimated_fix_time": "5-10 minutes",
            "related_docs": "https://kubernetes.io/docs/concepts/containers/images/#specifying-imagepullsecrets-on-a-pod"
        }
    elif "oom" in reason or "137" in reason:
        return {
            "root_cause": "The container exceeded its memory limit and was terminated by the system out-of-memory (OOM) killer.",
            "severity_assessment": "HIGH. The pod was killed because it tried to consume more memory than allocated, which could point to a memory leak or undersized resource limits.",
            "fix_steps": [
                f"Check the memory limits currently allocated to the container: kubectl get pod {pod_name} -n {namespace} -o jsonpath='{{.spec.containers[*].resources.limits.memory}}'",
                f"Inspect the memory utilization trend in the dashboard or run: kubectl top pod {pod_name} -n {namespace}",
                "Review the application codebase for memory leaks, unclosed resources, or excessive cache sizes.",
                "Increase the container's memory limit in the deployment spec resources block."
            ],
            "kubectl_commands": [
                f"kubectl describe pod {pod_name} -n {namespace}",
                f"kubectl logs {pod_name} -n {namespace} --previous"
            ],
            "prevention": "Define realistic memory requests and limits based on load testing, and profile memory usage periodically.",
            "estimated_fix_time": "10-15 minutes",
            "related_docs": "https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/"
        }
    elif "crash" in reason or "loop" in reason:
        return {
            "root_cause": "The application started but exited with an error code, causing Kubernetes to restart it in a loop. This is usually due to misconfiguration, missing dependencies, database connection errors, or runtime exceptions.",
            "severity_assessment": "HIGH. The container is crashing repeatedly during startup, preventing the service from serving traffic.",
            "fix_steps": [
                f"Inspect the log output of the previously crashed container: kubectl logs {pod_name} -n {namespace} --previous",
                "Verify that all required environment variables, configmaps, and secrets are correctly populated and mounted.",
                "Verify network connectivity to external services like databases, message brokers, and downstream microservices.",
                "Check for application initialization exceptions, missing files, or incorrect file permissions."
            ],
            "kubectl_commands": [
                f"kubectl logs {pod_name} -n {namespace} --previous",
                f"kubectl describe pod {pod_name} -n {namespace}"
            ],
            "prevention": "Ensure environment configurations are validated at startup, and implement robust error checking during application initialization.",
            "estimated_fix_time": "15-20 minutes",
            "related_docs": "https://kubernetes.io/docs/tasks/debug/debug-application/determine-reason-pod-failure/"
        }
    else:
        return {
            "root_cause": f"The pod crashed due to {crash_reason or 'unknown reason'}. Details are unavailable without log context.",
            "severity_assessment": "MEDIUM. Pod has crashed. Further investigation using pod logs and description events is required.",
            "fix_steps": [
                f"Inspect the pod describe events for any warning or failure indicators: kubectl describe pod {pod_name} -n {namespace}",
                f"Fetch the logs from the previous container run to see the exit details: kubectl logs {pod_name} -n {namespace} --previous",
                "Verify resource limits (CPU/Memory) and probe (Liveness/Readiness) settings in the deployment spec."
            ],
            "kubectl_commands": [
                f"kubectl describe pod {pod_name} -n {namespace}",
                f"kubectl logs {pod_name} -n {namespace} --previous"
            ],
            "prevention": "Enable structured logging and verify container readiness/liveness configuration.",
            "estimated_fix_time": "10 minutes",
            "related_docs": "https://kubernetes.io/docs/tasks/debug/"
        }

@app.post("/api/diagnose/{incident_id}")
async def diagnose_incident(incident_id: str, config: DiagnoseRequest = None):
    # Resolve config for this request: start with request config, fallback to env settings
    req_config = {
        "provider": (config.provider if config and config.provider else None) or os.getenv("AI_PROVIDER", "groq"),
        "model": (config.model if config and config.model else None) or os.getenv("AI_MODEL", "llama-3.1-8b-instant"),
        "api_key": (config.api_key if config and config.api_key else None) or os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY") or "",
        "ollama_url": (config.ollama_url if config and config.ollama_url else None) or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    }
    user_id = config.user_id if config else ""

    db = await get_db_connection()
    try:
        incident = await db.fetchrow(
            "SELECT * FROM incidents WHERE incident_id = $1", incident_id
        )
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")

        # Return cached diagnosis
        if user_id:
            cached_row = await db.fetchrow(
                "SELECT * FROM user_ai_diagnoses WHERE incident_id = $1 AND user_id = $2",
                incident_id, user_id
            )
            if cached_row and cached_row["ai_diagnosis"]:
                cached = cached_row["ai_diagnosis"]
                if isinstance(cached, str):
                    cached = json.loads(cached)
                return {"diagnosis": cached, "cached": True}
        else:
            if incident["ai_diagnosis"]:
                cached = incident["ai_diagnosis"]
                if isinstance(cached, str):
                    cached = json.loads(cached)
                return {"diagnosis": cached, "cached": True}

        # Build detailed prompt
        prompt = f"""
Pod crash incident requiring diagnosis:

Pod Name: {incident['pod_name']}
Namespace: {incident['namespace']}
Container: {incident['container_name'] or 'unknown'}
Crash Reason: {incident['crash_reason']}
Restart Count: {incident['restart_count']}
Severity: {incident['severity']}
Exit Code: {incident.get('exit_code', 'unknown')}
Pod Labels: {incident["pod_labels"] or "{}"}
"""
        if config and config.logs:
            prompt += f"\nRecent Container Logs:\n{config.logs}\n"
        else:
            prompt += "\n(No container logs available)\n"

        prompt += "\nPlease analyze the crash details (and logs if available), identify the specific error, and provide precise fix steps, suggestions, and relevant troubleshooting commands.\n"

        try:
            diagnosis = await call_ai(prompt, req_config)
        except Exception as ai_err:
            print(f"LLM call failed: {ai_err}. Falling back to rule-based diagnosis.")
            diagnosis = get_fallback_diagnosis(
                incident["crash_reason"] or "",
                incident["pod_name"] or "pod",
                incident["namespace"] or "default"
            )

        # Cache in DB
        if user_id:
            await db.execute(
                """INSERT INTO user_ai_diagnoses (user_id, incident_id, ai_diagnosis, ai_diagnosed_at)
                   VALUES ($1, $2, $3, now())
                   ON CONFLICT (user_id, incident_id)
                   DO UPDATE SET ai_diagnosis = EXCLUDED.ai_diagnosis, ai_diagnosed_at = now()""",
                user_id,
                incident_id,
                json.dumps(diagnosis),
            )
        else:
            await db.execute(
                """UPDATE incidents
                   SET ai_diagnosis = $1, ai_diagnosed_at = now()
                   WHERE incident_id = $2""",
                json.dumps(diagnosis),
                incident_id,
            )

        return {"diagnosis": diagnosis, "cached": False}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")
    finally:
        await db.close()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "srevox-ai",
        "provider": os.getenv("AI_PROVIDER", "openai"),
    }
