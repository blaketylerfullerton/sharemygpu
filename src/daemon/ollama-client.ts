import http from 'http';
import { OLLAMA_DEFAULT_URL } from '../shared/constants';
import type { OllamaModel } from '../shared/types';

export class OllamaClient {
  private baseUrl: string;
  private connected = false;

  constructor(port = 11434) {
    this.baseUrl = `http://localhost:${port}`;
  }

  updatePort(port: number): void {
    this.baseUrl = `http://localhost:${port}`;
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.get('/api/tags');
      this.connected = true;
      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async listModels(): Promise<OllamaModel[]> {
    try {
      const data = await this.get('/api/tags') as { models?: OllamaModel[] };
      return data?.models ?? [];
    } catch {
      return [];
    }
  }

  async generate(params: {
    model: string;
    prompt: string;
    stream?: boolean;
    onToken?: (token: string) => void;
  }): Promise<{
    response: string;
    tokensGenerated: number;
    durationMs: number;
  }> {
    const start = Date.now();
    const body = JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      stream: params.stream ?? false,
    });

    if (params.stream && params.onToken) {
      return this.generateStreaming(params.model, params.prompt, params.onToken, start);
    }

    const data = await this.post('/api/generate', body) as {
      response?: string;
      eval_count?: number;
    };
    return {
      response: data.response ?? '',
      tokensGenerated: data.eval_count ?? 0,
      durationMs: Date.now() - start,
    };
  }

  private async generateStreaming(
    model: string,
    prompt: string,
    onToken: (token: string) => void,
    start: number
  ): Promise<{ response: string; tokensGenerated: number; durationMs: number }> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ model, prompt, stream: true });
      let fullResponse = '';
      let totalTokens = 0;

      const req = http.request(
        `${this.baseUrl}/api/generate`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        (res) => {
          res.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const obj = JSON.parse(line) as { response?: string; eval_count?: number; done?: boolean };
                if (obj.response) {
                  fullResponse += obj.response;
                  onToken(obj.response);
                }
                if (obj.eval_count) totalTokens = obj.eval_count;
                if (obj.done) {
                  resolve({ response: fullResponse, tokensGenerated: totalTokens, durationMs: Date.now() - start });
                }
              } catch {}
            }
          });
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async pullModel(modelName: string, onProgress?: (pct: number) => void): Promise<void> {
    const body = JSON.stringify({ name: modelName, stream: true });
    return new Promise((resolve, reject) => {
      const req = http.request(
        `${this.baseUrl}/api/pull`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        (res) => {
          res.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const obj = JSON.parse(line) as { status?: string; completed?: number; total?: number };
                if (obj.completed && obj.total && onProgress) {
                  onProgress(Math.round((obj.completed / obj.total) * 100));
                }
                if (obj.status === 'success') resolve();
              } catch {}
            }
          });
          res.on('end', resolve);
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private get(path: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      http.get(`${this.baseUrl}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
        });
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  private post(path: string, body: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        `${this.baseUrl}${path}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
          });
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
