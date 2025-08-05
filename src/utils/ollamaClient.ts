import * as vscode from 'vscode';

/**
 * Ollama API 클라이언트 인터페이스
 */
export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

/**
 * Ollama API 클라이언트 클래스
 */
export class OllamaClient {
  private baseUrl: string;

  /**
   * OllamaClient 생성자
   * @param baseUrl Ollama 서버 URL
   */
  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  /**
   * Ollama 서버 연결 테스트
   * @returns 연결 성공 여부
   */
  public async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 사용 가능한 모델 목록 가져오기
   * @returns 모델 목록
   */
  public async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      throw new Error('Ollama 서버에서 모델 목록을 가져올 수 없습니다.');
    }
  }

  /**
   * 채팅 메시지 전송
   * @param message 사용자 메시지
   * @param model 사용할 모델명
   * @param context 프로젝트 컨텍스트
   * @returns 응답 텍스트
   */
  public async sendMessage(
    message: string, 
    model: string = 'llama2',
    context?: string
  ): Promise<string> {
    try {
      // 컨텍스트가 있으면 메시지에 포함
      const fullMessage = context 
        ? `프로젝트 컨텍스트:\n${context}\n\n사용자 질문:\n${message}`
        : message;

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: fullMessage,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OllamaResponse = await response.json();
      return data.response;
    } catch (error) {
      throw new Error('Ollama 서버와 통신할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
    }
  }

  /**
   * 스트리밍 채팅 메시지 전송
   * @param message 사용자 메시지
   * @param model 사용할 모델명
   * @param onChunk 청크 데이터 콜백
   * @param context 프로젝트 컨텍스트
   */
  public async sendMessageStream(
    message: string,
    model: string = 'llama2',
    onChunk: (chunk: string) => void,
    context?: string
  ): Promise<void> {
    try {
      const fullMessage = context 
        ? `프로젝트 컨텍스트:\n${context}\n\n사용자 질문:\n${message}`
        : message;

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: fullMessage,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('응답 스트림을 읽을 수 없습니다.');
      }

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data: OllamaResponse = JSON.parse(line);
              if (data.response) {
                onChunk(data.response);
              }
            } catch (e) {
              // JSON 파싱 실패는 무시 (부분 데이터)
            }
          }
        }
      }
    } catch (error) {
      throw new Error('Ollama 서버와 통신할 수 없습니다.');
    }
  }

  /**
   * 기본 URL 설정
   * @param url 새로운 URL
   */
  public setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * 현재 기본 URL 가져오기
   * @returns 현재 URL
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }
} 