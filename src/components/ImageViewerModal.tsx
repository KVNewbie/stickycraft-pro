import React from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Platform,
} from 'react-native';
import { X, Download, Share2 } from 'lucide-react-native';
import { useNoteStore } from '../store/useNoteStore';

export const ImageViewerModal: React.FC = () => {
  const { activeImageModalUri, closeImageViewer } = useNoteStore();

  if (!activeImageModalUri) return null;

  return (
    <Modal
      visible={!!activeImageModalUri}
      transparent={true}
      animationType="fade"
      onRequestClose={closeImageViewer}
    >
      <View style={styles.backdrop}>
        {/* Safe Area Top Bar */}
        <SafeAreaView style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={closeImageViewer}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>사진 상세 보기</Text>
          <View style={{ width: 40 }} />
        </SafeAreaView>

        {/* Center Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: activeImageModalUri }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>

        {/* Bottom Hint */}
        <SafeAreaView style={styles.bottomBar}>
          <Text style={styles.hintText}>화면을 닫으려면 상단 X 버튼을 누르세요</Text>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  hintText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
});
