import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { Trash2, GripHorizontal, Type, Palette, Check } from 'lucide-react-native';
import { FreeTextBox } from '../types/note';

interface DraggableTextBoxProps {
  textBox: FreeTextBox;
  containerWidth: number;
  containerHeight: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FreeTextBox>) => void;
  onDelete: (id: string) => void;
}

export const DraggableTextBox: React.FC<DraggableTextBoxProps> = ({
  textBox,
  containerWidth,
  containerHeight,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}) => {
  const [posX, setPosX] = useState(textBox.x || 100);
  const [posY, setPosY] = useState(textBox.y || 100);
  const [text, setText] = useState(textBox.text || '');
  const [fontSize, setFontSize] = useState(textBox.fontSize || 16);
  const [color, setColor] = useState(textBox.color || '#1E293B');
  const [bgColor, setBgColor] = useState(textBox.backgroundColor || 'transparent');
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Dragging refs for web & native
  const posRef = useRef({ x: posX, y: posY });
  posRef.current = { x: posX, y: posY };

  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  useEffect(() => {
    setPosX(textBox.x || 100);
    setPosY(textBox.y || 100);
    setText(textBox.text || '');
    setFontSize(textBox.fontSize || 16);
    setColor(textBox.color || '#1E293B');
    setBgColor(textBox.backgroundColor || 'transparent');
  }, [textBox]);

  // PanResponder for drag handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3;
      },
      onPanResponderGrant: () => {
        dragStartRef.current = { ...posRef.current };
        onSelect(textBox.id);
      },
      onPanResponderMove: (_, gesture: PanResponderGestureState) => {
        const nextX = Math.max(10, Math.min(containerWidth - 120, dragStartRef.current.x + gesture.dx));
        const nextY = Math.max(10, Math.min(containerHeight - 60, dragStartRef.current.y + gesture.dy));
        setPosX(nextX);
        setPosY(nextY);
      },
      onPanResponderRelease: () => {
        onUpdate(textBox.id, { x: posRef.current.x, y: posRef.current.y });
      },
    })
  ).current;

  // Web desktop mouse drag handlers
  const handleWebDragStart = (e: any) => {
    if (Platform.OS !== 'web') return;
    e.stopPropagation();
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
    onSelect(textBox.id);

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const nextX = Math.max(10, Math.min(containerWidth - 120, ev.clientX - dragStartRef.current.x));
      const nextY = Math.max(10, Math.min(containerHeight - 60, ev.clientY - dragStartRef.current.y));
      setPosX(nextX);
      setPosY(nextY);
    };

    const onMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        onUpdate(textBox.id, { x: posRef.current.x, y: posRef.current.y });
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleTextChange = (val: string) => {
    setText(val);
    onUpdate(textBox.id, { text: val });
  };

  const handleCycleFontSize = () => {
    const nextSize = fontSize === 14 ? 18 : fontSize === 18 ? 24 : 14;
    setFontSize(nextSize);
    onUpdate(textBox.id, { fontSize: nextSize });
  };

  const handleCycleBgColor = () => {
    const nextBg =
      bgColor === 'transparent'
        ? '#FEF08A' // post-it yellow
        : bgColor === '#FEF08A'
        ? 'rgba(255, 255, 255, 0.92)' // clean paper white
        : 'transparent';
    setBgColor(nextBg);
    onUpdate(textBox.id, { backgroundColor: nextBg });
  };

  const handleSelectColor = (selectedColor: string) => {
    setColor(selectedColor);
    setShowColorPicker(false);
    onUpdate(textBox.id, { color: selectedColor });
  };

  const TEXT_COLORS = ['#1E293B', '#2563EB', '#DC2626', '#059669', '#7C3AED', '#EA580C'];

  return (
    <View
      style={[
        styles.boxWrapper,
        {
          left: posX,
          top: posY,
          backgroundColor: bgColor,
          borderColor: isSelected ? '#2563EB' : 'transparent',
          borderWidth: isSelected ? 1.5 : 1,
          borderStyle: isSelected ? 'dashed' : 'solid',
        },
      ]}
      onTouchStart={() => onSelect(textBox.id)}
      {...(Platform.OS === 'web' ? ({ onClick: () => onSelect(textBox.id) } as any) : {})}
    >
      {/* Selection Control Header Bar */}
      {isSelected && (
        <View style={styles.floatingControlsBar}>
          {/* Drag Handle */}
          <View
            style={styles.dragHandle}
            {...panResponder.panHandlers}
            {...(Platform.OS === 'web' ? ({ onMouseDown: handleWebDragStart } as any) : {})}
          >
            <GripHorizontal size={14} color="#64748B" />
          </View>

          {/* Font Size Toggle */}
          <TouchableOpacity
            style={styles.pillBtn}
            onPress={handleCycleFontSize}
            {...(Platform.OS === 'web' ? ({ onClick: handleCycleFontSize } as any) : {})}
          >
            <Text style={styles.pillBtnText}>{fontSize}px</Text>
          </TouchableOpacity>

          {/* Color Picker Toggle */}
          <TouchableOpacity
            style={styles.pillBtn}
            onPress={() => setShowColorPicker(!showColorPicker)}
            {...(Platform.OS === 'web' ? ({ onClick: () => setShowColorPicker(!showColorPicker) } as any) : {})}
          >
            <View style={[styles.colorPreviewDot, { backgroundColor: color }]} />
          </TouchableOpacity>

          {/* Background Toggle (Post-it / Transparent) */}
          <TouchableOpacity
            style={styles.pillBtn}
            onPress={handleCycleBgColor}
            {...(Platform.OS === 'web' ? ({ onClick: handleCycleBgColor } as any) : {})}
          >
            <Text style={styles.pillBtnText}>
              {bgColor === 'transparent' ? '투명' : bgColor === '#FEF08A' ? '노랑' : '흰색'}
            </Text>
          </TouchableOpacity>

          {/* Delete Button */}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(textBox.id)}
            {...(Platform.OS === 'web' ? ({ onClick: () => onDelete(textBox.id) } as any) : {})}
          >
            <Trash2 size={13} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}

      {/* Color Picker Popover */}
      {isSelected && showColorPicker && (
        <View style={styles.colorPopover}>
          {TEXT_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorOption, { backgroundColor: c }]}
              onPress={() => handleSelectColor(c)}
              {...(Platform.OS === 'web' ? ({ onClick: () => handleSelectColor(c) } as any) : {})}
            >
              {color === c && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Main Text Input */}
      <TextInput
        style={[
          styles.textInput,
          {
            fontSize,
            color,
            lineHeight: fontSize * 1.35,
          },
        ]}
        value={text}
        onChangeText={handleTextChange}
        placeholder="텍스트 입력..."
        placeholderTextColor="#94A3B8"
        multiline
        autoFocus={isSelected && text === ''}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  boxWrapper: {
    position: 'absolute',
    minWidth: 140,
    maxWidth: 420,
    borderRadius: 8,
    padding: 6,
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  floatingControlsBar: {
    position: 'absolute',
    top: -34,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 50,
    gap: 4,
  },
  dragHandle: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    ...Platform.select({
      web: {
        cursor: 'grab' as any,
      },
    }),
  },
  pillBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  colorPreviewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  deleteBtn: {
    padding: 3,
    marginLeft: 2,
  },
  colorPopover: {
    position: 'absolute',
    top: -68,
    left: 30,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 60,
    gap: 6,
  },
  colorOption: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    fontWeight: '500',
    padding: 2,
    margin: 0,
    outlineStyle: 'none' as any,
  },
});
