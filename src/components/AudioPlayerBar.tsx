import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioNote } from '../types/note';

interface AudioPlayerBarProps {
  audio: AudioNote;
  onDelete?: () => void;
  accentColor?: string;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  audio,
  onDelete,
  accentColor = '#2563EB',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(audio.duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && audio.uri) {
      const a = new Audio(audio.uri);
      audioRef.current = a;

      a.onloadedmetadata = () => {
        if (a.duration && !isNaN(a.duration)) {
          setDuration(Math.round(a.duration));
        }
      };

      a.ontimeupdate = () => {
        setCurrentTime(Math.round(a.currentTime));
      };

      a.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      return () => {
        a.pause();
        a.src = '';
      };
    }
  }, [audio.uri]);

  const togglePlay = () => {
    if (Platform.OS === 'web' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((e) => console.log('Audio playback error', e));
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Play/Pause Button */}
      <TouchableOpacity
        style={[styles.playBtn, { backgroundColor: accentColor }]}
        onPress={togglePlay}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={14}
          color="#FFFFFF"
          style={{ marginLeft: isPlaying ? 0 : 2 }}
        />
      </TouchableOpacity>

      {/* Waveform & Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.infoRow}>
          <View style={styles.micBadge}>
            <Ionicons name="mic" size={10} color="#64748B" />
            <Text style={styles.badgeText}>음성 메모</Text>
          </View>
          <Text style={styles.timeText}>
            {formatSec(currentTime)} / {formatSec(duration || 10)}
          </Text>
        </View>

        {/* Progress track */}
        <View style={styles.trackBar}>
          <View
            style={[
              styles.fillBar,
              { width: `${progressPercent}%`, backgroundColor: accentColor },
            ]}
          />
        </View>
      </View>

      {/* Delete Button */}
      {onDelete && (
        <TouchableOpacity
          onPress={onDelete}
          style={styles.deleteBtn}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="trash-outline" size={14} color="#94A3B8" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    flex: 1,
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  micBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#475569',
  },
  timeText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  trackBar: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fillBar: {
    height: '100%',
    borderRadius: 2,
  },
  deleteBtn: {
    padding: 4,
  },
});
