import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import * as styles from '../components/styles';

interface KeyApprovalRequestProps {
  requesterName: string;
  requesterEmail: string;
  workspaceName: string;
  inboxUrl: string;
}

export default function KeyApprovalRequest({
  requesterName = 'John Doe',
  requesterEmail = 'user@example.com',
  workspaceName = 'My Workspace',
  inboxUrl = 'https://app.vaultsql.com/inbox/',
}: KeyApprovalRequestProps) {
  return (
    <EmailLayout preview={`Key approval request from ${requesterName}`}>
      <Heading style={styles.h1}>Key approval request</Heading>
      <Text style={styles.text}>
        <strong>{requesterName}</strong> ({requesterEmail}) has requested key approval for the{' '}
        <strong>{workspaceName}</strong> workspace.
      </Text>

      <Text style={styles.text}>
        They need an admin to approve their key before they can access encrypted credentials.
      </Text>

      <Button href={inboxUrl}>Review pending requests</Button>

      <Text style={styles.footer}>
        You're receiving this email because you're an admin in the {workspaceName} workspace.
      </Text>
    </EmailLayout>
  );
}
