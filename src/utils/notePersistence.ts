import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Note } from '../types/note';

export const NOTES_STORAGE_KEY = '@stickycraft_notes_v1';

let lastWrite: Promise<void> = Promise.resolve();

// A delayed older write must never overwrite an edit or a restored backup.
export function persistNotes(notes: Note[]): Promise<void> {
  lastWrite = lastWrite.catch(() => {}).then(() =>
    AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes))
  );
  return lastWrite;
}

export function waitForNotesWrite(): Promise<void> {
  return lastWrite;
}
