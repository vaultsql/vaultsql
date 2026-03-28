import { Body, Container, Head, Html, Preview, Text } from '@react-email/components';
import * as React from 'react';
import * as styles from './styles';

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export default function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Text style={styles.brand}>VaultSQL</Text>
          {children}
        </Container>
      </Body>
    </Html>
  );
}
