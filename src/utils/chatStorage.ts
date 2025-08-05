import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 채팅 메시지 인터페이스
 */
export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * 채팅 세션 인터페이스
 */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 채팅 저장소 클래스
 */
export class ChatStorage {
  private readonly storageDir: string;
  private readonly sessionsFile: string;

  /**
   * ChatStorage 생성자
   * @param context Extension 컨텍스트
   */
  constructor(private context: vscode.ExtensionContext) {
    this.storageDir = path.join(context.globalStorageUri.fsPath, 'chats');
    this.sessionsFile = path.join(this.storageDir, 'sessions.json');
    this.ensureStorageDir();
  }

  /**
   * 저장소 디렉토리 생성
   */
  private ensureStorageDir(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (error) {
      // 저장소 디렉토리 생성 실패 시 무시
    }
  }

  /**
   * 새 채팅 세션 생성
   * @param title 세션 제목
   * @returns 생성된 세션
   */
  public createSession(title: string = '새 채팅'): ChatSession {
    const session: ChatSession = {
      id: Date.now().toString(),
      title: title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.saveSession(session);
    return session;
  }

  /**
   * 세션 저장
   * @param session 저장할 세션
   */
  public saveSession(session: ChatSession): void {
    try {
      session.updatedAt = Date.now();
      const sessions = this.loadAllSessions();
      
      // 기존 세션 업데이트 또는 새 세션 추가
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }

      // 세션 목록 저장
      fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
    } catch (error) {
      // 세션 저장 실패 시 무시
    }
  }

  /**
   * 세션 로드
   * @param sessionId 세션 ID
   * @returns 세션 또는 undefined
   */
  public loadSession(sessionId: string): ChatSession | undefined {
    try {
      const sessions = this.loadAllSessions();
      return sessions.find(s => s.id === sessionId);
    } catch (error) {
      return undefined;
    }
  }

  /**
   * 세션의 메시지 목록 가져오기
   * @param sessionId 세션 ID
   * @returns 메시지 목록
   */
  public getSessionMessages(sessionId: string): ChatMessage[] {
    try {
      const session = this.loadSession(sessionId);
      return session?.messages || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * 모든 세션 로드
   * @returns 세션 목록
   */
  public loadAllSessions(): ChatSession[] {
    try {
      if (!fs.existsSync(this.sessionsFile)) {
        return [];
      }

      const data = fs.readFileSync(this.sessionsFile, 'utf8');
      return JSON.parse(data) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * 세션에 메시지 추가
   * @param sessionId 세션 ID
   * @param sender 메시지 발신자
   * @param content 메시지 내용
   * @returns 추가된 메시지
   */
  public addMessage(sessionId: string, sender: 'user' | 'assistant', content: string): ChatMessage | undefined {
    const session = this.loadSession(sessionId);
    if (!session) {
      return undefined;
    }

    const message: ChatMessage = {
      id: Date.now().toString(),
      sender: sender,
      content: content,
      timestamp: Date.now()
    };

    session.messages.push(message);
    session.updatedAt = Date.now();

    // 첫 번째 사용자 메시지로 제목 업데이트
    if (sender === 'user' && session.messages.length === 1) {
      session.title = this.generateTitle(content);
    }

    this.saveSession(session);
    return message;
  }

  /**
   * 메시지 내용으로 제목 생성
   * @param content 메시지 내용
   * @returns 생성된 제목
   */
  private generateTitle(content: string): string {
    // 첫 번째 줄을 제목으로 사용하거나, 내용이 길면 잘라서 사용
    const lines = content.split('\n');
    const firstLine = lines[0].trim();
    
    if (firstLine.length <= 50) {
      return firstLine;
    } else {
      return firstLine.substring(0, 47) + '...';
    }
  }

  /**
   * 세션 삭제
   * @param sessionId 삭제할 세션 ID
   */
  public deleteSession(sessionId: string): void {
    try {
      const sessions = this.loadAllSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      
      fs.writeFileSync(this.sessionsFile, JSON.stringify(filteredSessions, null, 2), 'utf8');
    } catch (error) {
      // 세션 삭제 실패 시 무시
    }
  }

  /**
   * 모든 세션 삭제
   */
  public clearAllSessions(): void {
    try {
      fs.writeFileSync(this.sessionsFile, '[]', 'utf8');
    } catch (error) {
      // 모든 세션 삭제 실패 시 무시
    }
  }

  /**
   * 세션 제목 업데이트
   * @param sessionId 세션 ID
   * @param title 새로운 제목
   */
  public updateSessionTitle(sessionId: string, title: string): void {
    const session = this.loadSession(sessionId);
    if (session) {
      session.title = title;
      session.updatedAt = Date.now();
      this.saveSession(session);
    }
  }

  /**
   * 최근 세션 가져오기
   * @param limit 가져올 세션 수
   * @returns 최근 세션 목록
   */
  public getRecentSessions(limit: number = 10): ChatSession[] {
    const sessions = this.loadAllSessions();
    return sessions
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }
} 