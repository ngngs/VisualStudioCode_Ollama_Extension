import * as vscode from 'vscode';
import { registerChatCommands } from './commands/chatCommand';
import { ChatProvider } from './providers/chatProvider';
import { ChatStorage } from './utils/chatStorage';
import { OllamaClient } from './utils/ollamaClient';

/**
 * Extension이 활성화될 때 호출되는 함수
 * @param context Extension 컨텍스트
 */
export function activate(context: vscode.ExtensionContext): void {

  // 채팅 저장소 초기화
  const chatStorage = new ChatStorage(context);

  // Ollama 클라이언트 초기화
  const ollamaUrl = context.globalState.get<string>('ollamaUrl', 'http://localhost:11434');
  const ollamaClient = new OllamaClient(ollamaUrl);

  // 채팅 명령어 등록
  registerChatCommands(context);

  // 채팅 패널 열기 명령어 등록
  const openChatCommand = vscode.commands.registerCommand('ollama.openChat', () => {
    ChatProvider.createOrShow(context.extensionUri, context);
  });

  // Ollama 연결 설정 명령어 등록
  const configureOllamaCommand = vscode.commands.registerCommand('ollama.configure', async () => {
    const ollamaUrl = await vscode.window.showInputBox({
      prompt: 'Ollama 서버 주소를 입력하세요 (예: http://localhost:11434)',
      placeHolder: 'http://localhost:11434',
      value: 'http://localhost:11434'
    });

    if (ollamaUrl) {
      await context.globalState.update('ollamaUrl', ollamaUrl);
      ollamaClient.setBaseUrl(ollamaUrl);
      vscode.window.showInformationMessage(`Ollama 서버가 설정되었습니다: ${ollamaUrl}`);
    }
  });

  // Ollama 연결 테스트 명령어 등록
  const testConnectionCommand = vscode.commands.registerCommand('ollama.testConnection', async () => {
    try {
      const isConnected = await ollamaClient.testConnection();
      if (isConnected) {
        const models = await ollamaClient.getModels();
        vscode.window.showInformationMessage(
          `Ollama 서버에 연결되었습니다. 사용 가능한 모델: ${models.join(', ')}`
        );
      } else {
        vscode.window.showErrorMessage('Ollama 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`연결 테스트 실패: ${error.message}`);
    }
  });

  // 모든 명령어를 컨텍스트에 등록
  context.subscriptions.push(
    openChatCommand,
    configureOllamaCommand,
    testConnectionCommand
  );

  // 상태바에 Ollama 상태 표시
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  statusBarItem.text = '$(radio-tower) Ollama';
  statusBarItem.tooltip = 'Ollama 서버 상태';
  statusBarItem.command = 'ollama.testConnection';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // 초기 연결 테스트
  ollamaClient.testConnection().then(isConnected => {
    if (isConnected) {
      statusBarItem.text = '$(check) Ollama';
      statusBarItem.tooltip = 'Ollama 서버 연결됨';
    } else {
      statusBarItem.text = '$(error) Ollama';
      statusBarItem.tooltip = 'Ollama 서버 연결 안됨 - 클릭하여 설정';
    }
  });
}

/**
 * Extension이 비활성화될 때 호출되는 함수
 */
export function deactivate(): void {
  // Extension 비활성화 시 정리 작업
} 