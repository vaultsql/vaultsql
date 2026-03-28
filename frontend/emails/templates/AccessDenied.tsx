import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import * as styles from '../components/styles';

interface AccessDeniedProps {
  databaseName: string;
  accountName: string;
  deniedBy: string;
  deniedAt: string;
  dashboardUrl: string;
}

export default function AccessDenied({
  databaseName = 'Production DB',
  accountName = 'admin',
  deniedBy = 'Admin User',
  deniedAt = '2024-01-12 10:30:00 UTC',
  dashboardUrl = 'https://app.vaultsql.com/',
}: AccessDeniedProps) {
  return (
    <EmailLayout preview={`Access Denied: ${accountName}`}>
      <Heading style={styles.h1}>Access Denied</Heading>
      
      <Text style={styles.text}>
        Your access request has been denied.
      </Text>

      <Text style={{ ...styles.text, marginTop: '24px' }}>
        <strong>Database:</strong> {databaseName}
        <br />
        <strong>Account:</strong> {accountName}
        <br />
        <strong>Denied By:</strong> {deniedBy}
        <br />
        <strong>Denied At:</strong> {deniedAt}
      </Text>

      <Text style={styles.text}>
        Please contact your workspace administrator if you believe this was in error.
      </Text>

      <Button href={dashboardUrl}>View Accounts</Button>

      <Text style={styles.footer}>
        You can request access again if needed.
      </Text>
    </EmailLayout>
  );
}
