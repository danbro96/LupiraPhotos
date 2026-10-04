import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { TextInput } from 'react-native-paper';

export function Input({ style, ...props }: ComponentProps<typeof TextInput>) {
  return <TextInput mode="outlined" dense style={[styles.input, style]} {...props} />;
}

// Column rhythm: the siblings' TextField carries a row-layout `flex: 1` instead.
const styles = StyleSheet.create({ input: { marginTop: 10 } });
