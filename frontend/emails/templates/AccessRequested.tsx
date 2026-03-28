import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import * as styles from '../components/styles';

interface AccessRequestedProps {
  requesterName: string;
  requesterEmail: string;
  databaseName: string;
  accountName: string;
  reason?: string;
  grantedUntil: string;
  inboxUrl: string;
}

export default function AccessRequested({
  requesterName = 'John Doe',
  requesterEmail = 'user@example.com',
  databaseName = 'Production DB',
  accountName = 'admin',
  reason = '',
  grantedUntil = 'Permanent',
  inboxUrl = 'https://app.vaultsql.com/inbox',
}: AccessRequestedProps) {
  return (
    <EmailLayout preview={`Access request from ${requesterName}`}>
      <Heading style={styles.h1}>Access Request</Heading>
      
      <Text style={styles.text}>
        <strong>{requesterName}</strong> ({requesterEmail}) has requested access to a database account.
      </Text>

      <Text style={{ ...styles.text, marginTop: '24px' }}>
        <strong>Database:</strong> {databaseName}
        <br />
        <strong>Account:</strong> {accountName}
        <br />
        <strong>Access Until:</strong> {grantedUntil}
      </Text>

      {reason && (
        <Text style={{ ...styles.text, marginTop: '16px' }}>
          <strong>Reason:</strong>
          <br />
          {reason}
        </Text>
      )}

      <Button href={inboxUrl}>Review Request</Button>

      <Text style={styles.footer}>
        Please review this access request in the Inbox.
      </Text>
    </EmailLayout>
  );
}
