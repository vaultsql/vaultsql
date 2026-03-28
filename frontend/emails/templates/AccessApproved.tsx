import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout from '../components/EmailLayout';
import Button from '../components/Button';
import * as styles from '../components/styles';

interface AccessApprovedProps {
  databaseName: string;
  accountName: string;
  approvedBy: string;
  approvedAt: string;
  accessUntil: string;
  dashboardUrl: string;
}

export default function AccessApproved({
  databaseName = 'Production DB',
  accountName = 'admin',
  approvedBy = 'Admin User',
  approvedAt = '2024-01-12 10:30:00 UTC',
  accessUntil = 'Permanent',
  dashboardUrl = 'https://app.vaultsql.com/',
}: AccessApprovedProps) {
  return (
    <EmailLayout preview={`Access Approved: ${accountName}`}>
      <Heading style={styles.h1}>Access Approved</Heading>
      
      <Text style={styles.text}>
        Your access request has been approved!
      </Text>

      <Text style={{ ...styles.text, marginTop: '24px' }}>
        <strong>Database:</strong> {databaseName}
        <br />
        <strong>Account:</strong> {accountName}
        <br />
        <strong>Approved By:</strong> {approvedBy}
        <br />
        <strong>Approved At:</strong> {approvedAt}
        <br />
        <strong>Access Until:</strong> {accessUntil}
      </Text>

      <Text style={styles.text}>
        You can now connect to this account.
      </Text>

      <Button href={dashboardUrl}>View Accounts</Button>

      <Text style={styles.footer}>
        Start using your new database access right away.
      </Text>
    </EmailLayout>
  );
}
