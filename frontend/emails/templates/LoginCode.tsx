import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout from '../components/EmailLayout';
import CodeBox from '../components/CodeBox';
import * as styles from '../components/styles';

interface LoginCodeProps {
  code: string;
  email: string;
}

export default function LoginCode({ code = '123456', email = 'user@example.com' }: LoginCodeProps) {
  return (
    <EmailLayout preview={`Your VaultSQL login code: ${code}`}>
      <Heading style={styles.h1}>Your login code</Heading>
      <Text style={styles.text}>
        You requested a login code for <strong>{email}</strong>. Enter this code to sign in:
      </Text>

      <CodeBox code={code} />

      <Text style={styles.text}>
        This code will expire in <strong>10 minutes</strong>.
      </Text>

      <Text style={styles.footer}>
        If you didn't request this code, you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}
