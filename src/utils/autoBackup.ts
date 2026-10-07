import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Note, Board, WidgetConfig } from '../types/note';

export const STORAGE_KEY_AUTOBACKUPS = '@stickycraft_autobackups_v1';
export const STORAGE_KEY_AUTOBACKUP_ENABLED = '@stickycraft_autobackup_enabled_v1';

export interface BackupPayload {
  version: string;
  timestamp: number;
  noteCount: number;
  notes: Note[];
  boards?: Board[];
  widgets?: WidgetConfig[];
  masterPin?: string | null;
  calendarStickers?: Record<string, { emoji: string; label?: string }>;
}

export interface BackupSnapshotMeta {
  timestamp: number;
  dateStr: string;
  noteCount: number;
  data: string; // JSON serialized BackupPayload
}

const MAX_SNAPSHOTS = 5;

/**
 * 자동 백업 스냅샷 저장
 */
export async function saveAutoBackupSnapshot(payload: Omit<BackupPayload, 'version' | 'timestamp' | 'noteCount'>): Promise<void> {
  try {
    const isEnabled = await AsyncStorage.getItem(STORAGE_KEY_AUTOBACKUP_ENABLED);
    if (isEnabled === 'false') return;

    const fullPayload: BackupPayload = {
      version: '1.0.0',
      timestamp: Date.now(),
      noteCount: payload.notes.length,
      ...payload,
    };

    const d = new Date(fullPayload.timestamp);
    const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

    const newSnapshot: BackupSnapshotMeta = {
      timestamp: fullPayload.timestamp,
      dateStr,
      noteCount: fullPayload.noteCount,
      data: JSON.stringify(fullPayload),
    };

    const existingJson = await AsyncStorage.getItem(STORAGE_KEY_AUTOBACKUPS);
    let list: BackupSnapshotMeta[] = existingJson ? JSON.parse(existingJson) : [];

    // 최신 순으로 추가하고 최대 5개 유지
    list = [newSnapshot, ...list.slice(0, MAX_SNAPSHOTS - 1)];

    await AsyncStorage.setItem(STORAGE_KEY_AUTOBACKUPS, JSON.stringify(list));
  } catch (e) {
    console.warn('Auto backup snapshot error:', e);
  }
}

/**
 * 자동 백업 히스토리 목록 불러오기
 */
export async function getAutoBackupHistory(): Promise<BackupSnapshotMeta[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY_AUTOBACKUPS);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    return [];
  }
}

/**
 * 백업 데이터를 파일로 내보내기 & 공유
 */
export async function exportAndShareBackupFile(jsonData: string): Promise<boolean> {
  const filename = `StickyCraft_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      console.error('Web file export failed:', e);
      return false;
    }
  } else {
    try {
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonData, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'StickyCraft Pro 메모 백업 파일 전달/공유',
          UTI: 'public.json',
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Native file share failed:', e);
      return false;
    }
  }
}

/**
 * 백업 JSON 파일 선택하여 읽어오기
 */
export async function pickAndReadBackupFile(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      };
      input.click();
    });
  } else {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const content = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        return content;
      }
      return null;
    } catch (e) {
      console.error('Document picker error:', e);
      return null;
    }
  }
}
