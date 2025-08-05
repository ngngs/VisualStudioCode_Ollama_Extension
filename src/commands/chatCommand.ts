import * as vscode from 'vscode';
import { ChatProvider } from '../providers/chatProvider';
import { OllamaClient } from '../utils/ollamaClient';

/**
 * 채팅 명령어를 등록하는 함수
 * @param context Extension 컨텍스트
 * @param ollamaClient Ollama 클라이언트 인스턴스
 */
export function registerChatCommands(context: vscode.ExtensionContext, ollamaClient: OllamaClient): void {
  // 채팅 패널 열기 명령어
  const openChatCommand = vscode.commands.registerCommand('ollama.openChat', () => {
    ChatProvider.createOrShow(context.extensionUri, context);
  });

  // Ollama 연결 설정 명령어
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

  context.subscriptions.push(openChatCommand, configureOllamaCommand);
} 