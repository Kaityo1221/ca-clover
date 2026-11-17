// Pure presentation model. No fetch or mutation. Only show trusted authorized results.
export type DeltaStatus = 'idle'|'baseline'|'loading'|'updated'|'unchanged'|'error'|'unauthorized';
export function meetupDeltaMessage(status: DeltaStatus, added = 0, updated = 0): string {
  switch (status) {
    case 'idle': return '更新確認前です';
    case 'baseline': return '比較するための基準データを読み込みました';
    case 'loading': return 'Meetupの更新を確認しています';
    case 'updated': return `新着${Math.max(0, added)}件・更新${Math.max(0, updated)}件`;
    case 'unchanged': return '新しい更新はありません';
    case 'error': return '更新を確認できませんでした。前回の情報を保持しています';
    case 'unauthorized': return 'このコミュニティの情報を表示する権限がありません';
    default: return '更新状態を確認できません';
  }
}
