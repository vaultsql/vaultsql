import { Button as EmailButton, Section } from '@react-email/components';
import * as React from 'react';
import * as styles from './styles';

interface ButtonProps {
  href: string;
  children: React.ReactNode;
}

export default function Button({ href, children }: ButtonProps) {
  return (
    <Section style={styles.buttonContainer}>
      <EmailButton style={styles.button} href={href}>
        {children}
      </EmailButton>
    </Section>
  );
}
