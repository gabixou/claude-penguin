import urllib.request
import json
import re
import sys
import os

def call_qwen(prompt, model="qwen3.5:4b", timeout=180):
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 4096
        }
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    print(f"[*] Delegando tarefa ao {model}...", flush=True)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result.get("response", "")

def extract_code(response_text, default_code=""):
    # Procura blocos ```javascript, ```js, etc.
    matches = re.findall(r"```(?:javascript|js|json|html|css)?\s*\n(.*?)```", response_text, re.DOTALL)
    if matches:
        # Pega o maior bloco de código retornado
        return max(matches, key=len).strip()
    return response_text.strip()

def run_task(task_name, prompt, output_file, model="qwen3.5:4b"):
    print(f"\n==========================================")
    print(f"[TAREFA] {task_name}")
    print(f"[DESTINO] {output_file}")
    print(f"==========================================")
    resp = call_qwen(prompt, model=model)
    code = extract_code(resp)
    
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(code + "\n")
    print(f"[OK] Arquivo salvo com sucesso ({len(code)} bytes)!")
    return code

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python qwen_worker.py <output_file> <prompt_file>")
        sys.exit(1)
    out_file = sys.argv[1]
    prompt_file = sys.argv[2]
    with open(prompt_file, "r", encoding="utf-8") as f:
        prompt_content = f.read()
    run_task(os.path.basename(out_file), prompt_content, out_file)
