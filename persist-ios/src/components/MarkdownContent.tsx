import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Theme } from '../theme/themes';

interface Props {
  content: string;
  isUser: boolean;
  t: Theme;
}

function parseInline(text: string, t: Theme, isUser: boolean): React.ReactNode[] {
  const els: React.ReactNode[] = [];
  let buf = '';
  let i = 0;
  let ki = 0;

  const flush = () => {
    if (buf) {
      els.push(<Text key={ki++}>{buf}</Text>);
      buf = '';
    }
  };

  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      flush();
      const end = text.indexOf('**', i + 2);
      if (end === -1) { buf += '**'; i += 2; continue; }
      els.push(
        <Text key={ki++} style={{ fontWeight: '700' }}>
          {text.slice(i + 2, end)}
        </Text>,
      );
      i = end + 2;
    } else if (text[i] === '`') {
      flush();
      const end = text.indexOf('`', i + 1);
      if (end === -1) { buf += '`'; i++; continue; }
      els.push(
        <Text
          key={ki++}
          style={{
            fontFamily: 'Courier New',
            fontSize: 13,
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderRadius: 4,
          }}
        >
          {text.slice(i + 1, end)}
        </Text>,
      );
      i = end + 1;
    } else {
      buf += text[i++];
    }
  }
  flush();
  return els;
}

export function MarkdownContent({ content, isUser, t }: Props) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] | null = null;
  let ki = 0;

  const flushList = () => {
    if (!listItems) return;
    blocks.push(
      <View key={ki++} style={{ gap: 2, paddingLeft: 2 }}>
        {listItems.map((item, i) => (
          <View key={i} style={styles.listRow}>
            <Text style={[styles.bullet, { color: isUser ? '#fff' : t.asstText, opacity: 0.55 }]}>•</Text>
            <Text style={[styles.bodyText, { color: isUser ? '#fff' : t.asstText }]}>
              {parseInline(item, t, isUser)}
            </Text>
          </View>
        ))}
      </View>,
    );
    listItems = null;
  };

  for (const line of lines) {
    if (/^[-*•] /.test(line)) {
      if (!listItems) listItems = [];
      listItems.push(line.replace(/^[-*•] /, ''));
    } else {
      flushList();
      if (line === '') {
        blocks.push(<View key={ki++} style={{ height: 5 }} />);
      } else {
        blocks.push(
          <Text key={ki++} style={[styles.bodyText, { color: isUser ? '#fff' : t.asstText }]}>
            {parseInline(line, t, isUser)}
          </Text>,
        );
      }
    }
  }
  flushList();

  return <View style={styles.container}>{blocks}</View>;
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  bodyText: {
    fontSize: 14.5,
    lineHeight: 23,
    letterSpacing: -0.28,
    fontFamily: undefined, // system font
  },
  listRow: { flexDirection: 'row', gap: 7 },
  bullet: { flexShrink: 0, marginTop: 2 },
});
