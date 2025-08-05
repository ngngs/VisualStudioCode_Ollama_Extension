import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { OllamaClient } from '../utils/ollamaClient';
import { ChatStorage, ChatSession } from '../utils/chatStorage';

/**
 * 채팅 패널을 관리하는 클래스
 */
export class ChatProvider {
  public static currentPanel: ChatProvider | undefined;
  public static readonly viewType = 'ollamaChat';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _ollamaClient: OllamaClient;
  private readonly _chatStorage: ChatStorage;
  private _currentSession: ChatSession | undefined;
  private _disposables: vscode.Disposable[] = [];

  /**
   * ChatProvider 생성자
   * @param panel Webview 패널
   * @param extensionUri Extension URI
   */
  public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // 이미 패널이 열려있다면 포커스
    if (ChatProvider.currentPanel) {
      ChatProvider.currentPanel._panel.reveal(column);
      return;
    }

    // 새 패널 생성
    const panel = vscode.window.createWebviewPanel(
      ChatProvider.viewType,
      'Ollama Chat',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'out/compiled')
        ]
      }
    );

    ChatProvider.currentPanel = new ChatProvider(panel, extensionUri, context);
  }

  /**
   * ChatProvider 생성자
   * @param panel Webview 패널
   * @param extensionUri Extension URI
   * @param context Extension 컨텍스트
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    
    // Ollama 클라이언트 초기화
    const ollamaUrl = context.globalState.get<string>('ollamaUrl', 'http://localhost:11434');
    this._ollamaClient = new OllamaClient(ollamaUrl);
    
    // 채팅 저장소 초기화
    this._chatStorage = new ChatStorage(context);

    // 초기 HTML 콘텐츠 설정
    this._update();

    // 패널이 닫힐 때 이벤트 리스너
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // 메시지 핸들러 등록
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'sendMessage':
            this._handleSendMessage(message.text);
            return;
          case 'getProjectFiles':
            this._handleGetProjectFiles();
            return;
          case 'createNewChat':
            this._handleCreateNewChat();
            return;
          case 'loadChatHistory':
            this._handleLoadChatHistory();
            return;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Webview HTML 콘텐츠 업데이트
   */
  private _update(): void {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  /**
   * Webview용 HTML 생성
   * @param webview Webview 인스턴스
   * @returns HTML 문자열
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ollama Chat</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        
        .sidebar {
            width: 250px;
            background-color: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-sideBar-border);
            display: flex;
            flex-direction: column;
        }
        
        .sidebar-header {
            padding: 10px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
        }
        
        .new-chat-btn {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .chat-history {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        }
        
        .chat-item {
            padding: 8px;
            margin-bottom: 5px;
            border-radius: 4px;
            cursor: pointer;
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .chat-item.active {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        }
        
        .message {
            margin-bottom: 20px;
            padding: 10px;
            border-radius: 8px;
        }
        
        .message.user {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            margin-left: 20%;
        }
        
        .message.assistant {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            margin-right: 20%;
        }
        
        .input-area {
            padding: 20px;
            border-top: 1px solid var(--vscode-sideBar-border);
            display: flex;
            gap: 10px;
        }
        
        .message-input {
            flex: 1;
            padding: 10px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            resize: none;
        }
        
        .send-btn {
            padding: 10px 20px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .file-context {
            margin-top: 10px;
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-header">
            <button class="new-chat-btn" onclick="createNewChat()">새 채팅</button>
        </div>
        <div class="chat-history" id="chatHistory">
            <!-- 채팅 히스토리가 여기에 표시됩니다 -->
        </div>
    </div>
    
    <div class="main-content">
        <div class="chat-messages" id="chatMessages">
            <div class="message assistant">
                안녕하세요! Ollama Chat에 오신 것을 환영합니다. 무엇을 도와드릴까요?
            </div>
        </div>
        
        <div class="input-area">
            <textarea 
                class="message-input" 
                id="messageInput" 
                placeholder="메시지를 입력하세요..."
                rows="3"
                onkeydown="handleKeyDown(event)"
            ></textarea>
            <button class="send-btn" id="sendBtn" onclick="sendMessage()">전송</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentChatId = null;
        let isProcessing = false;

        // 새 채팅 생성
        function createNewChat() {
            vscode.postMessage({
                command: 'createNewChat'
            });
        }

        // 메시지 전송
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const text = input.value.trim();
            
            if (!text || isProcessing) return;
            
            addMessage('user', text);
            input.value = '';
            
            isProcessing = true;
            document.getElementById('sendBtn').disabled = true;
            
            vscode.postMessage({
                command: 'sendMessage',
                text: text
            });
        }

        // 키보드 이벤트 처리
        function handleKeyDown(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        }

                 // 메시지 추가
         function addMessage(sender, text) {
             const messagesContainer = document.getElementById('chatMessages');
             const messageDiv = document.createElement('div');
             messageDiv.className = \`message \${sender}\`;
             messageDiv.textContent = text;
             messagesContainer.appendChild(messageDiv);
             messagesContainer.scrollTop = messagesContainer.scrollHeight;
         }

        // 채팅 히스토리 업데이트
        function updateChatHistory(history) {
            const historyContainer = document.getElementById('chatHistory');
            historyContainer.innerHTML = '';
            
            history.forEach(chat => {
                const chatItem = document.createElement('div');
                chatItem.className = 'chat-item';
                if (chat.id === currentChatId) {
                    chatItem.classList.add('active');
                }
                chatItem.textContent = chat.title || '새 채팅';
                chatItem.onclick = () => loadChat(chat.id);
                historyContainer.appendChild(chatItem);
            });
        }

        // 채팅 로드
        function loadChat(chatId) {
            vscode.postMessage({
                command: 'loadChat',
                chatId: chatId
            });
        }

                 // 초기 로드
         vscode.postMessage({
             command: 'loadChatHistory'
         });

         // 메시지 수신 처리
         window.addEventListener('message', event => {
             const message = event.data;
             
             switch (message.command) {
                 case 'addMessage':
                     addMessage(message.sender, message.text);
                     isProcessing = false;
                     document.getElementById('sendBtn').disabled = false;
                     break;
                     
                 case 'updateChatHistory':
                     updateChatHistory(message.history);
                     break;
                     
                 case 'setCurrentChat':
                     currentChatId = message.chatId;
                     break;
                     
                 case 'clearMessages':
                     document.getElementById('chatMessages').innerHTML = 
                         '<div class="message assistant">안녕하세요! Ollama Chat에 오신 것을 환영합니다. 무엇을 도와드릴까요?</div>';
                     break;
             }
         });
    </script>
</body>
</html>`;
  }

  /**
   * 메시지 전송 처리
   * @param text 메시지 텍스트
   */
  private async _handleSendMessage(text: string): Promise<void> {
    // 현재 세션이 없으면 새로 생성
    if (!this._currentSession) {
      this._currentSession = this._chatStorage.createSession();
    }

    // 사용자 메시지를 저장소에 추가
    this._chatStorage.addMessage(this._currentSession.id, 'user', text);

    // 사용자 메시지 표시
    this._panel.webview.postMessage({
      command: 'addMessage',
      sender: 'user',
      text: text
    });

    try {
      // 프로젝트 컨텍스트 가져오기
      const context = this._getProjectContext();
      
      // Ollama API 호출
      const response = await this._ollamaClient.sendMessage(text, 'llama2', context);
      
      // 어시스턴트 응답을 저장소에 추가
      this._chatStorage.addMessage(this._currentSession.id, 'assistant', response);
      
      // 어시스턴트 응답 표시
      this._panel.webview.postMessage({
        command: 'addMessage',
        sender: 'assistant',
        text: response
      });
    } catch (error) {
      const errorMessage = `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
      
      // 에러 메시지를 저장소에 추가
      this._chatStorage.addMessage(this._currentSession.id, 'assistant', errorMessage);
      
      // 에러 메시지 표시
      this._panel.webview.postMessage({
        command: 'addMessage',
        sender: 'assistant',
        text: errorMessage
      });
    }
  }

  /**
   * 프로젝트 파일 정보 가져오기
   */
  private _handleGetProjectFiles(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    const files: string[] = [];
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // 워크스페이스 내 모든 파일 수집
    this._collectFiles(workspaceRoot, files);

    this._panel.webview.postMessage({
      command: 'projectFiles',
      files: files
    });
  }

  /**
   * 파일 수집 (재귀)
   * @param dir 디렉토리 경로
   * @param files 파일 목록
   */
  private _collectFiles(dir: string, files: string[]): void {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // node_modules, .git 등 제외
          if (!item.startsWith('.') && item !== 'node_modules') {
            this._collectFiles(fullPath, files);
          }
        } else {
          // 특정 파일 확장자만 포함
          const ext = path.extname(item);
          if (['.ts', '.js', '.json', '.md', '.txt'].includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // 파일 수집 중 오류 시 무시
    }
  }

  /**
   * 새 채팅 생성
   */
  private _handleCreateNewChat(): void {
    // 새 세션 생성
    this._currentSession = this._chatStorage.createSession();
    
    // 채팅 메시지 초기화
    this._panel.webview.postMessage({
      command: 'clearMessages'
    });
    
    // 채팅 히스토리 업데이트
    this._updateChatHistory();
  }

  /**
   * 채팅 히스토리 로드
   */
  private _handleLoadChatHistory(): void {
    this._updateChatHistory();
  }

  /**
   * 채팅 히스토리 업데이트
   */
  private _updateChatHistory(): void {
    const sessions = this._chatStorage.getRecentSessions(20);
    this._panel.webview.postMessage({
      command: 'updateChatHistory',
      history: sessions.map(session => ({
        id: session.id,
        title: session.title,
        updatedAt: session.updatedAt
      }))
    });
  }

  /**
   * 프로젝트 컨텍스트 가져오기
   * @returns 프로젝트 컨텍스트 문자열
   */
  private _getProjectContext(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return '';
    }

    const context: string[] = [];
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // 현재 열린 파일들 정보 추가
    const openDocuments = vscode.workspace.textDocuments;
    for (const doc of openDocuments) {
      if (doc.uri.scheme === 'file' && doc.uri.fsPath.startsWith(workspaceRoot)) {
        const relativePath = path.relative(workspaceRoot, doc.uri.fsPath);
        context.push(`파일: ${relativePath}`);
        context.push(`내용:\n${doc.getText()}`);
        context.push('---');
      }
    }

    return context.join('\n');
  }

  /**
   * 리소스 정리
   */
  public dispose(): void {
    ChatProvider.currentPanel = undefined;

    // 패널 정리
    this._panel.dispose();

    // 이벤트 리스너 정리
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
} 