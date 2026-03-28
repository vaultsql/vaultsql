import { Section, Text } from '@react-email/components';
import * as React from 'react';
import * as styles from './styles';

interface CodeBoxProps {
  code: string;
}

export default function CodeBox({ code }: CodeBoxProps) {
  return (
    <Section style={styles.codeContainer}>
      <Text style={styles.codeText}>{code}</Text>
    </Section>
  );
}
