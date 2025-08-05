import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ChatStorage, ChatSession } from '../utils/chatStorage';
import { OllamaClient } from '../utils/ollamaClient';

/**
 * 채팅 프로바이더 클래스
 */
export class ChatProvider {
  public static currentPanel: ChatProvider | undefined;
  public static readonly viewType = 'ollamaChat';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private readonly _ollamaClient: OllamaClient;
  private readonly _chatStorage: ChatStorage;
  private _currentSession: ChatSession | undefined;
  private _disposables: vscode.Disposable[] = [];

  /**
   * 채팅 패널 생성 또는 표시
   * @param extensionUri 확장 URI
   * @param context 확장 컨텍스트
   */
  public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // 이미 패널이 열려있으면 포커스
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
        localResourceRoots: [extensionUri]
      }
    );

    ChatProvider.currentPanel = new ChatProvider(panel, extensionUri, context);
  }

  /**
   * 생성자
   * @param panel 웹뷰 패널
   * @param extensionUri 확장 URI
   * @param context 확장 컨텍스트
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._context = context;
    this._ollamaClient = new OllamaClient(context.globalState.get<string>('ollamaUrl', 'http://localhost:11434'));
    this._chatStorage = new ChatStorage(context);

    // 웹뷰 HTML 설정
    this._update();

    // 메시지 리스너 등록
    this._panel.webview.onDidReceiveMessage(
      message => this._handleMessage(message),
      undefined,
      this._disposables
    );

    // 패널 닫힐 때 정리
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  /**
   * 웹뷰 업데이트
   */
  private _update(): void {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  /**
   * 웹뷰 HTML 생성
   * @param webview 웹뷰
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
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 0;
            display: flex;
            height: 100vh;
        }
        
        .sidebar {
            width: 250px;
            border-right: 1px solid var(--vscode-sideBar-border);
            display: flex;
            flex-direction: column;
        }
        
        .sidebar-header {
            padding: 15px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .new-chat-btn, .settings-btn {
            padding: 8px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .new-chat-btn:hover, .settings-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .chat-history {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        }
        
        .chat-item {
            padding: 8px 12px;
            margin-bottom: 5px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .chat-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .chat-item.active {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
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
            white-space: pre-wrap;
            word-wrap: break-word;
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
        
        .code-block {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 13px;
            overflow-x: auto;
            white-space: pre;
        }
        
        .code-block-header {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 5px 10px;
            margin: -10px -10px 10px -10px;
            border-radius: 4px 4px 0 0;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            border-bottom: 1px solid var(--vscode-input-border);
        }
        
        .loading-message {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            margin-right: 20%;
            padding: 15px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .loading-dots {
            display: flex;
            gap: 4px;
        }
        
        .loading-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--vscode-descriptionForeground);
            animation: loading-pulse 1.4s ease-in-out infinite both;
        }
        
        .loading-dot:nth-child(1) { animation-delay: -0.32s; }
        .loading-dot:nth-child(2) { animation-delay: -0.16s; }
        .loading-dot:nth-child(3) { animation-delay: 0s; }
        
        @keyframes loading-pulse {
            0%, 80%, 100% {
                transform: scale(0.8);
                opacity: 0.5;
            }
            40% {
                transform: scale(1);
                opacity: 1;
            }
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
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-header">
            <button class="new-chat-btn" onclick="createNewChat()">새 채팅</button>
            <button class="settings-btn" onclick="openOllamaSettings()">Ollama 서버 설정</button>
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

        // Ollama 서버 설정 열기
        function openOllamaSettings() {
            vscode.postMessage({
                command: 'openOllamaSettings'
            });
        }

        // 메시지 전송
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const text = input.value.trim();
            
            if (!text || isProcessing) return;
            
            input.value = '';
            
            isProcessing = true;
            document.getElementById('sendBtn').disabled = true;
            
            // 로딩 메시지 표시
            showLoadingMessage();
            
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
            messageDiv.className = 'message ' + sender;
            
            // 간단한 줄바꿈 처리
            if (sender === 'assistant') {
                messageDiv.innerHTML = text.replace(/\\n/g, '<br>');
            } else {
                messageDiv.textContent = text;
            }
            
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // 로딩 메시지 표시
        function showLoadingMessage() {
            const messagesContainer = document.getElementById('chatMessages');
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-message';
            loadingDiv.id = 'loadingMessage';
            loadingDiv.innerHTML = '<div class="loading-dots"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div><span>AI가 응답을 작성 중입니다...</span>';
            messagesContainer.appendChild(loadingDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // 로딩 메시지 제거
        function hideLoadingMessage() {
            const loadingMessage = document.getElementById('loadingMessage');
            if (loadingMessage) {
                loadingMessage.remove();
            }
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
                    // 로딩 메시지 제거
                    hideLoadingMessage();
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
                    
                case 'loadChatMessages':
                    loadChatMessages(message.messages);
                    break;
                    
                case 'clearMessages':
                    document.getElementById('chatMessages').innerHTML = 
                        '<div class="message assistant">안녕하세요! Ollama Chat에 오신 것을 환영합니다. 무엇을 도와드릴까요?</div>';
                    break;
            }
        });

        // 채팅 메시지들 로드
        function loadChatMessages(messages) {
            const messagesContainer = document.getElementById('chatMessages');
            messagesContainer.innerHTML = '';
            
            if (messages.length === 0) {
                messagesContainer.innerHTML = 
                    '<div class="message assistant">안녕하세요! Ollama Chat에 오신 것을 환영합니다. 무엇을 도와드릴까요?</div>';
                return;
            }
            
            messages.forEach(msg => {
                addMessage(msg.sender, msg.content);
            });
        }
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
      const response = await this._ollamaClient.sendMessage(text, 'codellama:7b-instruct-q5_K_M', context);
      
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
      history: sessions
    });
  }

  /**
   * 특정 채팅 로드
   * @param chatId 채팅 ID
   */
  private _handleLoadChat(chatId: string): void {
    try {
      // 세션 로드
      const session = this._chatStorage.loadSession(chatId);
      if (!session) {
        vscode.window.showErrorMessage('채팅을 찾을 수 없습니다.');
        return;
      }

      // 현재 세션 설정
      this._currentSession = session;

      // 메시지 로드
      const messages = this._chatStorage.getSessionMessages(chatId);

      // 웹뷰에 메시지 전송
      this._panel.webview.postMessage({
        command: 'loadChatMessages',
        messages: messages
      });

      // 현재 채팅 ID 설정
      this._panel.webview.postMessage({
        command: 'setCurrentChat',
        chatId: chatId
      });

      // 채팅 히스토리 업데이트
      this._updateChatHistory();
    } catch (error) {
      vscode.window.showErrorMessage('채팅을 로드하는 중 오류가 발생했습니다.');
    }
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
    vscode.window.visibleTextEditors.forEach(editor => {
      const filePath = editor.document.uri.fsPath;
      if (filePath.startsWith(workspaceRoot)) {
        const relativePath = path.relative(workspaceRoot, filePath);
        const content = editor.document.getText();
        context.push(`파일: ${relativePath}\\n내용:\\n${content}\\n`);
      }
    });

    return context.join('\\n');
  }

  /**
   * Ollama 설정 열기
   */
  private async _handleOpenOllamaSettings(): Promise<void> {
    const ollamaUrl = await vscode.window.showInputBox({
      prompt: 'Ollama 서버 주소를 입력하세요 (예: http://localhost:11434)',
      placeHolder: 'http://localhost:11434',
      value: this._ollamaClient.getBaseUrl()
    });

    if (ollamaUrl) {
      await this._context.globalState.update('ollamaUrl', ollamaUrl);
      this._ollamaClient.setBaseUrl(ollamaUrl);
      vscode.window.showInformationMessage(`Ollama 서버가 설정되었습니다: ${ollamaUrl}`);
    }
  }

  /**
   * 메시지 처리
   * @param message 웹뷰에서 받은 메시지
   */
  private _handleMessage(message: any): void {
    switch (message.command) {
      case 'sendMessage':
        this._handleSendMessage(message.text);
        break;
      case 'createNewChat':
        this._handleCreateNewChat();
        break;
      case 'loadChat':
        this._handleLoadChat(message.chatId);
        break;
      case 'loadChatHistory':
        this._handleLoadChatHistory();
        break;
      case 'openOllamaSettings':
        this._handleOpenOllamaSettings();
        break;
    }
  }

  /**
   * 리소스 정리
   */
  public dispose(): void {
    ChatProvider.currentPanel = undefined;

    // 패널 정리
    this._panel.dispose();

    // 구독 해제
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
} 