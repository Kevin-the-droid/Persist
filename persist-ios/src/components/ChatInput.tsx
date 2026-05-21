import React, { useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Theme } from '../theme/themes';
import Svg, { Path, Rect } from 'react-native-svg';

interface Props {
  t: Theme;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
}

export function ChatInput({ t, value, onChange, onSend, onStop, isStreaming }: Props) {
  const canSend = value.trim().length > 0;
  const [inputHeight, setInputHeight] = useState(22);

  return (
    <View style={[styles.wrapper, { backgroundColor: t.headerBg, borderTopColor: t.border }]}>
      <View style={styles.row}>
        {/* Text input */}
        <View style={[styles.inputWrap, { backgroundColor: t.inputBg, borderColor: t.border }]}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Message"
            placeholderTextColor="rgba(255,255,255,0.28)"
            multiline
            style={[
              styles.input,
              { color: t.text, height: Math.min(Math.max(inputHeight, 22), 120) },
            ]}
            onContentSizeChange={(e) =>
              setInputHeight(e.nativeEvent.contentSize.height)
            }
          />
        </View>

        {/* Send / Stop button */}
        <TouchableOpacity
          onPress={isStreaming ? onStop : onSend}
          disabled={!isStreaming && !canSend}
          style={[
            styles.btn,
            {
              backgroundColor:
                isStreaming || canSend ? t.accent : t.surface,
            },
          ]}
          activeOpacity={0.75}
        >
          {isStreaming ? (
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Rect x="5" y="5" width="14" height="14" rx="3" fill="#fff" />
            </Svg>
          ) : (
            <Svg width={17} height={17} viewBox="0 0 24 24">
              <Path
                d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z"
                fill={isStreaming || canSend ? '#fff' : t.textTer}
              />
            </Svg>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    borderTopWidth: 0.5,
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  inputWrap: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 0.5,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  input: {
    fontSize: 14.5,
    letterSpacing: -0.28,
    lineHeight: 22,
    minHeight: 22,
  },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
